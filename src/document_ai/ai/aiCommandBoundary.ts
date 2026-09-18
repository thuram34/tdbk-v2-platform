/**
 * TDBK V2 — AI → TDBK COMMAND BOUNDARY & PROPOSAL ENGINE
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION & AI ASSISTANCE
 * 
 * CORE CONTRACT:
 * - AI IS AN ASSISTANT. TDBK IS THE AUTHORITY.
 * - AI produces structured PROPOSALS (AiProposedAction), NEVER direct state mutations.
 * - AI CANNOT self-approve its own proposals.
 * - Human / Policy Review is mandatory before authoritative command execution.
 * - Authoritative TDBK engines validate permissions, tenant boundaries, branch scopes, and execute state changes.
 */

import { 
  AiProposedAction, 
  AiProposalType, 
  ProposalStatus, 
  DocumentMetadata 
} from '../types';
import { SecurityContext } from '../../kernel/types';
import { tenantIsolation } from '../../kernel/tenancy/tenantIsolation';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { aiSecurityGuard } from './aiSecurityGuard';
import { entityEngine } from '../../experience/entity/entityEngine';
import { eventBus } from '../../orchestration/events/eventBus';
import { branchManager } from '../../platform/branch/branchManager';
import { aiProposalRepository } from '../../persistence/firestore/repositories/aiProposalRepository';
import { ledgerService } from '../../finance/ledgerService';
import { financialTransactionService } from '../../finance/transactionService';
import { receiptService } from '../../finance/receiptService';
import { reconciliationService } from '../../finance/reconciliationService';
import type { OutboxRecord } from '../../persistence/types';

export class AiCommandBoundary {
  private static instance: AiCommandBoundary;

  // In-memory proposal registry: tenantId -> Map<proposalId, AiProposedAction>
  private proposals: Map<string, Map<string, AiProposedAction>> = new Map();

  private constructor() {}

  public static getInstance(): AiCommandBoundary {
    if (!AiCommandBoundary.instance) {
      AiCommandBoundary.instance = new AiCommandBoundary();
    }
    return AiCommandBoundary.instance;
  }

