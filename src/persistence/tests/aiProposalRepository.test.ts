import { afterEach, describe, expect, it, vi } from 'vitest';
import { firestoreClient } from '../firestore/firestoreClient';
import { aiProposalRepository } from '../firestore/repositories/aiProposalRepository';
import type { AiProposedAction } from '../../document_ai/types';

describe('AiProposalRepository branch isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('excludes unbound and other-branch proposals from a branch-scoped read', async () => {
    const proposals: AiProposedAction[] = [
      {
        proposalId: 'p-hq',
        tenantId: 'tenant-1',
        branchId: 'branch-hq',
        proposalType: 'PROPOSE_GENERAL_ENTRY',
        suggestedPayload: {},
        confidence: 1,
        summary: 'HQ proposal',
        status: 'PENDING_REVIEW',
        proposedAt: new Date().toISOString(),
        correlationId: 'corr-hq',
        causationId: 'cause-hq',
      },
      {
        proposalId: 'p-other',
        tenantId: 'tenant-1',
        branchId: 'branch-other',
        proposalType: 'PROPOSE_GENERAL_ENTRY',
        suggestedPayload: {},
        confidence: 1,
        summary: 'Other branch proposal',
        status: 'PENDING_REVIEW',
        proposedAt: new Date().toISOString(),
        correlationId: 'corr-other',
        causationId: 'cause-other',
      },
      {
        proposalId: 'p-unbound',
        tenantId: 'tenant-1',
        branchId: '',
        proposalType: 'PROPOSE_GENERAL_ENTRY',
        suggestedPayload: {},
        confidence: 1,
        summary: 'Unbound proposal',
        status: 'PENDING_REVIEW',
        proposedAt: new Date().toISOString(),
        correlationId: 'corr-unbound',
        causationId: 'cause-unbound',
      },
    ];

    vi.spyOn(firestoreClient, 'listCollection').mockResolvedValue(proposals);

    const result = await aiProposalRepository.listProposals('tenant-1', 'branch-hq');

    expect(result.map((proposal) => proposal.proposalId)).toEqual(['p-hq']);
  });
});
