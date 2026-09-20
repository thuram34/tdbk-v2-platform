import { describe, expect, it, beforeEach } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { spaceMembershipRepository } from '../persistence/firestore/repositories/spaceMembershipRepository';
import { SpaceMembership } from './types';

function membership(tenantId: string, id: string, userId: string, spaceId: string, role: string): SpaceMembership {
  return {
    membershipId: id,
    userId,
    spaceId,
    tenantId,
    role,
    roleTitle: role,
    status: 'ACTIVE',
    joinedAt: new Date().toISOString(),
    permissions: ['students:read'],
  };
}

describe('Durable space membership persistence', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('reconstructs memberships after a simulated server restart', async () => {
    const tenantId = 'tenant_membership_restart';
    const saved = membership(tenantId, 'membership_restart_001', 'user_restart_001', 'space_restart_001', 'TEACHER');

    await spaceMembershipRepository.saveMembership(saved);
    firestoreClient.simulateServerRestart();

    const reconstructed = await spaceMembershipRepository.listMemberships(tenantId, saved.userId);

    expect(reconstructed).toEqual([saved]);
  });

  it('does not leak memberships across tenant boundaries', async () => {
    const userId = 'user_isolation_001';
    const tenantA = membership('tenant_isolation_a', 'membership_a_001', userId, 'space_a', 'TEACHER');
    const tenantB = membership('tenant_isolation_b', 'membership_b_001', userId, 'space_b', 'FINANCE_VIEWER');

    await spaceMembershipRepository.saveMembership(tenantA);
    await spaceMembershipRepository.saveMembership(tenantB);

    const aMemberships = await spaceMembershipRepository.listMemberships(tenantA.tenantId, userId);
    const bMemberships = await spaceMembershipRepository.listMemberships(tenantB.tenantId, userId);

    expect(aMemberships).toEqual([tenantA]);
    expect(bMemberships).toEqual([tenantB]);
    expect(aMemberships.some((item) => item.tenantId !== tenantA.tenantId)).toBe(false);
    expect(bMemberships.some((item) => item.tenantId !== tenantB.tenantId)).toBe(false);
  });
});
