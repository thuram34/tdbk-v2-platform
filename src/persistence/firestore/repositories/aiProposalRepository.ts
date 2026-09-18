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

  public async transitionProposal(
    tenantId: string,
    proposalId: string,
    expectedStatus: import('../../../document_ai/types').ProposalStatus,
    nextStatus: import('../../../document_ai/types').ProposalStatus,
    reviewedBy: string,
    adjustedPayload?: Record<string, any>,
    metadataPatch?: Partial<Pick<AiProposedAction, 'rejectionReason' | 'executionResult'>>
  ): Promise<AiProposedAction> {
    return await firestoreClient.runTransaction(async (transaction) => {
      const path = this.getPath(tenantId, proposalId);
      const proposal = await transaction.get<AiProposedAction>(path);
      if (!proposal) throw new Error(`Proposal '${proposalId}' not found.`);
      if (proposal.tenantId !== tenantId) throw new Error('AI proposal tenant boundary violation.');
      if (proposal.status !== expectedStatus) {
        throw new Error(`Proposal '${proposalId}' is already ${proposal.status}; expected ${expectedStatus}.`);
      }
      const updated: AiProposedAction = {
        ...proposal,
        status: nextStatus,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        ...(adjustedPayload !== undefined ? { suggestedPayload: adjustedPayload } : {}),
        ...(metadataPatch || {}),
      };
      await transaction.set(path, updated as unknown as Record<string, unknown>);
      return updated;
    });
  }
}

export const aiProposalRepository = AiProposalRepository.getInstance();
