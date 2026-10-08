import type { EventEnvelope } from '../../orchestration/events/types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { receiptService } from '../../finance/receiptService';

function checkoutRequestId(event: EventEnvelope): string | null {
  const payload = event.payload as Record<string, any>;
  return String(payload?.data?.checkoutRequestId || payload?.checkoutRequestId || '') || null;
}

async function resolvePaymentIntent(tenantId: string, event: EventEnvelope): Promise<any | null> {
  const payload = event.payload as Record<string, any>;
  const transactionId = String(payload?.transactionId || '');
  const checkoutId = checkoutRequestId(event);
  const saleId = String(payload?.saleId || '');

  if (saleId) {
    const direct = await firestoreClient.get<any>(`/tenants/${tenantId}/entities/payment_intents/records/${saleId}`);
    if (direct) return direct;
  }

  const intents = await firestoreClient.listCollection<any>(`/tenants/${tenantId}/entities/payment_intents/records`).catch(() => []);
  return intents.find((intent) =>
    intent?.tenantId === tenantId &&
    ((transactionId && intent.transactionId === transactionId) || (checkoutId && intent.providerReference === checkoutId))
  ) || null;
}

export async function handlePosMpesaPaymentEvent(event: EventEnvelope): Promise<void> {
  if (event.source !== 'MpesaBridge') return;
  if (event.eventType !== 'payment.confirmed.v1' && event.eventType !== 'payment.failed.v1') return;

  const tenantId = event.tenantId;
  if (!tenantId) return;

  const intent = await resolvePaymentIntent(tenantId, event);
  if (!intent || intent.tenantId !== tenantId) return;

  const saleId = String(intent.saleId || '');
  if (!saleId) return;
  const salePath = `/tenants/${tenantId}/entities/sales_counter/records/${saleId}`;

  const payload = event.payload as Record<string, any>;
  const transactionId = String(payload?.transactionId || intent.transactionId || '');
  const checkoutId = checkoutRequestId(event);

  if (event.eventType === 'payment.failed.v1') {
    await firestoreClient.runTransaction(async (tx) => {
      const currentIntent = await tx.get<any>(`/tenants/${tenantId}/entities/payment_intents/records/${saleId}`);
      if (!currentIntent || currentIntent.tenantId !== tenantId) return;
      if (currentIntent.status === 'CONFIRMED') return;
      await tx.update<any>(`/tenants/${tenantId}/entities/payment_intents/records/${saleId}`, {
        status: 'FAILED',
        updatedAt: event.occurredAt,
      });
    });
    return;
  }

  const financialTransactions = await firestoreClient.listCollection<any>(`/tenants/${tenantId}/financialTransactions`);
  const transaction = financialTransactions.find((candidate) =>
    candidate?.tenantId === tenantId &&
    candidate?.status === 'POSTED' &&
    ((transactionId && candidate.transactionId === transactionId) || (checkoutId && candidate.providerReference === checkoutId))
  );
  if (!transaction) return;

  const sale = await firestoreClient.get<any>(salePath);
  if (!sale || sale.branchId !== event.branchId || sale.status !== 'COMPLETED') return;

  const expectedAmount = Number(sale.attributes?.totalAmountKes);
  if (!Number.isFinite(expectedAmount) || Number(transaction.amount) !== expectedAmount) {
    throw new Error(`M-Pesa payment amount does not reconcile with sale ${saleId}`);
  }

  await firestoreClient.runTransaction(async (tx) => {
    const currentIntent = await tx.get<any>(`/tenants/${tenantId}/entities/payment_intents/records/${saleId}`);
    const currentSale = await tx.get<any>(salePath);
    if (!currentIntent || !currentSale) throw new Error('M-Pesa confirmation references missing POS payment state');
    if (currentIntent.tenantId !== tenantId || (currentSale.tenantId && currentSale.tenantId !== tenantId)) throw new Error('M-Pesa confirmation tenant mismatch');
    if (Number(currentSale.attributes?.totalAmountKes) !== Number(transaction.amount)) throw new Error('POS sale amount changed before payment confirmation');

    await tx.update<any>(`/tenants/${tenantId}/entities/payment_intents/records/${saleId}`, {
      status: 'CONFIRMED',
      transactionId: transaction.transactionId,
      providerReference: transaction.providerReference,
      providerReceiptReference: transaction.providerReceiptReference || null,
      confirmedAt: event.occurredAt,
      updatedAt: event.occurredAt,
    });

    await tx.update<any>(salePath, {
      attributes: {
        ...(currentSale.attributes || {}),
        paymentStatus: 'PAID',
        paymentProvider: 'SAFARICOM_MPESA',
        paymentTransactionId: transaction.transactionId,
        paymentProviderReference: transaction.providerReference,
        paymentProviderReceiptReference: transaction.providerReceiptReference || null,
        paymentConfirmedAt: event.occurredAt,
      },
      updatedAt: event.occurredAt,
    });
  });

  await receiptService.createFromPostedTransaction(tenantId, transaction.transactionId, event.principalId || 'sys_payment');
}