  public async createPersistentProposal(
    ctx: SecurityContext,
    params: {
      tenantId: string;
      branchId: string;
      documentId?: string;
      proposalType: AiProposalType;
      suggestedPayload: Record<string, any>;
      confidence: number;
      summary: string;
      sourceEvidence?: Record<string, any>;
      causationId?: string;
    }
  ): Promise<AiProposedAction> {
    tenantIsolation.assertTenantIsolation(ctx.principal, params.tenantId);

    // Validate branch existence
    if (params.branchId) {
      const branch = await branchManager.getPersistentBranch(ctx, params.tenantId, params.branchId);
      if (!branch) {
        throw new KernelError(
          'VALIDATION_ERROR',
          `Branch '${params.branchId}' does not exist for tenant '${params.tenantId}'`,
          400,
          ctx.requestId
        );
      }
    }

    // Validate security boundaries on proposed action
    aiSecurityGuard.validateProposalIntegrity(ctx, params.tenantId, {
      tenantId: params.tenantId,
      proposalType: params.proposalType,
      suggestedPayload: params.suggestedPayload,
    });

    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const proposal: AiProposedAction = {
      proposalId,
      documentId: params.documentId,
      tenantId: params.tenantId,
      branchId: params.branchId,
      proposalType: params.proposalType,
      suggestedPayload: params.suggestedPayload,
      confidence: params.confidence,
      summary: params.summary,
      status: 'PENDING_REVIEW',
      sourceEvidence: params.sourceEvidence,
      proposedAt: new Date().toISOString(),
      correlationId: ctx.correlationId,
      causationId: params.causationId || ctx.requestId,
    };

    if (!this.proposals.has(params.tenantId)) {
      this.proposals.set(params.tenantId, new Map());
    }
    this.proposals.get(params.tenantId)!.set(proposalId, proposal);
      action: 'AI_PROPOSAL_CREATED',
      targetResource: `proposal:${proposalId}`,
      outcome: 'ALLOWED',
      details: {
        proposalType: proposal.proposalType,
        confidence: proposal.confidence,
        documentId: proposal.documentId,
        summary: proposal.summary,
      }
    });

    // Persist the lifecycle event before publishing it to the in-process bus.
    // The outbox is the recovery authority if the process restarts after proposal creation.
    const proposalEvent = {
      eventId: `evt_proposal_generated_${proposalId}`,
      eventType: 'ai.proposal_generated.v1',
      eventVersion: 'v1',
      source: 'ai_command_boundary',
      tenantId: params.tenantId,
      branchId: params.branchId,
      principalId: ctx.principal.id,
      correlationId: ctx.correlationId || `corr_${proposalId}`,
      causationId: proposal.causationId,
      occurredAt: proposal.proposedAt,
      payload: { proposalId, proposalType: proposal.proposalType, confidence: proposal.confidence },
      metadata: {},
    };
    const outboxNow = new Date().toISOString();
    const proposalOutbox: OutboxRecord = {
      eventId: proposalEvent.eventId,
      tenantId: params.tenantId,
      branchId: params.branchId || null,
      eventType: proposalEvent.eventType,
      eventVersion: proposalEvent.eventVersion,
      occurredAt: proposalEvent.occurredAt,
      correlationId: proposalEvent.correlationId,
      causationId: proposalEvent.causationId || null,
      source: proposalEvent.source,
      payload: proposalEvent.payload,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: outboxNow,
      createdAt: outboxNow,
      updatedAt: outboxNow,
      leaseOwner: null,
      leaseUntil: null,
      lastError: null,
      deliveredAt: null,
    };
    // Proposal and lifecycle event are one durable unit. A process crash cannot
    // leave an accepted proposal without its recovery event.
    await aiProposalRepository.saveProposalWithOutbox(
      params.tenantId,
      proposalId,
      proposal,
      proposalEvent,
      proposalOutbox,
    );

    auditLogger.logAuditEvent(ctx, {
      action: 'AI_PROPOSAL_CREATED',
      targetResource: `proposal:${proposalId}`,
      outcome: 'ALLOWED',
      details: {
        proposalType: proposal.proposalType,
        confidence: proposal.confidence,
        documentId: proposal.documentId,
        summary: proposal.summary,
      }
    });
    await eventBus.publish(proposalEvent);

    return proposal;
  }

  /** Legacy synchronous API retained for deterministic unit tests. Production callers must await createPersistentProposal. */
  public createProposal(
    ctx: SecurityContext,
    params: {
      tenantId: string;
      branchId: string;
      documentId?: string;
      proposalType: AiProposalType;
      suggestedPayload: Record<string, any>;
      confidence: number;
      summary: string;
      sourceEvidence?: Record<string, any>;
      causationId?: string;
    }
  ): AiProposedAction {
    tenantIsolation.assertTenantIsolation(ctx.principal, params.tenantId);
    aiSecurityGuard.validateProposalIntegrity(ctx, params.tenantId, {
      tenantId: params.tenantId,
      proposalType: params.proposalType,
      suggestedPayload: params.suggestedPayload,
    });
    // Legacy synchronous API is test-only; production uses createPersistentProposal.
    // It must remain synchronous and therefore cannot perform a durable branch read.
    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const proposal: AiProposedAction = {
      proposalId, documentId: params.documentId, tenantId: params.tenantId, branchId: params.branchId,
      proposalType: params.proposalType, suggestedPayload: params.suggestedPayload, confidence: params.confidence,
      summary: params.summary, status: 'PENDING_REVIEW', sourceEvidence: params.sourceEvidence,
      proposedAt: new Date().toISOString(), correlationId: ctx.correlationId, causationId: params.causationId || ctx.requestId,
    };
    if (!this.proposals.has(params.tenantId)) this.proposals.set(params.tenantId, new Map());
    this.proposals.get(params.tenantId)!.set(proposalId, proposal);
    return proposal;
  }

  public getProposal(
    ctx: SecurityContext,
    tenantId: string,
    proposalId: string
  ): AiProposedAction | null {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);
    const tenantProposals = this.proposals.get(tenantId);
    return tenantProposals?.get(proposalId) || null;
  }

  public listProposals(
    ctx: SecurityContext,
    tenantId: string,
    status?: ProposalStatus
  ): AiProposedAction[] {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);
    const tenantProposals = this.proposals.get(tenantId);
    if (!tenantProposals) return [];

    let list = Array.from(tenantProposals.values());
    if (status) {
      list = list.filter(p => p.status === status);
    }
    return list;
  }

  public async getPersistentProposal(
    ctx: SecurityContext,
    tenantId: string,
    proposalId: string
  ): Promise<AiProposedAction | null> {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);
    const proposal = await aiProposalRepository.getProposal(tenantId, proposalId);
    if (proposal && proposal.tenantId !== tenantId) {
      throw new KernelError('FORBIDDEN_OPERATION' as any, 'AI proposal tenant boundary violation', 403, ctx.requestId);
    }
    return proposal;
  }

  public async listPersistentProposals(
    ctx: SecurityContext,
    tenantId: string,
    status?: ProposalStatus,
    branchId?: string
  ): Promise<AiProposedAction[]> {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);
    const proposals = await aiProposalRepository.listProposals(tenantId, branchId);
    return status ? proposals.filter((proposal) => proposal.status === status) : proposals;
  }

  /**
   * Approve and execute proposal through authoritative TDBK command execution
   */
  public async approveProposal(
    ctx: SecurityContext,
    tenantId: string,
    proposalId: string,
    adjustedPayload?: Record<string, any>
  ): Promise<{ success: boolean; proposal: AiProposedAction; recordId?: string }> {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    // AI CANNOT SELF-APPROVE: Caller must not be an automated AI system principal
    if (ctx.principal.id === 'AI_AGENT' || ctx.principal.id === 'TDBK_AI_ASSISTANT') {
      auditLogger.logAuditEvent(ctx, {
        action: 'AI_SELF_APPROVAL_BLOCKED',
        targetResource: `proposal:${proposalId}`,
        outcome: 'DENIED',
        details: { principalId: ctx.principal.id }
      });
      throw new KernelError(
        'FORBIDDEN_OPERATION' as any,
        'AI agents are strictly forbidden from self-approving proposals. Human authorization required.',
        403,
        ctx.requestId
      );
    }

    const proposal = await this.getPersistentProposal(ctx, tenantId, proposalId);
    if (!proposal) {
      throw new KernelError('NOT_FOUND', `Proposal ${proposalId} not found`, 404, ctx.requestId);
    }

    // Crash recovery: EXECUTING is a durable state. Before rejecting a retry,
    // reconstruct whether the authoritative command already committed. This closes
    // the crash window between the domain mutation and proposal finalization.
    if (proposal.status === 'EXECUTING') {
      const executionRecordId = proposal.executionResult?.recordId;
      if (proposal.proposalType === 'PROPOSE_RECORD_PAYMENT') {
        const transactionId = String(executionRecordId || proposal.suggestedPayload.transactionId || `txn_ai_${proposalId}`);
        const recovered = await financialTransactionService.get(tenantId, transactionId);
        if (recovered?.status === 'POSTED') {
          await receiptService.createFromPostedTransaction(tenantId, transactionId, ctx.principal.id);
          const recoveredProposal = await aiProposalRepository.transitionProposal(
            tenantId, proposalId, 'EXECUTING', 'APPROVED', ctx.principal.id, proposal.suggestedPayload,
            {
              executionResult: {
                success: true,
                executedCommand: proposal.proposalType,
                recordId: transactionId,
                executedAt: recovered.postedAt || new Date().toISOString(),
              },
            }
          );
          return { success: true, proposal: recoveredProposal, recordId: transactionId };
        }
      }

      if (proposal.proposalType === 'PROPOSE_ADMIT_STUDENT' || proposal.proposalType === 'PROPOSE_BOOK_WAYBILL') {
        const entityType = proposal.proposalType === 'PROPOSE_ADMIT_STUDENT' ? 'student_records' : 'waybill_booking';
        const records = await entityEngine.listPersistentRecords(ctx, tenantId, entityType, proposal.branchId);
        const recovered = executionRecordId
          ? records.find((record) => record.id === executionRecordId)
          : undefined;
        if (recovered) {
          const recoveredProposal = await aiProposalRepository.transitionProposal(
            tenantId, proposalId, 'EXECUTING', 'APPROVED', ctx.principal.id, proposal.suggestedPayload,
            {
              executionResult: {
                success: true,
                executedCommand: proposal.proposalType,
                recordId: recovered.id,
                executedAt: recovered.updatedAt,
              },
            }
          );
          return { success: true, proposal: recoveredProposal, recordId: recovered.id };
        }
      }

      throw new KernelError(
        'CONFLICT',
        `Proposal '${proposalId}' is EXECUTING and has no recoverable authoritative result yet.`,
        409,
        ctx.requestId
      );
    }

    if (proposal.status !== 'PENDING_REVIEW') {
      throw new KernelError(
        'ILLEGAL_STATE_TRANSITION' as any,
        `Cannot approve proposal in state ${proposal.status}`,
        400,
        ctx.requestId
      );
    }

    const finalPayload = adjustedPayload || proposal.suggestedPayload;

    // Perform all caller authorization checks before reserving the proposal.
    // A failed authorization must never leave a proposal stranded in EXECUTING.
    switch (proposal.proposalType) {
      case 'PROPOSE_ADMIT_STUDENT':
        if (!rbacEngine.hasPermission(ctx.principal, 'school:write') && !ctx.principal.isMaster) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Permission school:write required', 403, ctx.requestId);
        }
        break;
      case 'PROPOSE_BOOK_WAYBILL':
        if (!rbacEngine.hasPermission(ctx.principal, 'waybill:write') && !ctx.principal.isMaster) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Permission waybill:write required', 403, ctx.requestId);
        }
        break;
      case 'PROPOSE_RECORD_PAYMENT':
        if (!rbacEngine.hasPermission(ctx.principal, 'finance:receive') && !ctx.principal.isMaster) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Permission finance:receive required', 403, ctx.requestId);
        }
        break;
      case 'PROPOSE_RECONCILE_TRANSACTION':
        if (!rbacEngine.hasPermission(ctx.principal, 'mpesa:reconcile') && !ctx.principal.isMaster) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Permission mpesa:reconcile required', 403, ctx.requestId);
        }
        break;
      case 'PROPOSE_CREATE_INVOICE':
        throw new KernelError('NOT_IMPLEMENTED', 'Invoice proposals require the authoritative invoice engine; no generic POS fallback is permitted.', 501, ctx.requestId);
      default:
        throw new KernelError('VALIDATION_ERROR', `Unsupported AI proposal type '${proposal.proposalType}'`, 400, ctx.requestId);
    }

    // Atomically reserve the proposal before executing the authoritative command.
    // This prevents two reviewers/processes from executing the same proposal concurrently.
    const executingProposal = await aiProposalRepository.transitionProposal(
      tenantId,
      proposalId,
      'PENDING_REVIEW',
      'EXECUTING',
      ctx.principal.id,
      finalPayload,
    );
    proposal.status = executingProposal.status;
    proposal.reviewedBy = executingProposal.reviewedBy;
    proposal.reviewedAt = executingProposal.reviewedAt;
    proposal.suggestedPayload = executingProposal.suggestedPayload;
    let executedRecordId: string | undefined;

    try {
      // Route to authoritative engine based on proposal type.
      switch (proposal.proposalType) {
        case 'PROPOSE_ADMIT_STUDENT': {
          const student = await entityEngine.createPersistentRecord(ctx, tenantId, 'student_records', {
            id: executionRecordId || `ai_student_${proposalId}`,\n            admissionNo: finalPayload.admissionNumber || `ADM-${Date.now()}`,
            fullName: finalPayload.studentName || 'Student Name',
            grade: finalPayload.gradeLevel || 'Grade 1',
            branchId: proposal.branchId,
            sourceDocId: proposal.documentId,
          });
          executedRecordId = student.recordId;
          break;
        }
        case 'PROPOSE_BOOK_WAYBILL': {
          const wb = await entityEngine.createPersistentRecord(ctx, tenantId, 'waybill_booking', {
            id: executionRecordId || `ai_waybill_${proposalId}`,\n            waybillNo: finalPayload.waybillNumber || `WB-${Date.now()}`,
            consignor: finalPayload.consignor || 'Consignor',
            consignee: finalPayload.consignee || 'Consignee',
            weightKg: finalPayload.weightKg || 100,
            status: 'PENDING_DISPATCH',
            branchId: proposal.branchId,
          });
          executedRecordId = wb.recordId;
          break;
        }
        case 'PROPOSE_RECORD_PAYMENT': {
          const transactionId = String(finalPayload.transactionId || `txn_ai_${proposalId}`);
          const providerReference = String(finalPayload.providerReference || finalPayload.mpesaReceiptNumber || transactionId);
          const amount = Number(finalPayload.amount);
          if (!Number.isFinite(amount) || amount <= 0) throw new KernelError('VALIDATION_ERROR', 'AI payment proposal requires a positive amount', 400, ctx.requestId);
          const now = new Date().toISOString();
          const transaction = {
            transactionId,
            tenantId,
            branchId: proposal.branchId,
            source: 'MPESA' as const,
            providerReference,
            amount,
            currency: String(finalPayload.currency || 'KES'),
            status: 'POSTED' as const,
            description: String(finalPayload.description || 'AI-approved payment'),
            correlationId: ctx.correlationId || proposalId,
            createdAt: now,
            postedAt: now,
            reversedAt: null,
          };
          await ledgerService.post(transaction, [
            { entryId: `${transactionId}_receivable`, transactionId, tenantId, account: 'RECEIVABLES:PAYMENTS', entryType: 'DEBIT', amount, currency: transaction.currency, createdAt: now, immutable: true },
            { entryId: `${transactionId}_cash`, transactionId, tenantId, account: 'CASH:MPESA', entryType: 'CREDIT', amount, currency: transaction.currency, createdAt: now, immutable: true },
          ]);
          await receiptService.createFromPostedTransaction(tenantId, transactionId, ctx.principal.id);
          executedRecordId = transactionId;
          break;
        }
        case 'PROPOSE_RECONCILE_TRANSACTION': {
          const transactionId = String(finalPayload.transactionId || '');
          if (!transactionId) throw new KernelError('VALIDATION_ERROR', 'Reconciliation proposal requires transactionId', 400, ctx.requestId);
          const existing = await financialTransactionService.get(tenantId, transactionId);
          if (!existing) throw new KernelError('NOT_FOUND', `Financial transaction '${transactionId}' not found`, 404, ctx.requestId);
          const entries = await ledgerService.entries(tenantId, transactionId);
          if (existing.status === 'RECONCILIATION_REQUIRED') {
            const confirmed = { ...existing, status: 'POSTED' as const, postedAt: existing.postedAt || new Date().toISOString() };
            await reconciliationService.resolveConfirmed(confirmed, entries);
          } else if (existing.status !== 'POSTED') {
            throw new KernelError('ILLEGAL_STATE_TRANSITION', `Transaction '${transactionId}' cannot be reconciled from state '${existing.status}'`, 400, ctx.requestId);
          }
          executedRecordId = transactionId;
          break;
        }
        case 'PROPOSE_CREATE_INVOICE':
          throw new KernelError('NOT_IMPLEMENTED', 'Invoice proposals require the authoritative invoice engine; no generic POS fallback is permitted.', 501, ctx.requestId);
        default:
          throw new KernelError('VALIDATION_ERROR', `Unsupported AI proposal type '${proposal.proposalType}'`, 400, ctx.requestId);
      }
    } catch (error: any) {
      // Never leave an approved proposal stranded in EXECUTING after a failed command.
      const failedProposal = await aiProposalRepository.transitionProposal(
        tenantId,
        proposalId,
        'EXECUTING',
        'FAILED',
        ctx.principal.id,
      );
      failedProposal.executionResult = {
        success: false,
        executedCommand: failedProposal.proposalType,
        executedAt: new Date().toISOString(),
      };
      failedProposal.rejectionReason = error?.message || 'Authoritative command execution failed';
      await aiProposalRepository.saveProposal(tenantId, proposalId, failedProposal);
      throw error;
    }
    proposal.status = 'APPROVED';
    proposal.reviewedBy = ctx.principal.id;
    proposal.reviewedAt = new Date().toISOString();
    proposal.executionResult = {
      success: true,
      executedCommand: proposal.proposalType,
      recordId: executedRecordId,
      executedAt: new Date().toISOString(),
    };
    await aiProposalRepository.saveProposal(tenantId, proposalId, proposal);

    await auditLogger.persistEvent(auditLogger.logAuditEvent(ctx, {
      action: 'AI_PROPOSAL_APPROVED',
      targetResource: `proposal:${proposalId}`,
      outcome: 'ALLOWED',
      details: {
        proposalType: proposal.proposalType,
        executedRecordId,
        reviewedBy: ctx.principal.id,
      }
    }));

    return {
      success: true,
      proposal,
      recordId: executedRecordId,
    };
  }

  public async rejectProposal(
    ctx: SecurityContext,
    tenantId: string,
    proposalId: string,
    reason: string
  ): Promise<AiProposedAction> {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const proposal = await this.getPersistentProposal(ctx, tenantId, proposalId);
    if (!proposal) {
      throw new KernelError('NOT_FOUND', `Proposal ${proposalId} not found`, 404, ctx.requestId);
    }

    if (proposal.status !== 'PENDING_REVIEW') {
      throw new KernelError(
        'ILLEGAL_STATE_TRANSITION' as any,
        `Cannot reject proposal in state ${proposal.status}`,
        400,
        ctx.requestId
      );
    }

    // Atomically transition PENDING_REVIEW -> REJECTED so concurrent approval
    // cannot race with this rejection and overwrite the terminal decision.
    const rejectedProposal = await aiProposalRepository.transitionProposal(
      tenantId,
      proposalId,
      'PENDING_REVIEW',
      'REJECTED',
      ctx.principal.id,
      undefined,
      { rejectionReason: reason },
    );

    await auditLogger.persistEvent(auditLogger.logAuditEvent(ctx, {
      action: 'AI_PROPOSAL_REJECTED',
      targetResource: `proposal:${proposalId}`,
      outcome: 'ALLOWED',
      details: {
        reason,
        reviewedBy: ctx.principal.id,
      }
    }));

    return rejectedProposal;
  }
}

export const aiCommandBoundary = AiCommandBoundary.getInstance();
