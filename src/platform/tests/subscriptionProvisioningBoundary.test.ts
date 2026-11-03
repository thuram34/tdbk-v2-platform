import { describe, expect, it } from 'vitest';
import type { SecurityContext } from '../../kernel/types';
import { AuthorizationError } from '../../kernel/errors/kernelErrors';
import { provisioningService } from '../provisioning/provisioningService';

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
  it('rejects a paid tier supplied by a business owner', async () => {
    await expect(
      provisioningService.provisionDbk(ownerContext(), {
        legalName: 'Boundary Test Business',
        blueprintId: 'hardware_v1',
        subscriptionTier: 'PRO',
        primaryBranchName: 'Mombasa',
        idempotencyKey: 'subscription-boundary-paid-v1',
        // The server is authoritative for identity; this should never be used
        // to grant paid entitlement to an owner.
        dbkId: 'subscription-boundary-paid-tier',
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
