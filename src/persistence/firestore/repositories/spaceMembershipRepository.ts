/**
 * TDBK V2 — DURABLE SPACE MEMBERSHIP REPOSITORY
 * Canonical path: /tenants/{tenantId}/memberships/{membershipId}
 */
import { SpaceMembership } from '../../../coherence/types';
import { firestoreClient } from '../firestoreClient';

export class SpaceMembershipRepository {
  private static instance: SpaceMembershipRepository;
  private constructor() {}
  public static getInstance(): SpaceMembershipRepository {
    if (!SpaceMembershipRepository.instance) SpaceMembershipRepository.instance = new SpaceMembershipRepository();
    return SpaceMembershipRepository.instance;
  }
  private path(tenantId: string, membershipId: string): string {
    return '/tenants/' + tenantId + '/memberships/' + membershipId;
  }
  public async saveMembership(membership: SpaceMembership): Promise<void> {
    if (!membership.tenantId || !membership.membershipId || !membership.userId || !membership.spaceId) {
      throw new Error('Invalid space membership: tenantId, membershipId, userId and spaceId are required.');
    }
    await firestoreClient.set(this.path(membership.tenantId, membership.membershipId), membership as unknown as Record<string, unknown>);
  }
  public async getMembership(tenantId: string, membershipId: string): Promise<SpaceMembership | null> {
    return await firestoreClient.get<SpaceMembership>(this.path(tenantId, membershipId));
  }
  public async listMemberships(tenantId: string, userId?: string, spaceId?: string): Promise<SpaceMembership[]> {
    const memberships = await firestoreClient.listCollection<SpaceMembership>('/tenants/' + tenantId + '/memberships');
    return memberships.filter((m) => (!userId || m.userId === userId) && (!spaceId || m.spaceId === spaceId));
  }
}
export const spaceMembershipRepository = SpaceMembershipRepository.getInstance();