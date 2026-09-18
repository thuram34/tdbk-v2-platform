/**
 * TDBK V2 — AI PROPOSAL REPOSITORY
 * Firestore Path: /tenants/{tenantId}/ai_proposals/{proposalId}
 */

import { IAiProposalRepository } from '../../types';
import { AiProposedAction } from '../../../document_ai/types';
import { firestoreClient } from '../firestoreClient';
import type { EventEnvelope } from '../../../orchestration/events/types';
import type { OutboxRecord } from '../../types';

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

  /** Atomically persists an AI proposal and its lifecycle outbox event. */
  public async saveProposalWithOutbox(
    tenantId: string,
    proposalId: string,
    proposal: AiProposedAction,
    event: EventEnvelope,
    outboxRecord: OutboxRecord
  ): Promise<void> {
    await firestoreClient.runTransaction(async (transaction) => {
      await transaction.set(this.getPath(tenantId, proposalId), proposal as unknown as Record<string, unknown>);
      await transaction.set(
        '/tenants/' + tenantId + '/outbox/' + event.eventId,
        outboxRecord as unknown as Record<string, unknown>
      );
    });
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
      const terminalStatuses = new Set<import('../../../document_ai/types').ProposalStatus>(['APPROVED', 'FAILED', 'REJECTED']);
      const isTerminalTransition = terminalStatuses.has(nextStatus);
      const terminalEventType = nextStatus === 'APPROVED'
        ? 'ai.proposal_approved.v1'
        : nextStatus === 'FAILED'
          ? 'ai.proposal_failed.v1'
          : 'ai.proposal_rejected.v1';

      // Terminal lifecycle events are part of the same transaction as the
      // authoritative proposal transition. This prevents a terminal proposal
      // from existing without its recovery/notification event after a crash.
      if (proposal.status === nextStatus && isTerminalTransition) {
        const eventId = `evt_proposal_${nextStatus.toLowerCase()}_${proposalId}`;
        const existingEvent = await transaction.get<OutboxRecord>(`/tenants/${tenantId}/outbox/${eventId}`);
        if (!existingEvent) {
          const now = new Date().toISOString();
          const event: EventEnvelope = {
            eventId,
            eventType: terminalEventType,
            eventVersion: 'v1',
            source: 'ai_proposal_repository',
            tenantId,
            branchId: proposal.branchId,
            principalId: reviewedBy,
            correlationId: proposal.correlationId || `corr_${proposalId}`,
            causationId: proposal.causationId,
            occurredAt: proposal.reviewedAt || proposal.proposedAt,
            payload: {
              proposalId,
              proposalType: proposal.proposalType,
              status: proposal.status,
              executionResult: proposal.executionResult || null,
              rejectionReason: proposal.rejectionReason || null,
            },
            metadata: {},
          };
          const outbox: OutboxRecord = {
            eventId,
            tenantId,
            branchId: proposal.branchId || null,
            eventType: event.eventType,
            eventVersion: event.eventVersion,
            occurredAt: event.occurredAt,
            correlationId: event.correlationId,
            causationId: event.causationId || null,
            source: event.source,
            payload: event.payload,
            status: 'PENDING',
            attemptCount: 0,
            availableAt: now,
            createdAt: now,
            updatedAt: now,
            leaseOwner: null,
            leaseUntil: null,
            lastError: null,
            deliveredAt: null,
          };
          await transaction.set(`/tenants/${tenantId}/outbox/${eventId}`, outbox as unknown as Record<string, unknown>);
        }
        return proposal;
      }

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

      if (isTerminalTransition) {
        const now = new Date().toISOString();
        const eventId = `evt_proposal_${nextStatus.toLowerCase()}_${proposalId}`;
        const event: EventEnvelope = {
          eventId,
          eventType: terminalEventType,
          eventVersion: 'v1',
          source: 'ai_proposal_repository',
          tenantId,
          branchId: updated.branchId,
          principalId: reviewedBy,
          correlationId: updated.correlationId || `corr_${proposalId}`,
          causationId: updated.causationId,
          occurredAt: updated.reviewedAt || now,
          payload: {
            proposalId,
            proposalType: updated.proposalType,
            status: updated.status,
            executionResult: updated.executionResult || null,
            rejectionReason: updated.rejectionReason || null,
          },
          metadata: {},
        };
        const outbox: OutboxRecord = {
          eventId,
          tenantId,
          branchId: updated.branchId || null,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          occurredAt: event.occurredAt,
          correlationId: event.correlationId,
          causationId: event.causationId || null,
          source: event.source,
          payload: event.payload,
          status: 'PENDING',
          attemptCount: 0,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
          leaseOwner: null,
          leaseUntil: null,
          lastError: null,
          deliveredAt: null,
        };
        await transaction.set(`/tenants/${tenantId}/outbox/${eventId}`, outbox as unknown as Record<string, unknown>);
      }
      return updated;
    });
  }
}

export const aiProposalRepository = AiProposalRepository.getInstance();
