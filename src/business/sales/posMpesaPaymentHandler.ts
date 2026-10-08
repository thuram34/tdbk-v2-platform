import type { EventEnvelope } from '../../orchestration/events/types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { receiptService } from '../../finance/receiptService';

function checkoutRequestId(event: EventEnvelope): string | null {
  const payload = event.payload as Record<string, any>;
  return String(payload?.data?.checkoutRequestId || payload?.checkoutRequestId || '') || null;
}

async function resolveIntent(tenantId: string, event: EventEnvelope): Promise<any | null> {
  const payload = event.payload as Record<string, any>;
  const saleId = String(payload?.saleId || '');
  const transactionId = String(payload?.transactionId || '');
  const checkoutId = checkoutRequestId(event);

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

export async function handlePosMpesaPaymentConfirmed(event: EventEnvelope): Promise<void> {
  if (!event.tenantId) throw new Error('POS payment confirmation requires tenant authority');

  const intent = await resolveIntent(event.tenantId, event);
  if (!intent || intent.tenantId !== event.tenantId) return;

  const saleId = String(intent.saleId || '');
  if (!saleId) return;
  const salePath = `/tenants/${event.tenantId}/entities/sales_counter/records/${saleId}`;
  const payload = event.payload as Record<string, any>;
  const transactionId = String(payload?.transactionId || intent.transactionId || '');
  const checkoutId = checkoutRequestId(event);

  const financialTransactions = await firestoreClient.listCollection<any>(`/tenants/${event.tenantId}/financialTransactions`);
  const transaction = financialTransactions.find((candidate) =>
    candidate?.tenantId === event.tenantId &&
    candidate?.status === 'POSTED' &&
    ((transactionId && candidate.transactionId === transactionId) || (checkoutId && candidate.providerReference === checkoutId))
  );
  if (!transaction) return;

  const sale = await firestoreClient.get<any>(salePath);
  if (!sale || sale.tenantId && sale.tenantId !== event.tenantId) return;
  if (sale.branchId !== event.branchId || sale.status !== 'COMPLETED') return;

  const expectedAmount = Number(sale.attributes?.totalAmountKes);
  if (!Number.isFinite(expectedAmount) || Number(transaction.amount) !== expectedAmount || Number(intent.amountKes) !== expectedAmount) {
    throw new Error(`M-Pesa payment confirmation does not reconcile with authoritative sale ${saleId}`);
  }

  await firestoreClient.runTransaction(async (tx) => {
    const currentIntent = await tx.get<any>(`/tenants/${event.tenantId}/entities/payment_intents/records/${saleId}`);
    const currentSale = await tx.get<any>(salePath);
    if (!currentIntent || !currentSale) throw new Error('Authoritative POS payment state disappeared during confirmation');
    if (currentIntent.tenantId !== event.tenantId || (currentSale.tenantId && currentSale.tenantId !== event.tenantId)) {
      throw new Error('POS payment confirmation tenant mismatch');
    }
    if (currentSale.branchId !== event.branchId || currentSale.status !== 'COMPLETED') return;
    if (Number(currentSale.attributes?.totalAmountKes) !== Number(transaction.amount)) {
      throw new Error('POS sale amount changed before payment confirmation');
    }
    if (currentIntent.status === 'CONFIRMED' && currentSale.attributes?.paymentStatus === 'PAID') return;

    await tx.update<any>(`/tenants/${event.tenantId}/entities/payment_intents/records/${saleId}`, {
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

  await receiptService.createFromPostedTransaction(event.tenantId, transaction.transactionId, event.principalId || 'sys_payment');
}

export async function handlePosMpesaPaymentFailed(event: EventEnvelope): Promise<void> {
  if (!event.tenantId) throw new Error('POS payment failure requires tenant authority');

  const intent = await resolveIntent(event.tenantId, event);
  if (!intent || intent.tenantId !== event.tenantId) return;

  const saleId = String(intent.saleId || '');
  if (!saleId) return;

  await firestoreClient.runTransaction(async (tx) => {
    const path = `/tenants/${event.tenantId}/entities/payment_intents/records/${saleId}`;
    const current = await tx.get<any>(path);
    if (!current) return;
    if (current.status === 'CONFIRMED') return;
    await tx.update<any>(path, { status: 'FAILED', updatedAt: event.occurredAt });
  });
}
