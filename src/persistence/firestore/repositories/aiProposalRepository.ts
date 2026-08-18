/**
 * TDBK V2 — AI PROPOSAL REPOSITORY
 * Firestore Path: /tenants/{tenantId}/ai_proposals/{proposalId}
 */

import { IAiProposalRepository } from '../../types';
import { AiProposedAction } from '../../../document_ai/types';
import { firestoreClient } from '../firestoreClient';

export class AiProposalRepository implements IAiProposalRepository {
  private static instance: AiProposalRepository;

  private constructor() {}

  public static getInstance(): AiProposalRepository {
    if (!AiProposalRepository.instance) {
      AiProposalRepository.instance = new AiProposalRepository();
    }
    return AiProposalRepository.instance;
  }

  private getPath(tenantId: string, proposalId: string): string {
    return `/tenants/${tenantId}/ai_proposals/${proposalId}`;
  }

  public async saveProposal(
    tenantId: string,
    proposalId: string,
    proposal: AiProposedAction
  ): Promise<void> {
    await firestoreClient.set(
      this.getPath(tenantId, proposalId),
      proposal as unknown as Record<string, unknown>
    );
  }

  public async getProposal(tenantId: string, proposalId: string): Promise<AiProposedAction | null> {
    return await firestoreClient.get<AiProposedAction>(this.getPath(tenantId, proposalId));
  }

  public async listProposals(tenantId: string, branchId?: string | null): Promise<AiProposedAction[]> {
    const proposals = await firestoreClient.listCollection<AiProposedAction>(
      `/tenants/${tenantId}/ai_proposals`
    );
    if (branchId) {
      return proposals.filter((p) => !p.branchId || p.branchId === branchId);
    }
    return proposals;
  }

  public async deleteProposal(tenantId: string, proposalId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, proposalId));
  }
}

export const aiProposalRepository = AiProposalRepository.getInstance();
