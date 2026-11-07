/**
 * Global Income Engine persistence.
 * Canonical tenant boundary: /tenants/{tenantId}/global_income_*
 * This repository is server-only and uses the established Firestore client.
 */
import { firestoreClient } from '../firestoreClient';
import { Opportunity, ApprovalRequest } from '../../../platform/globalIncome/types';
import { ApplicationRecord } from '../../../platform/globalIncome/applicationTypes';

export class GlobalIncomeRepository {
  private static instance: GlobalIncomeRepository;
  private constructor() {}
  public static getInstance(): GlobalIncomeRepository {
    if (!GlobalIncomeRepository.instance) GlobalIncomeRepository.instance = new GlobalIncomeRepository();
    return GlobalIncomeRepository.instance;
  }

  private opportunityPath(tenantId: string, id: string): string {
    return `/tenants/${tenantId}/global_income_opportunities/${id}`;
  }
  private dedupePath(tenantId: string, key: string): string {
    return `/tenants/${tenantId}/global_income_dedupe/${key}`;
  }
  private approvalPath(tenantId: string, id: string): string {
    return `/tenants/${tenantId}/global_income_approvals/${id}`;
  }
  private applicationPath(tenantId: string, id: string): string {
    return `/tenants/${tenantId}/global_income_applications/${id}`;
  }

  async createOpportunity(tenantId: string, item: Opportunity): Promise<Opportunity> {
    if (item.ownerId !== tenantId || !item.opportunityId) throw new Error('Opportunity tenant identity mismatch.');
    return firestoreClient.runTransaction(async (tx) => {
      const path = this.opportunityPath(tenantId, item.opportunityId);
      const dedupePath = this.dedupePath(tenantId, item.deduplicationKey);
      const [existing, dedupe] = await Promise.all([
        tx.get<Opportunity>(path),
        tx.get<{ opportunityId: string }>(dedupePath),
      ]);
      if (existing) {
        if (existing.deduplicationKey !== item.deduplicationKey) throw new Error('Opportunity ID collision.');
        return existing;
      }
      if (dedupe) {
        const canonical = await tx.get<Opportunity>(this.opportunityPath(tenantId, dedupe.opportunityId));
        if (canonical) return canonical;
        throw new Error('Opportunity deduplication index is inconsistent.');
      }
      await tx.set(path, item as unknown as Record<string, unknown>);
      await tx.set(dedupePath, { opportunityId: item.opportunityId });
      return item;
    });
  }
