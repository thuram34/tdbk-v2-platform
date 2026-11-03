import { beforeEach, describe, expect, it } from 'vitest';
import type { SecurityContext } from '../../kernel/types';
import { AuthorizationError } from '../../kernel/errors/kernelErrors';
import { provisioningService } from '../provisioning/provisioningService';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { dbkRegistry } from '../dbkRegistry';

function ownerContext(): SecurityContext {
  return {
    requestId: 'subscription-boundary-test',
    correlationId: 'subscription-boundary-correlation',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'owner-boundary-test',
      email: 'owner@tdbk.test',
      isMaster: false,
      tenantId: null,
      branchId: null,
      roles: ['BUSINESS_OWNER'],
      permissions: [],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'JWT',
    },
    tenantContext: null,
    branchContext: null,
  };
}

describe('provisioning subscription commercial boundary', () => {
  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
    dbkRegistry.clearStoreForTesting();
    provisioningService.clearStoreForTesting();
  });

  it.each(['FOUNDATION', 'GROWTH', 'PRO', 'ENTERPRISE'] as const)(
    'rejects owner provisioning for paid tier %s',
    async (tier) => {
      await expect(
        provisioningService.provisionDbk(ownerContext(), {
          legalName: 'Boundary Test Business',
          blueprintId: 'hardware_v1',
          subscriptionTier: tier,
          primaryBranchName: 'Mombasa',
          idempotencyKey: `subscription-boundary-${tier.toLowerCase()}`,
          dbkId: `subscription_boundary_${tier.toLowerCase()}`,
        }),
      ).rejects.toBeInstanceOf(AuthorizationError);
    },
  );

  it('defaults a new owner-provisioned DBK to FREE', async () => {
    const result = await provisioningService.provisionDbk(ownerContext(), {
      legalName: 'Default Free Tier Test',
      blueprintId: 'hardware_v1',
      primaryBranchName: 'Mombasa',
      idempotencyKey: 'subscription-boundary-default-free',
      dbkId: 'subscription_boundary_default_free',
    });
    expect(result.success).toBe(true);
    expect(result.subscriptionTier).toBe('FREE');
  });
});
