/**
 * TDBK V2 — BRANCH REPOSITORY
 * Firestore Path: /tenants/{tenantId}/branches/{branchId}
 */

import { IBranchRepository } from '../../types';
import { DbkBranch } from '../../../platform/types';
import { firestoreClient } from '../firestoreClient';

export class BranchRepository implements IBranchRepository {
  private static instance: BranchRepository;

  private constructor() {}

  public static getInstance(): BranchRepository {
    if (!BranchRepository.instance) {
      BranchRepository.instance = new BranchRepository();
    }
    return BranchRepository.instance;
  }

  private getPath(tenantId: string, branchId: string): string {
    return `/tenants/${tenantId}/branches/${branchId}`;
  }

  public async saveBranch(tenantId: string, branchId: string, branch: DbkBranch): Promise<void> {
    if (branch.dbkId !== tenantId || branch.branchId !== branchId) {
      throw new Error('Branch tenant/identity boundary violation.');
    }
    await firestoreClient.runTransaction(async (transaction) => {
      const path = this.getPath(tenantId, branchId);
      const existing = await transaction.get<DbkBranch>(path);
      if (existing) {
        if (existing.dbkId !== tenantId || existing.branchId !== branchId) {
          throw new Error('Durable branch identity boundary violation.');
        }
        // Idempotent replay is allowed only when the immutable branch identity
        // remains the same. Never silently overwrite an existing branch.
        if (existing.name !== branch.name || existing.type !== branch.type || existing.isHeadquarters !== branch.isHeadquarters) {
          throw new Error(`Branch '${branchId}' already exists with conflicting immutable attributes.`);
        }
        return;
      }
      await transaction.set(path, branch as unknown as Record<string, unknown>);
    });
  }

  public async getBranch(tenantId: string, branchId: string): Promise<DbkBranch | null> {
    return await firestoreClient.get<DbkBranch>(this.getPath(tenantId, branchId));
  }

  public async listBranches(tenantId: string): Promise<DbkBranch[]> {
    return await firestoreClient.listCollection<DbkBranch>(`/tenants/${tenantId}/branches`);
  }

  public async deleteBranch(tenantId: string, branchId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, branchId));
  }
}

export const branchRepository = BranchRepository.getInstance();
