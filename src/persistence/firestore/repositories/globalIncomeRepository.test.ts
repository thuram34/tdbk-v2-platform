import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../firestoreClient';
import { globalIncomeRepository } from './globalIncomeRepository';
import { buildOpportunityDeduplicationKey } from '../../../platform/globalIncome/deduplication';
import type { Opportunity, ApprovalRequest } from '../../../platform/globalIncome/types';
import type { ApplicationRecord } from '../../../platform/globalIncome/applicationTypes';

const tenantId = 'tenant_income_test';
const now = '2026-11-07T00:00:00.000Z';
function opportunity(id: string): Opportunity {
  const identity = {
    employerOrClient: 'Example Employer',
    roleOrProject: 'Senior React Engineer',
    sourceUrl: 'https://example.com/jobs/123?utm_source=test',
  };
  return {
    opportunityId: id, ownerId: tenantId, kind: 'EMPLOYMENT', channel: 'remote_job_board',
    stage: 'DISCOVERED', verificationStatus: 'UNVERIFIED', identity,
    deduplicationKey: buildOpportunityDeduplicationKey(identity), title: 'React Engineer',
    descriptionSnapshot: 'Remote role', geography: 'Remote', compensationAmount: null,
    compensationCurrency: null, compensationPeriod: 'UNSPECIFIED', applicationCostAmount: null,
    applicationCostCurrency: null, evidence: [], hardExclusionReasons: [], score: null,
    nextAction: 'Verify source', discoveredAt: now, lastVerifiedAt: null, expiresAt: null,
    createdAt: now, updatedAt: now,
  };
}

describe('GlobalIncomeRepository', () => {
  beforeEach(() => firestoreClient.clearAllForTesting());

  it('deduplicates equivalent opportunities atomically within a tenant', async () => {
    const first = await globalIncomeRepository.createOpportunity(tenantId, opportunity('opp_first'));
    const second = await globalIncomeRepository.createOpportunity(tenantId, opportunity('opp_second'));
    expect(first.opportunityId).toBe('opp_first');
    expect(second.opportunityId).toBe('opp_first');
    expect(await globalIncomeRepository.listOpportunities(tenantId)).toHaveLength(1);
  });

  it('keeps opportunity records isolated by tenant', async () => {
    await globalIncomeRepository.createOpportunity(tenantId, opportunity('opp_one'));
    expect(await globalIncomeRepository.listOpportunities('another_tenant')).toEqual([]);
  });

  it('allows exactly one terminal approval decision', async () => {
    const approval: ApprovalRequest = {
      approvalId: 'approval_1', ownerId: tenantId, action: 'SEND_DIRECT_OUTREACH',
      targetId: 'opp_first', summary: 'Send approved outreach', termsOrCost: null,
      status: 'PENDING', requestedAt: now, decidedAt: null, decisionNote: null,
    };
    await globalIncomeRepository.createApproval(tenantId, approval);
    const decided = await globalIncomeRepository.decideApproval(tenantId, approval.approvalId, 'APPROVED', 'Reviewed');
    expect(decided.status).toBe('APPROVED');
    await expect(globalIncomeRepository.decideApproval(tenantId, approval.approvalId, 'REJECTED', null)).rejects.toThrow('already approved');
  });

  it('persists application ledger records separately from opportunities', async () => {
    const record: ApplicationRecord = {
      applicationId: 'app_1', tenantId, opportunityId: 'opp_first', channel: 'remote_job_board',
      kind: 'EMPLOYMENT', status: 'DRAFT', submittedAt: null, externalReference: null,
      evidenceUrls: [], notes: null, createdAt: now, updatedAt: now,
    };
    await globalIncomeRepository.createApplication(tenantId, record);
    expect(await globalIncomeRepository.listApplications(tenantId)).toEqual([record]);
    expect(await globalIncomeRepository.getOpportunity(tenantId, 'app_1')).toBeNull();
  });
});
