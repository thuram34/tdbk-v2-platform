import { describe, expect, it } from 'vitest';
import { dbkCapabilityManager } from '../dbkCapabilityManager';
import { SecurityContext } from '../../kernel/types';
import { beforeEach } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { spaceMembershipRepository } from '../../persistence/firestore/repositories/spaceMembershipRepository';

const context = (roles: string[], permissions: string[]): SecurityContext => ({
  requestId: 'req_capability_guard',
  correlationId: 'corr_capability_guard',
  timestamp: new Date().toISOString(),
  principal: {
    id: 'user_capability_guard',
    tenantId: 'tenant_capability_guard',
    branchId: null,
    roles,
    permissions,
    authTime: Date.now(),
    tokenSource: 'JWT',
    isMaster: false,
  },
  tenantContext: {
    tenantId: 'tenant_capability_guard',
    name: 'Capability Guard Test',
    blueprintId: 'retail_v1',
    status: 'ACTIVE',
  },
  branchContext: null,
});

describe('DBK capability operation guard', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });
  it('requires the capability record to be operational and authorized', async () => {
    const ctx = context(['DBK_ADMIN'], ['manage:payments']);
    await expect(
      dbkCapabilityManager.assertCapabilityOperational(ctx, 'tenant_capability_guard', 'mpesa_bridge', 'TEST_OPERATION'),
    ).rejects.toThrow();
  });

  it('allows an authorized principal after the capability is durably activated in the runtime store', async () => {
    const admin = context(['TENANT_ADMIN', 'DBK_ADMIN'], ['manage:payments']);
    await spaceMembershipRepository.saveMembership({
      membershipId: 'mem_capability_guard_admin',
      userId: 'user_capability_guard',
      spaceId: 'tenant_capability_guard_hq',
      tenantId: 'tenant_capability_guard',
      role: 'DBK_ADMIN',
      roleTitle: 'DBK Administrator',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      permissions: ['manage:payments'],
    });
    await dbkCapabilityManager.enableCapabilityPersistent(
      admin,
      'tenant_capability_guard',
      'mpesa_bridge',
      'ENTITLED',
      false,
    );
    const record = await dbkCapabilityManager.assertCapabilityOperational(
      admin,
      'tenant_capability_guard',
      'mpesa_bridge',
      'TEST_OPERATION',
    );
    expect(['ENABLED', 'CONFIGURED']).toContain(record.state);
  });
});
