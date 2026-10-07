import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { sokoniPaymentService } from './sokoniPaymentService';
import { mpesaBridge } from '../orchestration/bridge/adapters/mpesaBridge';
import { handleSokoniPaymentConfirmed } from './sokoniPaymentEventHandler';

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

  it('ignores unrelated payment confirmation events', async () => {
    await firestoreClient.set('/system/sokoni/participants/participant_guard', {
      id: 'participant_guard',
      ownerUid: 'owner_sokoni_001',
      publicationStatus: 'DRAFT',
      commercial: { offeringCode: 'SOKONI_100', state: 'PAYMENT_PENDING' },
      tdbkRelationship: 'NOT_ENROLLED',
    });
    await firestoreClient.set('/system/sokoni/paymentIntents/intent_guard', {
      intentId: 'intent_guard',
      participantId: 'participant_guard',
      ownerUid: 'owner_sokoni_001',
      offeringCode: 'SOKONI_100',
      amount: 100,
      currency: 'KES',
      provider: 'SAFARICOM_MPESA',
      providerReference: 'checkout_guard',
      state: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmedAt: null,
    });

    await handleSokoniPaymentConfirmed({
      eventId: 'evt_unrelated_payment',
      eventType: 'payment.confirmed.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant_other',
      branchId: null,
      principalId: 'worker_test',
      correlationId: 'corr_unrelated',
      causationId: 'checkout_guard',
      source: 'UnrelatedPaymentService',
      payload: { provider: 'SAFARICOM_MPESA', providerReference: 'checkout_guard', amount: 100, currency: 'KES' },
      metadata: {},
    } as any);

    const intent = await firestoreClient.get<any>('/system/sokoni/paymentIntents/intent_guard');
    const participant = await firestoreClient.get<any>('/system/sokoni/participants/participant_guard');
    expect(intent.state).toBe('PENDING');
    expect(participant.commercial.state).toBe('PAYMENT_PENDING');
    expect(participant.publicationStatus).toBe('DRAFT');
  });

  it('reconciles a real M-Pesa confirmation event by checkout reference', async () => {
    await firestoreClient.set('/system/sokoni/participants/participant_004', {
      id: 'participant_004',
      ownerUid: 'owner_sokoni_001',
      publicationStatus: 'DRAFT',
      commercial: { offeringCode: 'SOKONI_100', state: 'PAYMENT_PENDING' },
      tdbkRelationship: 'NOT_ENROLLED',
    });
    await firestoreClient.set('/system/sokoni/paymentIntents/intent_004', {
      intentId: 'intent_004',
      participantId: 'participant_004',
      ownerUid: 'owner_sokoni_001',
      offeringCode: 'SOKONI_100',
      amount: 100,
      currency: 'KES',
      provider: 'SAFARICOM_MPESA',
      providerReference: 'ws_CO_004',
      state: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmedAt: null,
      providerReceiptReference: null,
    });

    await handleSokoniPaymentConfirmed({
      eventId: 'evt_mpesa_004',
      eventType: 'payment.confirmed.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant_sokoni_merchant_test',
      branchId: null,
      principalId: 'worker_test',
      correlationId: 'corr_mpesa_004',
      causationId: 'ws_CO_004',
      source: 'MpesaBridge',
      payload: {
        providerReference: 'QAB004XYZ',
        providerReceiptReference: 'QAB004XYZ',
        amount: 100,
        currency: 'KES',
        status: 'CONFIRMED',
      },
      metadata: {},
    } as any);

    const intent = await firestoreClient.get<any>('/system/sokoni/paymentIntents/intent_004');
    const participant = await firestoreClient.get<any>('/system/sokoni/participants/participant_004');
    expect(intent.state).toBe('CONFIRMED');
    expect(intent.providerReceiptReference).toBe('QAB004XYZ');
    expect(participant.commercial.state).toBe('PAYMENT_CONFIRMED');
    expect(participant.publicationStatus).toBe('ACTIVE');

    await handleSokoniPaymentConfirmed({
      eventId: 'evt_mpesa_004_duplicate',
      eventType: 'payment.confirmed.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant_sokoni_merchant_test',
      branchId: null,
      principalId: 'worker_test',
      correlationId: 'corr_mpesa_004',
      causationId: 'ws_CO_004',
      source: 'MpesaBridge',
      payload: { providerReference: 'QAB004XYZ', amount: 100, currency: 'KES' },
      metadata: {},
    } as any);

    const stableIntent = await firestoreClient.get<any>('/system/sokoni/paymentIntents/intent_004');
    expect(stableIntent.providerReceiptReference).toBe('QAB004XYZ');
  });
});
