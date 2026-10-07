import { describe, expect, it, beforeEach } from 'vitest';
import { rbacEngine } from '../authorization/rbacEngine';
import { spaceMembershipRepository } from '../../persistence/firestore/repositories/spaceMembershipRepository';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { Principal } from '../types';

const tenantId = 'dbk_rbac_membership_001';

function principal(overrides: Partial<Principal> = {}): Principal {
  return {
    id: 'usr_rbac_staff_001',
    email: 'staff@example.test',
    isMaster: false,
    tenantId,
    branchId: null,
    roles: ['STAFF'],
    permissions: [],
    authTime: Math.floor(Date.now() / 1000),
    tokenSource: 'SESSION',
    ...overrides,
  };
}

describe('DBK membership runtime RBAC', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('authorizes a role and permission from the active DBK membership', async () => {
    await spaceMembershipRepository.saveMembership({
      membershipId: 'mem_rbac_001',
      userId: 'usr_rbac_staff_001',
      spaceId: 'dbk_rbac_membership_001_hq',
      tenantId,
      role: 'STAFF',
      roleTitle: 'Staff',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      permissions: ['POS_OPERATE'],
    });

    const result = await rbacEngine.authorizeAsync(
      principal(),
      'operate',
      'pos:sale',
      {
        tenantId,
        requiredRole: 'STAFF',
        requiredPermission: 'POS_OPERATE',
      },
    );

    expect(result.allowed).toBe(true);
  });

  it('denies tenant access when the identity has stale claims but no active DBK membership', async () => {
    const result = await rbacEngine.authorizeAsync(
      principal({ permissions: ['POS_OPERATE'] }),
      'operate',
      'pos:sale',
      {
        tenantId,
        requiredRole: 'STAFF',
        requiredPermission: 'POS_OPERATE',
      },
    );

    expect(result.allowed).toBe(false);
    expect(result.ruleEvaluated).toBe('MEMBERSHIP_AUTHORITY_RULE');
  });

  it('allows tenant-wide owner authority to operate an unlisted secondary branch', async () => {
    await spaceMembershipRepository.saveMembership({
      membershipId: 'mem_owner_branch_001',
      userId: 'usr_rbac_staff_001',
      spaceId: 'dbk_rbac_membership_001_hq',
      tenantId,
      role: 'OWNER_OPERATOR',
      roleTitle: 'Business Owner / Operator',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      permissions: ['POS_OPERATE'],
    });

    const result = await rbacEngine.authorizeAsync(
      principal({ roles: ['OWNER_OPERATOR'], permissions: ['POS_OPERATE'] }),
      'operate',
      'pos:sale',
      {
        tenantId,
        branchId: 'secondary_branch_001',
        requiredRole: 'OWNER_OPERATOR',
        requiredPermission: 'POS_OPERATE',
      },
    );

    expect(result.allowed).toBe(true);
  });

  it('denies a revoked membership even if old identity claims still contain the permission', async () => {
    await spaceMembershipRepository.saveMembership({
      membershipId: 'mem_rbac_002',
      userId: 'usr_rbac_staff_001',
      spaceId: 'dbk_rbac_membership_001_hq',
      tenantId,
      role: 'STAFF',
      roleTitle: 'Staff',
      status: 'SUSPENDED',
      joinedAt: new Date().toISOString(),
      permissions: ['POS_OPERATE'],
    });

    const result = await rbacEngine.authorizeAsync(
      principal({ permissions: ['POS_OPERATE'] }),
      'operate',
      'pos:sale',
      {
        tenantId,
        requiredPermission: 'POS_OPERATE',
      },
    );

    expect(result.allowed).toBe(false);
    expect(result.ruleEvaluated).toBe('MEMBERSHIP_AUTHORITY_RULE');
  });
});
