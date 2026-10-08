import type { EventEnvelope } from '../../orchestration/events/types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { receiptService } from '../../finance/receiptService';

function paymentIntentPath(tenantId: string, saleId: string): string {
  return '/tenants/' + tenantId + '/entities/payment_intents/records/' + saleId;
}

function salePath(tenantId: string, saleId: string): string {
  return '/tenants/' + tenantId + '/entities/sales_counter/records/' + saleId;
}

export async function handlePosMpesaPaymentConfirmed(event: EventEnvelope): Promise<void> {
  if (!event.tenantId) throw new Error('POS payment confirmation requires tenant authority');
  const intents = await firestoreClient.listCollection<any>(
    '/tenants/' + event.tenantId + '/entities/payment_intents/records',
  );
  const intent = intents.find(
    (record) =>
      record?.tenantId === event.tenantId &&
      record?.paymentMethod === 'MPESA_STK_PUSH' &&
      record?.status === 'PENDING' &&
      (record?.saleId === event.correlationId || record?.transactionId === (event.payload as any)?.transactionId),
  );
  if (!intent) return;

  const transactionId = String((event.payload as any)?.transactionId || intent.transactionId || '');
  if (!transactionId) throw new Error('POS M-Pesa confirmation has no authoritative financial transaction identity');
  const transaction = await firestoreClient.get<any>(
    '/tenants/' + event.tenantId + '/financialTransactions/' + transactionId,
  );
  if (!transaction || transaction.tenantId !== event.tenantId || transaction.status !== 'POSTED') return;

  const amount = Number((event.payload as any)?.amount || transaction.amount || 0);
  const expectedAmount = Number(intent.amountKes || 0);
  if (!Number.isFinite(amount) || amount !== expectedAmount || Number(transaction.amount) !== expectedAmount) {
    throw new Error('POS payment confirmation does not reconcile with the authoritative sale amount');
  }

  const saleId = String(intent.saleId || '');
  const sale = await firestoreClient.get<any>(salePath(event.tenantId, saleId));
  if (!sale || sale.tenantId && sale.tenantId !== event.tenantId || sale.branchId !== intent.branchId) {
    throw new Error('POS payment confirmation sale identity does not reconcile');
  }

  const providerReceiptReference = String(
    transaction.providerReceiptReference || (event.payload as any)?.providerReference || '',
  );
  if (!providerReceiptReference) throw new Error('Posted M-Pesa transaction has no provider receipt reference');

  await firestoreClient.runTransaction(async (tx) => {
    const currentIntent = await tx.get<any>(paymentIntentPath(event.tenantId!, saleId));
    const currentSale = await tx.get<any>(salePath(event.tenantId!, saleId));
    if (!currentIntent || !currentSale) throw new Error('POS payment intent or sale disappeared during reconciliation');

    await tx.update<any>(paymentIntentPath(event.tenantId!, saleId), {
      status: 'CONFIRMED',
      providerReference: transaction.providerReference,
      transactionId,
      providerReceiptReference,
      updatedAt: event.occurredAt,
      confirmedAt: event.occurredAt,
    });
    await tx.update<any>(salePath(event.tenantId!, saleId), {
      attributes: {
        ...(currentSale.attributes || {}),
        paymentStatus: 'PAID',
        paymentProvider: 'SAFARICOM_MPESA',
        paymentTransactionId: transactionId,
        paymentProviderReference: providerReceiptReference,
        paymentConfirmedAt: event.occurredAt,
      },
      updatedAt: event.occurredAt,
    });
  });

  await receiptService.createFromPostedTransaction(event.tenantId, transactionId, event.principalId || 'sys_internal');
}

export async function handlePosMpesaPaymentFailed(event: EventEnvelope): Promise<void> {
  if (!event.tenantId) throw new Error('POS payment failure requires tenant authority');
  const intents = await firestoreClient.listCollection<any>(
    '/tenants/' + event.tenantId + '/entities/payment_intents/records',
  );
  const intent = intents.find(
    (record) =>
      record?.tenantId === event.tenantId &&
      record?.paymentMethod === 'MPESA_STK_PUSH' &&
      record?.status === 'PENDING' &&
      (record?.saleId === event.correlationId || record?.transactionId === (event.payload as any)?.transactionId),
  );
  if (!intent) return;

  await firestoreClient.runTransaction(async (tx) => {
    const currentIntent = await tx.get<any>(paymentIntentPath(event.tenantId!, intent.saleId));
    const currentSale = await tx.get<any>(salePath(event.tenantId!, intent.saleId));
    if (!currentIntent || !currentSale) throw new Error('POS payment intent or sale disappeared during failure reconciliation');
    if (currentSale.attributes?.paymentStatus === 'PAID') return;
    await tx.update<any>(paymentIntentPath(event.tenantId!, intent.saleId), {
      status: 'FAILED',
      updatedAt: event.occurredAt,
      failedAt: event.occurredAt,
    });
    await tx.update<any>(salePath(event.tenantId!, intent.saleId), {
      attributes: { ...(currentSale.attributes || {}), paymentStatus: 'FAILED', paymentFailedAt: event.occurredAt },
      updatedAt: event.occurredAt,
    });
  });
}
