import { describe, expect, it } from 'vitest';
import { dbkCapabilityManager } from '../dbkCapabilityManager';
import { SecurityContext } from '../../kernel/types';

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
    tokenSource: 'TEST',
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
  it('requires the capability record to be operational and authorized', async () => {
    const ctx = context(['DBK_ADMIN'], ['manage:payments']);
    await expect(
      dbkCapabilityManager.assertCapabilityOperational(ctx, 'tenant_capability_guard', 'mpesa_bridge', 'TEST_OPERATION'),
    ).rejects.toThrow();
  });
});
