import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../../persistence/firestore/firestoreClient';
import { TestMemoryFirestoreDriver } from '../../../persistence/firestore/driver/testMemoryFirestoreDriver';
import { subscriptionRepository } from '../../../persistence/firestore/repositories/subscriptionRepository';
import { DbkSubscription } from '../../../persistence/types';

describe('SubscriptionRepository atomic payment activation', () => {
  beforeEach(() => {
    firestoreClient.setDriverForTesting(new TestMemoryFirestoreDriver());
  });

  it('allows only one concurrent activation transition for the same subscription', async () => {
    const subscription: DbkSubscription = {
      subscriptionId: 'sub_atomic_1',
      dbkId: 'dbk_atomic_1',
      tier: 'FOUNDATION',
      status: 'TRIAL',
      paymentStatus: 'PENDING',
      currency: 'KES',
      amount: 1000,
      interval: 'MONTHLY',
      startedAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: null,
      cancelledAt: null,
      paymentReference: 'ws_CO_ATOMIC_1',
      provider: 'SAFARICOM_MPESA',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      correlationId: 'corr_atomic_1',
    };

    await subscriptionRepository.saveSubscription(subscription);

    const results = await Promise.all([
      subscriptionRepository.activateIfPending('dbk_atomic_1', 'sub_atomic_1', 'ws_CO_ATOMIC_1'),
      subscriptionRepository.activateIfPending('dbk_atomic_1', 'sub_atomic_1', 'ws_CO_ATOMIC_1'),
    ]);

    expect(results.filter((result) => result.transitioned)).toHaveLength(1);
    expect(results.filter((result) => !result.transitioned)).toHaveLength(1);

    const persisted = await subscriptionRepository.getSubscriptionForDbk('dbk_atomic_1', 'sub_atomic_1');
    expect(persisted?.status).toBe('ACTIVE');
    expect(persisted?.paymentStatus).toBe('PAID');
  });
});
