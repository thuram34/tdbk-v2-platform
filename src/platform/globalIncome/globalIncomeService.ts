import { SecurityContext } from '../../kernel/types';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { BlueprintValidator } from '../../blueprint/validator';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { globalIncomeRepository } from '../../persistence/firestore/repositories/globalIncomeRepository';
import { ApplicationRecord, ApplicationStatus } from './applicationTypes';
import { buildOpportunityDeduplicationKey } from './deduplication';
import { scoreOpportunity } from './scoring';
import {
  ApprovalRequest, Opportunity, OpportunityEvidence, OpportunityScoreDimensions, OpportunityStage,
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
      !roles.some((role) => ['BUSINESS_OWNER', 'OWNER_OPERATOR', 'TENANT_ADMIN', 'TDBK_AUTOMATION'].includes(role))) {
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
    if (!opportunity.title?.trim() || !opportunity.identity?.employerOrClient?.trim() || !opportunity.identity?.roleOrProject?.trim()) {
      throw new KernelError('VALIDATION_ERROR', 'Opportunity title, employer/client and role/project are required.', 400, context.requestId);
    }
    const expectedKey = buildOpportunityDeduplicationKey(opportunity.identity);
    if (expectedKey !== opportunity.deduplicationKey) throw new KernelError('VALIDATION_ERROR', 'Opportunity deduplication key does not match its source identity.', 400, context.requestId);
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

  async verifyOpportunity(context: SecurityContext, tenantId: string, id: string, evidence: OpportunityEvidence): Promise<Opportunity> {
    this.assertTenant(context, tenantId, 'verify global income opportunity');
    this.assertOwnerOrAdmin(context);
    if (!evidence?.evidenceType?.trim() || !evidence.sourceUrl || !evidence.summary?.trim() || !Number.isFinite(evidence.confidence) || evidence.confidence < 0 || evidence.confidence > 1) {
      throw new KernelError('VALIDATION_ERROR', 'Evidence URL, summary and confidence from 0 to 1 are required.', 400, context.requestId);
    }
    const source = new URL(evidence.sourceUrl);
    if (!['http:', 'https:'].includes(source.protocol)) throw new KernelError('VALIDATION_ERROR', 'Evidence must use HTTP or HTTPS.', 400, context.requestId);
    const current = await globalIncomeRepository.getOpportunity(tenantId, id);
    if (!current) throw new KernelError('NOT_FOUND', 'Opportunity not found.', 404, context.requestId);
    const updated: Opportunity = {
      ...current, verificationStatus: 'VERIFIED',
      evidence: [...current.evidence, { ...evidence, observedAt: evidence.observedAt || new Date().toISOString() }],
      lastVerifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await globalIncomeRepository.updateOpportunity(tenantId, updated);
    this.audit(context, 'GLOBAL_INCOME_OPPORTUNITY_VERIFIED', `opportunity:${id}`, { evidenceType: evidence.evidenceType, sourceUrl: evidence.sourceUrl });
    return updated;
  }

  async scoreOpportunityRecord(context: SecurityContext, tenantId: string, id: string, dimensions: OpportunityScoreDimensions, hardExclusionReasons: string[] = []): Promise<Opportunity> {
    this.assertTenant(context, tenantId, 'score global income opportunity');
    const current = await globalIncomeRepository.getOpportunity(tenantId, id);
    if (!current) throw new KernelError('NOT_FOUND', 'Opportunity not found.', 404, context.requestId);
    if (current.verificationStatus !== 'VERIFIED') throw new KernelError('VALIDATION_ERROR', 'Verify the source before scoring.', 409, context.requestId);
    if (!Array.isArray(hardExclusionReasons) || hardExclusionReasons.some((reason) => typeof reason !== 'string')) {\n      throw new KernelError('VALIDATION_ERROR', 'Hard exclusion reasons must be a list of text values.', 400, context.requestId);\n    }\n    const score = scoreOpportunity({ dimensions, hardExclusionReasons });
    const updated: Opportunity = {
      ...current, score, hardExclusionReasons: score.hardExclusionReasons,
      updatedAt: new Date().toISOString(),
    };
    await globalIncomeRepository.updateOpportunity(tenantId, updated);
    this.audit(context, 'GLOBAL_INCOME_OPPORTUNITY_SCORED', `opportunity:${id}`, { total: score.total, eligible: score.eligible });
    return updated;
  }

  async transitionOpportunity(context: SecurityContext, tenantId: string, id: string, next: OpportunityStage): Promise<Opportunity> {
    this.assertTenant(context, tenantId, 'transition global income opportunity');
    const current = await globalIncomeRepository.getOpportunity(tenantId, id);
    if (next === 'VERIFIED' && (current?.verificationStatus !== 'VERIFIED' || !current.evidence?.length)) {
      throw new KernelError('VALIDATION_ERROR', 'Verification requires VERIFIED status and source evidence.', 409, context.requestId);
    }
    if (next === 'QUALIFIED' && (!current?.score?.eligible || current.score.total < 60)) {
      throw new KernelError('VALIDATION_ERROR', 'Qualification requires an eligible score of at least 60.', 409, context.requestId);
    }
    if (next === 'SUBMITTED' && ((current?.applicationCostAmount ?? 0) > 0 || current?.channel === 'upwork' || current?.channel === 'direct_b2b')) {
      const approvals = await globalIncomeRepository.listApprovals(tenantId);
      const approved = approvals.some((approval) =>
        approval.targetId === id && approval.status === 'APPROVED' &&
        (current?.channel === 'upwork' ? ['SUBMIT_PAID_APPLICATION', 'CONFIRM_UPWORK_PROPOSAL'].includes(approval.action) : current?.channel === 'direct_b2b' ? approval.action === 'SEND_DIRECT_OUTREACH' : approval.action === 'SUBMIT_PAID_APPLICATION')
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
    this.assertTenant(context, tenantId, 'request global income approval');
    this.assertOwnerOrAdmin(context);
    const allowedActions = ['SUBMIT_PAID_APPLICATION', 'CONFIRM_UPWORK_PROPOSAL', 'SEND_DIRECT_OUTREACH', 'PUBLISH_GIG', 'CHANGE_PROFILE', 'WRITE_CRM', 'ACCEPT_OFFER', 'ACCEPT_CONTRACT', 'SIGN_LEGAL_DOCUMENT', 'DISCLOSE_SENSITIVE_INFORMATION', 'PURCHASE_CREDITS', 'BOOST_PROFILE'];
    if (!allowedActions.includes(input.action)) throw new KernelError('VALIDATION_ERROR', 'Unsupported approval action.', 400, context.requestId);
    if (['SUBMIT_PAID_APPLICATION', 'PURCHASE_CREDITS', 'BOOST_PROFILE'].includes(input.action) && !input.termsOrCost?.trim()) {
      throw new KernelError('VALIDATION_ERROR', 'Cost and terms must be stated for paid actions.', 400, context.requestId);
    }
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
    this.assertTenant(context, tenantId, 'decide global income approval');
    this.assertOwnerOrAdmin(context);
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
    if (input.channel !== opportunity.channel || input.kind !== opportunity.kind) {
      throw new KernelError('VALIDATION_ERROR', 'Application channel and kind must match the linked opportunity.', 400, context.requestId);
    }
    if (!['DRAFT', 'READY', 'AWAITING_APPROVAL'].includes(input.status)) {
      throw new KernelError('VALIDATION_ERROR', 'New applications must start as DRAFT, READY or AWAITING_APPROVAL.', 400, context.requestId);
    }
    const now = new Date().toISOString();
    const requiresApproval = !!input.requiresApproval || opportunity.channel === 'upwork' || opportunity.channel === 'direct_b2b' || (opportunity.applicationCostAmount ?? 0) > 0;
    const record: ApplicationRecord = { ...input, requiresApproval, tenantId, createdAt: now, updatedAt: now };
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
    if (next === 'SUBMITTED') {
      this.assertOwnerOrAdmin(context);
      const opportunity = await globalIncomeRepository.getOpportunity(tenantId, current.opportunityId);
      const requiresApproval = !!current.requiresApproval || opportunity?.channel === 'upwork' || opportunity?.channel === 'direct_b2b' || (opportunity?.applicationCostAmount ?? 0) > 0;
      if (requiresApproval) {
        if (!current.approvalId) throw new KernelError('AUTHORIZATION_ERROR', 'This application requires an approved authorization record.', 403, context.requestId);
        const approval = await globalIncomeRepository.getApproval(tenantId, current.approvalId);
        const permittedActions = opportunity?.channel === 'upwork'
          ? ['CONFIRM_UPWORK_PROPOSAL', 'SUBMIT_PAID_APPLICATION']
          : opportunity?.channel === 'direct_b2b'
            ? ['SEND_DIRECT_OUTREACH']
            : ['SUBMIT_PAID_APPLICATION'];
        if (!approval || approval.status !== 'APPROVED' || approval.targetId !== current.opportunityId || !permittedActions.includes(approval.action)) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Application submission is blocked until its matching approval is approved.', 403, context.requestId);
        }
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
