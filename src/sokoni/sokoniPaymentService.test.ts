import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { sokoniPaymentService } from './sokoniPaymentService';

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
    await firestoreClient.set('/system/sokoniParticipants/participant_001', {
      id: 'participant_001',
      ownerUid: 'owner_sokoni_001',
      publicationStatus: 'DRAFT',
      commercial: { offeringCode: 'SOKONI_100', state: 'PAYMENT_REQUIRED' },
      tdbkRelationship: 'NOT_ENROLLED',
    });

    const intent = await sokoniPaymentService.initiate(context, 'participant_001', 'SOKONI_100', '254712345678');
    expect(intent.state).toBe('PENDING');

    const participant = await firestoreClient.get<any>('/system/sokoniParticipants/participant_001');
    expect(participant.commercial.state).toBe('PAYMENT_PENDING');
    expect(participant.publicationStatus).toBe('DRAFT');
  });

  it('does not allow a foreign owner to initiate payment', async () => {
    await firestoreClient.set('/system/sokoniParticipants/participant_002', {
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
});
