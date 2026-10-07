import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { sokoniPaymentService } from './sokoniPaymentService';
import { mpesaBridge } from '../orchestration/bridge/adapters/mpesaBridge';

describe('Sokoni payment authority', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
    vi.stubEnv('SOKONI_PAYMENT_TENANT_ID', 'tenant_sokoni_merchant_test');
    vi.stubEnv('NODE_ENV', 'test');
  });

  const context = {
    principal: { id: 'owner_sokoni_001', tenantId: null, branchId: null, roles: [] },
    requestId: 'req_sokoni_payment',
    correlationId: 'corr_sokoni_payment',
  } as any;

  it('keeps a paid participant draft until provider confirmation', async () => {
    await firestoreClient.set('/system/sokoni/participants/participant_001', {
      id: 'participant_001',
      ownerUid: 'owner_sokoni_001',
      publicationStatus: 'DRAFT',
      commercial: { offeringCode: 'SOKONI_100', state: 'PAYMENT_REQUIRED' },
      tdbkRelationship: 'NOT_ENROLLED',
    });

    const intent = await sokoniPaymentService.initiate(context, 'participant_001', 'SOKONI_100', '254712345678');
    expect(intent.state).toBe('PENDING');

    const participant = await firestoreClient.get<any>('/system/sokoni/participants/participant_001');
    expect(participant.commercial.state).toBe('PAYMENT_PENDING');
    expect(participant.publicationStatus).toBe('DRAFT');
  });

  it('does not allow a foreign owner to initiate payment', async () => {
    await firestoreClient.set('/system/sokoni/participants/participant_002', {
      id: 'participant_002',
      ownerUid: 'different_owner',
      publicationStatus: 'DRAFT',
      commercial: { offeringCode: 'SOKONI_100', state: 'PAYMENT_REQUIRED' },
      tdbkRelationship: 'NOT_ENROLLED',
    });

    await expect(
      sokoniPaymentService.initiate(context, 'participant_002', 'SOKONI_100', '254712345678')
    ).rejects.toThrow('Only the participant owner');
  });
  it('confirms once from provider truth and is idempotent on repeat confirmation', async () => {
    await firestoreClient.set('/system/sokoni/participants/participant_003', {
      id: 'participant_003',
      ownerUid: 'owner_sokoni_001',
      publicationStatus: 'DRAFT',
      commercial: { offeringCode: 'SOKONI_500', state: 'PAYMENT_PENDING' },
      tdbkRelationship: 'NOT_ENROLLED',
    });
    await firestoreClient.set('/system/sokoni/paymentIntents/intent_003', {
      intentId: 'intent_003',
      participantId: 'participant_003',
      ownerUid: 'owner_sokoni_001',
      offeringCode: 'SOKONI_500',
      amount: 500,
      currency: 'KES',
      provider: 'SAFARICOM_MPESA',
      providerReference: 'checkout_003',
      state: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmedAt: null,
    });

    vi.spyOn(mpesaBridge, 'executeSystemPayment').mockResolvedValue({
      status: 'SUCCESS',
      provider: 'SAFARICOM_MPESA',
      providerReference: 'checkout_003',
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_sokoni_payment',
    } as any);

    const first = await sokoniPaymentService.confirm(context, 'intent_003');
    expect(first.state).toBe('CONFIRMED');
    const participant = await firestoreClient.get<any>('/system/sokoni/participants/participant_003');
    expect(participant.publicationStatus).toBe('ACTIVE');
    expect(participant.commercial.state).toBe('PAYMENT_CONFIRMED');

    const second = await sokoniPaymentService.confirm(context, 'intent_003');
    expect(second.state).toBe('CONFIRMED');
    expect(mpesaBridge.executeSystemPayment).toHaveBeenCalledTimes(1);
  });

});
