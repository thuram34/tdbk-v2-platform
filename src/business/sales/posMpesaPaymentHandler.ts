import type { EventEnvelope } from '../orchestration/events/types';
import { firestoreClient } from '../persistence/firestore/firestoreClient';

export async function handlePosMpesaPaymentConfirmed(event: EventEnvelope): Promise<void> {
  if (!event.tenantId) throw new Error('POS payment confirmation requires tenant authority');
  const sales = await firestoreClient.listCollection<any>(
    '/tenants/' + event.tenantId + '/entities/sales_counter/records',
  );
  const sale = sales.find(
    (record) =>
      record?.status === 'COMPLETED' &&
      record?.attributes?.paymentMethod === 'MPESA' &&
      record?.attributes?.correlationId === event.correlationId,
  );
  if (!sale) return;

  const providerReference = String((event.payload as any)?.providerReference || '');
  const amount = Number((event.payload as any)?.amount || 0);
  const expectedAmount = Number(sale.attributes?.totalAmountKes || 0);
  if (!providerReference || !Number.isFinite(amount) || amount !== expectedAmount) {
    throw new Error('POS payment confirmation does not reconcile with the authoritative sale amount/reference');
  }

  await firestoreClient.runTransaction(async (tx) => {
    const path = '/tenants/' + event.tenantId + '/entities/sales_counter/records/' + sale.id;
    const current = await tx.get<any>(path);
    if (!current) throw new Error('Authoritative POS sale disappeared during payment confirmation');
    if (current.attributes?.paymentStatus === 'PAID' && current.attributes?.paymentProviderReference === providerReference) return;
    if (current.attributes?.paymentMethod !== 'MPESA' || Number(current.attributes?.totalAmountKes) !== amount) {
      throw new Error('POS payment confirmation conflicts with authoritative sale');
    }
    await tx.update<any>(path, {
      attributes: {
        ...(current.attributes || {}),
        paymentStatus: 'PAID',
        paymentProvider: 'SAFARICOM_MPESA',
        paymentProviderReference: providerReference,
        paymentConfirmedAt: event.occurredAt,
      },
      updatedAt: event.occurredAt,
    });
  });
}

export async function handlePosMpesaPaymentFailed(event: EventEnvelope): Promise<void> {
  if (!event.tenantId) throw new Error('POS payment failure requires tenant authority');
  const sales = await firestoreClient.listCollection<any>(
    '/tenants/' + event.tenantId + '/entities/sales_counter/records',
  );
  const sale = sales.find(
    (record) =>
      record?.status === 'COMPLETED' &&
      record?.attributes?.paymentMethod === 'MPESA' &&
      record?.attributes?.correlationId === event.correlationId,
  );
  if (!sale) return;

  await firestoreClient.runTransaction(async (tx) => {
    const path = '/tenants/' + event.tenantId + '/entities/sales_counter/records/' + sale.id;
    const current = await tx.get<any>(path);
    if (!current) throw new Error('Authoritative POS sale disappeared during payment failure');
    if (current.attributes?.paymentStatus === 'PAID') return;
    await tx.update<any>(path, {
      attributes: {
        ...(current.attributes || {}),
        paymentStatus: 'FAILED',
        paymentFailedAt: event.occurredAt,
      },
      updatedAt: event.occurredAt,
    });
  });
}
