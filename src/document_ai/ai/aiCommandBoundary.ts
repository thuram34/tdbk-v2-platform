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

    // Validate branch existence
    if (params.branchId) {
      const branch = branchManager.getBranch(ctx, params.tenantId, params.branchId);
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
    void aiProposalRepository.saveProposal(params.tenantId, proposalId, proposal);

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

    eventBus.publish({
      eventId: `evt_prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType: 'ai.proposal_generated.v1',
      eventVersion: 'v1',
      source: 'ai_command_boundary',
      tenantId: params.tenantId,
      branchId: params.branchId,
      principalId: ctx.principal.id,
      correlationId: ctx.correlationId || `corr_${Date.now()}`,
      causationId: null,
      occurredAt: new Date().toISOString(),
      payload: { proposalId, proposalType: proposal.proposalType, confidence: proposal.confidence },
      metadata: {},
    });

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

    const proposal = this.getProposal(ctx, tenantId, proposalId);
    if (!proposal) {
      throw new KernelError('NOT_FOUND', `Proposal ${proposalId} not found`, 404, ctx.requestId);
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
    let executedRecordId: string | undefined;

    // Route to authoritative engine based on proposal type and verify permissions
    switch (proposal.proposalType) {
      case 'PROPOSE_ADMIT_STUDENT': {
        if (!rbacEngine.hasPermission(ctx.principal, 'school:write') && !ctx.principal.isMaster) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Permission school:write required', 403, ctx.requestId);
        }
        const student = await entityEngine.createPersistentRecord(ctx, tenantId, 'student_records', {
          admissionNo: finalPayload.admissionNumber || `ADM-${Date.now()}`,
          fullName: finalPayload.studentName || 'Student Name',
          grade: finalPayload.gradeLevel || 'Grade 1',
          branchId: proposal.branchId,
          sourceDocId: proposal.documentId,
        });
        executedRecordId = student.recordId;
        break;
      }

      case 'PROPOSE_BOOK_WAYBILL': {
        if (!rbacEngine.hasPermission(ctx.principal, 'waybill:write') && !ctx.principal.isMaster) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Permission waybill:write required', 403, ctx.requestId);
        }
        const wb = await entityEngine.createPersistentRecord(ctx, tenantId, 'waybill_booking', {
          waybillNo: finalPayload.waybillNumber || `WB-${Date.now()}`,
          consignor: finalPayload.consignor || 'Consignor',
          consignee: finalPayload.consignee || 'Consignee',
          weightKg: finalPayload.weightKg || 100,
          status: 'PENDING_DISPATCH',
          branchId: proposal.branchId,
        });
        executedRecordId = wb.recordId;
        break;
      }

      case 'PROPOSE_CREATE_INVOICE':
      case 'PROPOSE_RECORD_PAYMENT':
      case 'PROPOSE_RECONCILE_TRANSACTION':
      default: {
        // Generic entity recording or ledger dispatch
        const record = await entityEngine.createPersistentRecord(ctx, tenantId, 'pos_register', {
          ...finalPayload,
          approvedBy: ctx.principal.id,
          sourceProposalId: proposalId,
          branchId: proposal.branchId,
        });
        executedRecordId = record.recordId;
        break;
      }
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
    void aiProposalRepository.saveProposal(tenantId, proposalId, proposal);

    auditLogger.logAuditEvent(ctx, {
      action: 'AI_PROPOSAL_APPROVED',
      targetResource: `proposal:${proposalId}`,
      outcome: 'ALLOWED',
      details: {
        proposalType: proposal.proposalType,
        executedRecordId,
        reviewedBy: ctx.principal.id,
      }
    });

    return {
      success: true,
      proposal,
      recordId: executedRecordId,
    };
  }

  public rejectProposal(
    ctx: SecurityContext,
    tenantId: string,
    proposalId: string,
    reason: string
  ): AiProposedAction {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const proposal = this.getProposal(ctx, tenantId, proposalId);
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

    proposal.status = 'REJECTED';
    proposal.reviewedBy = ctx.principal.id;
    proposal.reviewedAt = new Date().toISOString();
    proposal.rejectionReason = reason;

    auditLogger.logAuditEvent(ctx, {
      action: 'AI_PROPOSAL_REJECTED',
      targetResource: `proposal:${proposalId}`,
      outcome: 'ALLOWED',
      details: {
        reason,
        reviewedBy: ctx.principal.id,
      }
    });

    return proposal;
  }
}

export const aiCommandBoundary = AiCommandBoundary.getInstance();
