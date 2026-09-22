import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { TestMemoryFirestoreDriver } from '../../persistence/firestore/driver/testMemoryFirestoreDriver';
import { agentExecutionRepository, AgentExecutionRecord } from '../../persistence/firestore/repositories/agentExecutionRepository';

describe('AgentExecutionRepository durable execution claims', () => {
  beforeEach(() => {
    firestoreClient.setDriverForTesting(new TestMemoryFirestoreDriver());
  });

  const record = (): AgentExecutionRecord => ({
    executionId: 'exec_atomic_1', instructionId: 'exec_atomic_1', tenantId: 'tenant_atomic', branchId: 'branch_hq',
    principalId: 'principal_1', instruction: 'Inspect DBKs', intent: 'TDBK_OPERATIONAL_INSPECTION', status: 'PLANNED',
    plan: { instructionId: 'exec_atomic_1', intent: 'TDBK_OPERATIONAL_INSPECTION', actions: [], generatedAt: new Date().toISOString() },
    results: [], createdAt: new Date().toISOString(), completedAt: new Date().toISOString(),
  } as AgentExecutionRecord);

  it('blocks a second claim while the first durable lease is active', async () => {
    const first = await agentExecutionRepository.claim(record(), 'owner_a');
    expect(first.status).toBe('ACQUIRED');
    const second = await agentExecutionRepository.claim(record(), 'owner_b');
    expect(second.status).toBe('IN_PROGRESS');
  });

  it('returns the completed authoritative record on replay instead of re-executing', async () => {
    const first = await agentExecutionRepository.claim(record(), 'owner_a');
    expect(first.status).toBe('ACQUIRED');
    await agentExecutionRepository.save({ ...first.record, status: 'VERIFIED', completedAt: new Date().toISOString(), leaseOwner: 'owner_a' });
    const replay = await agentExecutionRepository.claim(record(), 'owner_b');
    expect(replay.status).toBe('COMPLETED');
    expect(replay.record.status).toBe('VERIFIED');
  });

  it('keeps tenant execution ledgers isolated and rejects same-tenant principal reuse', async () => {
    const first = await agentExecutionRepository.claim(record(), 'owner_a');
    expect(first.status).toBe('ACQUIRED');
    const otherTenant = await agentExecutionRepository.claim({ ...record(), tenantId: 'other_tenant' }, 'owner_b');
    expect(otherTenant.status).toBe('ACQUIRED');
    await expect(
      agentExecutionRepository.claim({ ...record(), principalId: 'attacker_principal' }, 'owner_c'),
    ).rejects.toThrow('Agent execution identity conflict');
  });
});
