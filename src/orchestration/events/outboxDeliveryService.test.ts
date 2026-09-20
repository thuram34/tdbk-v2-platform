import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { eventBus } from './eventBus';
import { outboxDeliveryService } from './outboxDeliveryService';
import type { OutboxRecord } from '../../persistence/types';

const tenantId = 'tenant_outbox_delivery';

function record(eventId: string): OutboxRecord {
  const now = new Date().toISOString();
  return {
    eventId,
    tenantId,
    branchId: 'branch_hq',
    eventType: 'payment.posted.v1',
    eventVersion: 'v1',
    occurredAt: now,
    correlationId: 'corr-outbox',
    causationId: 'provider-ref',
    source: 'TDBK_FINANCE_TRUTH_LAYER',
    payload: { transactionId: 'txn_outbox', amount: 1000, currency: 'KES' },
    status: 'PENDING',
    attemptCount: 0,
    availableAt: now,
    createdAt: now,
    updatedAt: now,
    leaseOwner: null,
    leaseUntil: null,
    lastError: null,
    deliveredAt: null,
  };
}

describe('Durable outbox delivery', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
    eventBus.clearStoreForTesting();
  });

  it('delivers a pending event and marks it delivered', async () => {
    let received = 0;
    eventBus.subscribe('payment.posted.v1', async (event) => {
      if (event.payload.transactionId === 'txn_outbox') received++;
    });

    await outboxRepository.saveOutbox(tenantId, 'evt_delivery_001', record('evt_delivery_001'));

    const result = await outboxDeliveryService.deliverNext(tenantId, 'worker-1');

    expect(result.delivered).toBe(true);
    expect(received).toBe(1);

    const stored = await outboxRepository.getOutbox(tenantId, 'evt_delivery_001');
    expect(stored?.status).toBe('DELIVERED');
    expect(stored?.leaseOwner).toBeNull();
    expect(stored?.deliveredAt).not.toBeNull();
  });

  it('retains failed delivery for retry', async () => {
    let attempts = 0;
    eventBus.subscribe('payment.posted.v1', async () => {
      attempts++;
      if (attempts === 1) throw new Error('downstream unavailable');
    });

    await outboxRepository.saveOutbox(tenantId, 'evt_delivery_002', record('evt_delivery_002'));

    const first = await outboxDeliveryService.deliverNext(tenantId, 'worker-1');
    expect(first.delivered).toBe(false);
    expect(first.error).toBe('downstream unavailable');

    const retryRecord = await outboxRepository.getOutbox(tenantId, 'evt_delivery_002');
    expect(retryRecord?.status).toBe('RETRY_WAIT');
    expect(retryRecord?.attemptCount).toBe(1);
    expect(retryRecord?.lastError).toBe('downstream unavailable');

    await outboxRepository.updateStatus(
      tenantId,
      'evt_delivery_002',
      'PENDING',
      { availableAt: new Date().toISOString() },
    );

    const second = await outboxDeliveryService.deliverNext(tenantId, 'worker-1');
    expect(second.delivered).toBe(true);
    expect(attempts).toBe(2);
  });

  it('uses event idempotency when a delivery is retried after subscriber success', async () => {
    let received = 0;
    eventBus.subscribe('payment.posted.v1', async () => {
      received++;
    });

    await outboxRepository.saveOutbox(tenantId, 'evt_delivery_003', record('evt_delivery_003'));

    const first = await outboxDeliveryService.deliverNext(tenantId, 'worker-1');
    expect(first.delivered).toBe(true);

    await outboxRepository.updateStatus(
      tenantId,
      'evt_delivery_003',
      'PENDING',
      { availableAt: new Date().toISOString(), deliveredAt: null },
    );

    const second = await outboxDeliveryService.deliverNext(tenantId, 'worker-2');
    expect(second.delivered).toBe(true);
    expect(received).toBe(1);
  });
});
