import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { TestMemoryFirestoreDriver } from '../../persistence/firestore/driver/testMemoryFirestoreDriver';
import { agentExecutionRepository, AgentExecutionRecord } from '../../persistence/firestore/repositories/agentExecutionRepository';

describe('AgentExecutionRepository durable execution claims', () => {
  beforeEach(() => {
    firestoreClient.setDriverForTesting(new TestMemoryFirestoreDriver());
  });

  const record = (): AgentExecutionRecord => ({
    executionId: 'exec_atomic_1',
    instructionId: 'exec_atomic_1',
    tenantId: 'tenant_atomic',
    branchId: 'branch_hq',
    principalId: 'principal_1',
    instruction: 'Inspect DBKs',
    intent: 'TDBK_OPERATIONAL_INSPECTION',
    status: 'PLANNED',
    plan: { instructionId: 'exec_atomic_1', intent: 'TDBK_OPERATIONAL_INSPECTION', actions: [], generatedAt: new Date().toISOString() },
    results: [],
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  it('serializes concurrent claims for the same execution id', async () => {
    const [first, second] = await Promise.all([
      agentExecutionRepository.claim(record(), 'owner_a'),
      agentExecutionRepository.claim(record(), 'owner_b'),
    ]);

    expect([first.status, second.status].sort()).toEqual(['ACQUIRED', 'IN_PROGRESS']);
  });

  it('returns the completed authoritative record on replay instead of re-executing', async () => {
    const first = await agentExecutionRepository.claim(record(), 'owner_a');
    expect(first.status).toBe('ACQUIRED');

    await agentExecutionRepository.save({
      ...first.record,
      status: 'VERIFIED',
      completedAt: new Date().toISOString(),
      leaseOwner: 'owner_a',
    });

    const replay = await agentExecutionRepository.claim(record(), 'owner_b');
    expect(replay.status).toBe('COMPLETED');
    expect(replay.record.status).toBe('VERIFIED');
  });

  it('treats failed and authorization-required executions as terminal replays', async () => {
    const first = await agentExecutionRepository.claim(record(), 'owner_a');
    expect(first.status).toBe('ACQUIRED');

    await agentExecutionRepository.save({
      ...first.record,
      status: 'FAILED',
      completedAt: new Date().toISOString(),
      results: [{ actionId: 'a1', status: 'FAILED', error: 'provider timeout' }],
      leaseOwner: 'owner_a',
    });

    const replay = await agentExecutionRepository.claim(record(), 'owner_b');
    expect(replay.status).toBe('COMPLETED');
    expect(replay.record.status).toBe('FAILED');
    expect(replay.record.results[0]).toMatchObject({ actionId: 'a1', status: 'FAILED' });
  });

  it('rejects execution id reuse across tenant or principal identity', async () => {
    await agentExecutionRepository.claim(record(), 'owner_a');

    await expect(
      agentExecutionRepository.claim({ ...record(), tenantId: 'attacker_tenant' }, 'owner_b'),
    ).rejects.toThrow('Agent execution identity conflict');

    await expect(
      agentExecutionRepository.claim({ ...record(), principalId: 'attacker_principal' }, 'owner_c'),
    ).rejects.toThrow('Agent execution identity conflict');
  });
});
