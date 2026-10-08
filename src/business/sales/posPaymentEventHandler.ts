import type { EventEnvelope } from '../../orchestration/events/types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';

function checkoutRequestId(event: EventEnvelope): string | null {
  const payload = event.payload as Record<string, any>;
  return String(payload?.data?.checkoutRequestId || payload?.checkoutRequestId || '') || null;
}

export async function handlePosMpesaPaymentEvent(event: EventEnvelope): Promise<void> {
  if (event.source !== 'MpesaBridge') return;
  if (event.eventType !== 'payment.confirmed.v1' && event.eventType !== 'payment.failed.v1') return;

  const saleId = String(event.correlationId || '');
  const tenantId = event.tenantId;
  const providerReference = checkoutRequestId(event);
  if (!tenantId || !saleId || !providerReference) return;

  const salePath = '/tenants/' + tenantId + '/entities/sales_counter/records/' + saleId;
  await firestoreClient.runTransaction(async (tx) => {
    const sale = await tx.get<any>(salePath);
    if (!sale) return;
    if (sale.branchId !== event.branchId || sale.status !== 'COMPLETED') return;

    const expectedAmount = Number(sale.attributes?.totalAmountKes);
    const providerAmount = Number((event.payload as any)?.amount || 0);
    if (event.eventType === 'payment.confirmed.v1' && (!Number.isFinite(providerAmount) || providerAmount !== expectedAmount)) {
      throw new Error('M-Pesa payment amount does not reconcile with sale ' + saleId);
    }

    const nextStatus = event.eventType === 'payment.confirmed.v1' ? 'PAID' : 'PENDING';
    const currentStatus = sale.attributes?.paymentStatus;
    if (currentStatus === nextStatus) return;

    await tx.update<any>(salePath, {
      attributes: {
        ...(sale.attributes || {}),
        paymentStatus: nextStatus,
        paymentProvider: 'SAFARICOM_MPESA',
        paymentProviderReference: providerReference,
        paymentConfirmedAt: event.eventType === 'payment.confirmed.v1' ? event.occurredAt : null,
      },
      updatedAt: event.occurredAt,
    });
  });
}
