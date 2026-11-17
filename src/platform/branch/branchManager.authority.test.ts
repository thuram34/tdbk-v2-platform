import { beforeEach, describe, expect, it } from 'vitest';
import type { SecurityContext } from '../../kernel/types';
import { AuthorizationError } from '../../kernel/errors/kernelErrors';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { dbkRegistry } from '../dbkRegistry';
import { provisioningService } from '../provisioning/provisioningService';
import { branchManager } from './branchManager';

function ownerContext(id: string): SecurityContext {
  return {
    requestId: `branch-authority-${id}`,
    correlationId: `branch-authority-correlation-${id}`,
    timestamp: new Date().toISOString(),
    principal: {
      id,
      email: `${id}@tdbk.test`,
      isMaster: false,
      tenantId: null,
      branchId: null,
      roles: ['BUSINESS_OWNER'],
      permissions: ['PORTFOLIO_READ', 'PORTFOLIO_WRITE', 'DBK_PROVISION'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'JWT',
    },
    tenantContext: null,
    branchContext: null,
  };
}

describe('persistent branch portfolio authority', () => {
  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
    dbkRegistry.clearStoreForTesting();
    provisioningService.clearStoreForTesting();
    branchManager.clearStoreForTesting();
  });

  it('allows an owner to read branches for a DBK in their authoritative portfolio', async () => {
    const owner = ownerContext('owner-a');
    const dbkId = 'branch_authority_owner_a';

    const provisioned = await provisioningService.provisionDbk(owner, {
      dbkId,
      legalName: 'Owner A Business',
      blueprintId: 'retail_v1',
      subscriptionTier: 'FREE',
      primaryBranchName: 'Mombasa',
      idempotencyKey: 'branch-authority-owner-a',
    });

    expect(provisioned.success).toBe(true);
    const branches = await branchManager.listPersistentBranches(owner, dbkId);
    expect(branches.length).toBeGreaterThan(0);
    expect(branches.every((branch) => branch.dbkId === dbkId)).toBe(true);
  });

  it('denies an owner from reading branches belonging to another portfolio', async () => {
    const ownerA = ownerContext('owner-a');
    const ownerB = ownerContext('owner-b');

    const resultA = await provisioningService.provisionDbk(ownerA, {
      dbkId: 'branch_authority_tenant_a',
      legalName: 'Owner A Business',
      blueprintId: 'retail_v1',
      subscriptionTier: 'FREE',
      idempotencyKey: 'branch-authority-tenant-a',
    });
    const resultB = await provisioningService.provisionDbk(ownerB, {
      dbkId: 'branch_authority_tenant_b',
      legalName: 'Owner B Business',
      blueprintId: 'retail_v1',
      subscriptionTier: 'FREE',
      idempotencyKey: 'branch-authority-tenant-b',
    });

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    await expect(
      branchManager.listPersistentBranches(ownerA, 'branch_authority_tenant_b'),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('keeps synchronous cache reads restricted to an exact tenant claim', () => {
    const owner = ownerContext('owner-a');
    expect(() => branchManager.getBranchesForDbk(owner, 'branch_authority_owner_a')).toThrow(
      /Tenant Isolation Violation/,
    );
  });
});
