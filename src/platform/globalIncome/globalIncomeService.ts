import { SecurityContext } from '../../kernel/types';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { BlueprintValidator } from '../../blueprint/validator';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { globalIncomeRepository } from '../../persistence/firestore/repositories/globalIncomeRepository';
import { ApplicationRecord, ApplicationStatus } from './applicationTypes';\nimport { buildOpportunityDeduplicationKey } from './deduplication';
import {
  ApprovalRequest, Opportunity, OpportunityStage,
} from './types';

const OPPORTUNITY_TRANSITIONS: Record<OpportunityStage, OpportunityStage[]> = {
  DISCOVERED: ['VERIFIED', 'EXCLUDED'],
  VERIFIED: ['QUALIFIED', 'EXCLUDED'],
  QUALIFIED: ['PREPARED', 'EXCLUDED'],
  PREPARED: ['AWAITING_APPROVAL', 'SUBMITTED', 'EXCLUDED'],
  AWAITING_APPROVAL: ['PREPARED', 'SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['ACKNOWLEDGED', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'WON', 'LOST', 'WITHDRAWN'],
  ACKNOWLEDGED: ['INTERVIEW', 'ASSESSMENT', 'OFFER', 'WON', 'LOST', 'WITHDRAWN'],
  INTERVIEW: ['ASSESSMENT', 'OFFER', 'WON', 'LOST', 'WITHDRAWN'],
  ASSESSMENT: ['INTERVIEW', 'OFFER', 'WON', 'LOST', 'WITHDRAWN'],
  OFFER: ['WON', 'LOST', 'WITHDRAWN'],
  WON: [],
  LOST: [],
  WITHDRAWN: [],
  EXCLUDED: [],
};

const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['READY', 'WITHDRAWN'],
  READY: ['AWAITING_APPROVAL', 'SUBMITTED', 'WITHDRAWN'],
  AWAITING_APPROVAL: ['READY', 'SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['ACKNOWLEDGED', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'WON', 'LOST', 'WITHDRAWN'],
  ACKNOWLEDGED: ['INTERVIEW', 'ASSESSMENT', 'OFFER', 'WON', 'LOST', 'WITHDRAWN'],
  INTERVIEW: ['ASSESSMENT', 'OFFER', 'WON', 'LOST', 'WITHDRAWN'],
  ASSESSMENT: ['INTERVIEW', 'OFFER', 'WON', 'LOST', 'WITHDRAWN'],
  OFFER: ['WON', 'LOST', 'WITHDRAWN'],
  WON: [],
  LOST: [],
  WITHDRAWN: [],
};

export class GlobalIncomeService {
  private assertTenant(context: SecurityContext, tenantId: string, action: string): void {
    if (!tenantId || !context?.principal?.id) {
      throw new KernelError('AUTHENTICATION_ERROR', 'Authenticated tenant context is required.', 401, context?.requestId);
    }
    if (!masterAuthority.isMasterAdmin(context.principal)) {
      BlueprintValidator.assertTenantAccess(context, tenantId, action);
    }
  }

  private assertOwnerOrAdmin(context: SecurityContext): void {
    const roles = context.principal.roles || [];
    if (!masterAuthority.isMasterAdmin(context.principal) &&
      !roles.some((role) => ['BUSINESS_OWNER', 'OWNER_OPERATOR', 'TENANT_ADMIN'].includes(role))) {
      throw new KernelError('AUTHORIZATION_ERROR', 'Owner or tenant administrator authority is required.', 403, context.requestId);
    }
  }

  private audit(context: SecurityContext, action: string, resource: string, details: Record<string, unknown>): void {
    auditLogger.logEvent('WORKFLOW_EXECUTION', context.principal.id, action, resource, 'ALLOWED', {
      tenantId: context.principal.tenantId,
      branchId: context.principal.branchId,
      requestId: context.requestId,
      details,
    });
  }

  async createOpportunity(context: SecurityContext, opportunity: Opportunity): Promise<Opportunity> {
    const tenantId = opportunity.ownerId;
    this.assertTenant(context, tenantId, 'create global income opportunity');
    const now = new Date().toISOString();
    const item = { ...opportunity, createdAt: opportunity.createdAt || now, updatedAt: now };
    const saved = await globalIncomeRepository.createOpportunity(tenantId, item);
    this.audit(context, 'GLOBAL_INCOME_OPPORTUNITY_CREATED', `opportunity:${saved.opportunityId}`, { channel: saved.channel, stage: saved.stage });
    return saved;
  }

  async listOpportunities(context: SecurityContext, tenantId: string): Promise<Opportunity[]> {
    this.assertTenant(context, tenantId, 'list global income opportunities');
    return globalIncomeRepository.listOpportunities(tenantId);
  }

  async transitionOpportunity(context: SecurityContext, tenantId: string, id: string, next: OpportunityStage): Promise<Opportunity> {
    this.assertTenant(context, tenantId, 'transition global income opportunity');
    const current = await globalIncomeRepository.getOpportunity(tenantId, id);
    if (next === 'VERIFIED' && (current?.verificationStatus !== 'VERIFIED' || !current.evidence?.length)) {\n      throw new KernelError('VALIDATION_ERROR', 'Verification requires VERIFIED status and source evidence.', 409, context.requestId);\n    }\n    if (next === 'QUALIFIED' && (!current?.score?.eligible || current.score.total < 60)) {\n      throw new KernelError('VALIDATION_ERROR', 'Qualification requires an eligible score of at least 60.', 409, context.requestId);\n    }\n    if (next === 'SUBMITTED' && (current?.applicationCostAmount && current.applicationCostAmount > 0 || current?.channel === 'upwork')) {
      const approvals = await globalIncomeRepository.listApprovals(tenantId);
      const approved = approvals.some((approval) =>
        approval.targetId === id && approval.status === 'APPROVED' &&
        (approval.action === 'SUBMIT_PAID_APPLICATION' || approval.action === 'CONFIRM_UPWORK_PROPOSAL')
      );
      if (!approved) throw new KernelError('AUTHORIZATION_ERROR', 'This submission requires an approved application authorization.', 403, context.requestId);
    }
    if (!current) throw new KernelError('NOT_FOUND', 'Opportunity not found.', 404, context.requestId);
    if (!OPPORTUNITY_TRANSITIONS[current.stage].includes(next)) {
      throw new KernelError('VALIDATION_ERROR', `Invalid opportunity transition: ${current.stage} -> ${next}`, 409, context.requestId);
    }
    const updated = { ...current, stage: next, updatedAt: new Date().toISOString() };
    await globalIncomeRepository.updateOpportunity(tenantId, updated);
    this.audit(context, 'GLOBAL_INCOME_OPPORTUNITY_TRANSITIONED', `opportunity:${id}`, { from: current.stage, to: next });
    return updated;
  }

  async createApproval(context: SecurityContext, input: Omit<ApprovalRequest, 'ownerId' | 'status' | 'requestedAt' | 'decidedAt' | 'decisionNote'>): Promise<ApprovalRequest> {
    const tenantId = context.principal.tenantId;
    if (!tenantId) throw new KernelError('AUTHENTICATION_ERROR', 'Tenant context is required.', 401, context.requestId);
    this.assertTenant(context, tenantId, 'request global income approval');\n    this.assertOwnerOrAdmin(context);
    const approval: ApprovalRequest = {
      ...input, ownerId: tenantId, status: 'PENDING', requestedAt: new Date().toISOString(),
      decidedAt: null, decisionNote: null,
    };
    const saved = await globalIncomeRepository.createApproval(tenantId, approval);
    this.audit(context, 'GLOBAL_INCOME_APPROVAL_REQUESTED', `approval:${saved.approvalId}`, { action: saved.action, targetId: saved.targetId });
    return saved;
  }

  async listApprovals(context: SecurityContext, tenantId: string): Promise<ApprovalRequest[]> {
    this.assertTenant(context, tenantId, 'list global income approvals');
    return globalIncomeRepository.listApprovals(tenantId);
  }

  async decideApproval(context: SecurityContext, tenantId: string, id: string, decision: 'APPROVED' | 'REJECTED', note: string | null): Promise<ApprovalRequest> {
    this.assertTenant(context, tenantId, 'decide global income approval');\n    this.assertOwnerOrAdmin(context);
    const result = await globalIncomeRepository.decideApproval(tenantId, id, decision, note);
    this.audit(context, 'GLOBAL_INCOME_APPROVAL_DECIDED', `approval:${id}`, { decision, action: result.action });
    return result;
  }

  async createApplication(context: SecurityContext, input: Omit<ApplicationRecord, 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<ApplicationRecord> {
    const tenantId = context.principal.tenantId;
    if (!tenantId) throw new KernelError('AUTHENTICATION_ERROR', 'Tenant context is required.', 401, context.requestId);
    this.assertTenant(context, tenantId, 'create application ledger record');
    const opportunity = await globalIncomeRepository.getOpportunity(tenantId, input.opportunityId);
    if (!opportunity) throw new KernelError('NOT_FOUND', 'Linked opportunity not found.', 404, context.requestId);
    const now = new Date().toISOString();
    const record: ApplicationRecord = { ...input, tenantId, createdAt: now, updatedAt: now };
    const saved = await globalIncomeRepository.createApplication(tenantId, record);
    this.audit(context, 'GLOBAL_INCOME_APPLICATION_CREATED', `application:${saved.applicationId}`, { opportunityId: saved.opportunityId, status: saved.status });
    return saved;
  }

  async listApplications(context: SecurityContext, tenantId: string): Promise<ApplicationRecord[]> {
    this.assertTenant(context, tenantId, 'list application ledger');
    return globalIncomeRepository.listApplications(tenantId);
  }

  async transitionApplication(context: SecurityContext, tenantId: string, id: string, next: ApplicationStatus, evidenceUrls?: string[]): Promise<ApplicationRecord> {
    this.assertTenant(context, tenantId, 'transition application ledger');
    const current = await globalIncomeRepository.getApplication(tenantId, id);
    if (!current) throw new KernelError('NOT_FOUND', 'Application record not found.', 404, context.requestId);
    if (next === 'SUBMITTED' && current.requiresApproval) {
      if (!current.approvalId) throw new KernelError('AUTHORIZATION_ERROR', 'This application requires an approved authorization record.', 403, context.requestId);
      const approval = await globalIncomeRepository.getApproval(tenantId, current.approvalId);
      if (!approval || approval.status !== 'APPROVED') {
        throw new KernelError('AUTHORIZATION_ERROR', 'Application submission is blocked until its approval is approved.', 403, context.requestId);
      }
    }
    if (!APPLICATION_TRANSITIONS[current.status].includes(next)) {
      throw new KernelError('VALIDATION_ERROR', `Invalid application transition: ${current.status} -> ${next}`, 409, context.requestId);
    }
    const now = new Date().toISOString();
    const updated: ApplicationRecord = {
      ...current, status: next, updatedAt: now,
      submittedAt: next === 'SUBMITTED' ? now : current.submittedAt,
      evidenceUrls: evidenceUrls ? [...new Set([...current.evidenceUrls, ...evidenceUrls])] : current.evidenceUrls,
    };
    await globalIncomeRepository.updateApplication(tenantId, updated);
    this.audit(context, 'GLOBAL_INCOME_APPLICATION_TRANSITIONED', `application:${id}`, { from: current.status, to: next });
    return updated;
  }
}
export const globalIncomeService = new GlobalIncomeService();
