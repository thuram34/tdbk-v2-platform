import { beforeEach, describe, expect, it } from 'vitest';
import type { SecurityContext } from '../../kernel/types';
import { dbkRegistry } from '../dbkRegistry';
import { provisioningService } from '../provisioning/provisioningService';

function masterContext(): SecurityContext {
  return {
    requestId: `guard-master-${Date.now()}`,
    timestamp: new Date().toISOString(),
    principal: {
      id: 'guard_master',
      tenantId: 'master',
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      authTime: Date.now(),
      tokenSource: 'JWT',
      isMaster: true,
    },
    tenantContext: null,
    branchContext: null,
    correlationId: `guard-master-${Date.now()}`,
  };
}

function ownerContext(): SecurityContext {
  return {
    requestId: `guard-owner-${Date.now()}`,
    timestamp: new Date().toISOString(),
    principal: {
      id: 'guard_master',
      tenantId: null,
      branchId: null,
      roles: ['BUSINESS_OWNER'],
      permissions: ['PORTFOLIO_READ', 'PORTFOLIO_WRITE', 'DBK_PROVISION', 'DBK_MANAGE'],
      authTime: Date.now(),
      tokenSource: 'JWT',
      isMaster: false,
    },
    tenantContext: null,
    branchContext: null,
    correlationId: `guard-owner-${Date.now()}`,
  };
}

describe('DBK guardrails', () => {
  beforeEach(async () => {
    dbkRegistry.clearStoreForTesting();
    provisioningService.clearStoreForTesting();
  });

  it('blocks generic persistence from changing immutable commercial identity', async () => {
    const master = masterContext();
    const result = await provisioningService.provisionDbk(master, {
      dbkId: 'guard_school_01',
      legalName: 'Guard School',
      blueprintId: 'school_v1',
      primaryBranchName: 'Main Campus',
      subscriptionTier: 'FOUNDATION',
    });

    const dbk = await dbkRegistry.getDbk(master, result.dbkId);
    expect(dbk).toBeDefined();

    await expect(
      dbkRegistry.saveDbk(ownerContext(), {
        ...dbk!,
        subscriptionTier: 'PRO',
      }),
    ).rejects.toThrow(/Immutable DBK field 'subscriptionTier'/);
  });

  it('blocks generic persistence from changing lifecycle state', async () => {
    const master = masterContext();
    const result = await provisioningService.provisionDbk(master, {
      dbkId: 'guard_school_02',
      legalName: 'Guard School Two',
      blueprintId: 'school_v1',
      primaryBranchName: 'Main Campus',
      subscriptionTier: 'FOUNDATION',
    });

    const dbk = await dbkRegistry.getDbk(master, result.dbkId);
    expect(dbk).toBeDefined();

    await expect(
      dbkRegistry.saveDbk(ownerContext(), {
        ...dbk!,
        status: 'SUSPENDED',
      }),
    ).rejects.toThrow(/Immutable DBK field 'status'/);
  });

  it('blocks invalid lifecycle transitions at the registry boundary', async () => {
    const master = masterContext();
    const result = await provisioningService.provisionDbk(master, {
      dbkId: 'guard_school_03',
      legalName: 'Guard School Three',
      blueprintId: 'school_v1',
      primaryBranchName: 'Main Campus',
      subscriptionTier: 'FOUNDATION',
    });

    await expect(
      dbkRegistry.updateStatus(master, result.dbkId, 'ACTIVE'),
    ).rejects.toThrow(/Invalid DBK lifecycle transition/);
  });

  it('blocks a non-owner from mutating an unrelated DBK lifecycle', async () => {
    const master = masterContext();
    const result = await provisioningService.provisionDbk(master, {
      dbkId: 'guard_school_04',
      legalName: 'Guard School Four',
      blueprintId: 'school_v1',
      primaryBranchName: 'Main Campus',
      subscriptionTier: 'FOUNDATION',
    });

    const foreignOwner = {
      ...ownerContext(),
      requestId: 'guard-foreign',
      principal: {
        ...ownerContext().principal,
        id: 'different_owner',
      },
    };

    await expect(
      dbkRegistry.updateStatus(foreignOwner, result.dbkId, 'SUSPENDED'),
    ).rejects.toThrow();
  });
});
