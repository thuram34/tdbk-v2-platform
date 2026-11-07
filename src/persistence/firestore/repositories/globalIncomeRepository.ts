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
      const existing = await tx.get<Opportunity>(path);
      if (existing) {
        if (existing.deduplicationKey !== item.deduplicationKey) throw new Error('Opportunity ID collision.');
        return existing;
      }
      const duplicate = (await firestoreClient.listCollection<Opportunity>(`/tenants/${tenantId}/global_income_opportunities`))
        .find((candidate) => candidate.deduplicationKey === item.deduplicationKey);
      if (duplicate) return duplicate;
      await tx.set(path, item as unknown as Record<string, unknown>);
      return item;
    });
  }

  async getOpportunity(tenantId: string, id: string): Promise<Opportunity | null> {
    return firestoreClient.get<Opportunity>(this.opportunityPath(tenantId, id));
  }
  async listOpportunities(tenantId: string): Promise<Opportunity[]> {
    return firestoreClient.listCollection<Opportunity>(`/tenants/${tenantId}/global_income_opportunities`);
  }
  async updateOpportunity(tenantId: string, item: Opportunity): Promise<void> {
    if (item.ownerId !== tenantId) throw new Error('Opportunity tenant identity mismatch.');
    await firestoreClient.runTransaction(async (tx) => {
      const path = this.opportunityPath(tenantId, item.opportunityId);
      const existing = await tx.get<Opportunity>(path);
      if (!existing || existing.ownerId !== tenantId) throw new Error('Opportunity not found in tenant scope.');
      await tx.set(path, item as unknown as Record<string, unknown>);
    });
  }

  async createApproval(tenantId: string, item: ApprovalRequest): Promise<ApprovalRequest> {
    if (item.ownerId !== tenantId) throw new Error('Approval tenant identity mismatch.');
    return firestoreClient.runTransaction(async (tx) => {
      const path = this.approvalPath(tenantId, item.approvalId);
      const existing = await tx.get<ApprovalRequest>(path);
      if (existing) return existing;
      await tx.set(path, item as unknown as Record<string, unknown>);
      return item;
    });
  }
  async getApproval(tenantId: string, id: string): Promise<ApprovalRequest | null> {
    return firestoreClient.get<ApprovalRequest>(this.approvalPath(tenantId, id));
  }
  async listApprovals(tenantId: string): Promise<ApprovalRequest[]> {
    return firestoreClient.listCollection<ApprovalRequest>(`/tenants/${tenantId}/global_income_approvals`);
  }
  async decideApproval(tenantId: string, id: string, status: 'APPROVED' | 'REJECTED', note: string | null): Promise<ApprovalRequest> {
    return firestoreClient.runTransaction(async (tx) => {
      const path = this.approvalPath(tenantId, id);
      const existing = await tx.get<ApprovalRequest>(path);
      if (!existing) throw new Error('Approval request not found.');
      if (existing.status !== 'PENDING') throw new Error(`Approval is already ${existing.status.toLowerCase()}.`);
      const updated: ApprovalRequest = { ...existing, status, decidedAt: new Date().toISOString(), decisionNote: note };
      await tx.set(path, updated as unknown as Record<string, unknown>);
      return updated;
    });
  }

  async createApplication(tenantId: string, item: ApplicationRecord): Promise<ApplicationRecord> {
    if (item.tenantId !== tenantId) throw new Error('Application tenant identity mismatch.');
    return firestoreClient.runTransaction(async (tx) => {
      const path = this.applicationPath(tenantId, item.applicationId);
      const existing = await tx.get<ApplicationRecord>(path);
      if (existing) return existing;
      await tx.set(path, item as unknown as Record<string, unknown>);
      return item;
    });
  }
  async getApplication(tenantId: string, id: string): Promise<ApplicationRecord | null> {
    return firestoreClient.get<ApplicationRecord>(this.applicationPath(tenantId, id));
  }
  async listApplications(tenantId: string): Promise<ApplicationRecord[]> {
    return firestoreClient.listCollection<ApplicationRecord>(`/tenants/${tenantId}/global_income_applications`);
  }
  async updateApplication(tenantId: string, item: ApplicationRecord): Promise<void> {
    if (item.tenantId !== tenantId) throw new Error('Application tenant identity mismatch.');
    await firestoreClient.runTransaction(async (tx) => {
      const path = this.applicationPath(tenantId, item.applicationId);
      const existing = await tx.get<ApplicationRecord>(path);
      if (!existing) throw new Error('Application record not found.');
      await tx.set(path, item as unknown as Record<string, unknown>);
    });
  }
}
export const globalIncomeRepository = GlobalIncomeRepository.getInstance();
