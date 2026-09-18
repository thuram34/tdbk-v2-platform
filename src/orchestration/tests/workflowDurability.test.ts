import { describe, expect, it, beforeEach } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { workflowStepExecutionRepository } from '../../persistence/firestore/repositories/workflowStepExecutionRepository';

describe('TDBK V2 — Durable Workflow Step Execution', () => {
  const tenantId = 'tenant_workflow_durable_01';

  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('survives process restart and does not re-execute a completed step', async () => {
    const executionKey = 'exec_restart_01';
    const claimed = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_01', 'step_01', executionKey, 'worker_01', 300000
    );

    expect(claimed?.status).toBe('EXECUTING');
    expect(claimed?.attemptCount).toBe(1);

    await workflowStepExecutionRepository.completeExecution(
      tenantId, executionKey, 'worker_01', { authoritativeId: 'record_01' }
    );

    firestoreClient.simulateServerRestart();

    const recovered = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_01', 'step_01', executionKey, 'worker_02', 300000
    );

    expect(recovered?.status).toBe('COMPLETED');
    expect(recovered?.attemptCount).toBe(1);
    expect(recovered?.output).toEqual({ authoritativeId: 'record_01' });
  });

  it('prevents concurrent workers from claiming an active execution', async () => {
    const executionKey = 'exec_concurrent_01';
    const first = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_02', 'step_01', executionKey, 'worker_01', 300000
    );
    const second = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_02', 'step_01', executionKey, 'worker_02', 300000
    );

    expect(first?.workerId).toBe('worker_01');
    expect(second).toBeNull();
  });

  it('reclaims an expired execution lease and increments the attempt', async () => {
    const executionKey = 'exec_reclaim_01';
    const first = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_03', 'step_01', executionKey, 'worker_01', 1
    );
    expect(first?.attemptCount).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 5));

    const reclaimed = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_03', 'step_01', executionKey, 'worker_02', 300000
    );

    expect(reclaimed?.status).toBe('EXECUTING');
    expect(reclaimed?.workerId).toBe('worker_02');
    expect(reclaimed?.attemptCount).toBe(2);
  });

  it('rejects completion by a stale worker after lease ownership changes', async () => {
    const executionKey = 'exec_stale_01';
    await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_04', 'step_01', executionKey, 'worker_01', 1
    );

    await new Promise((resolve) => setTimeout(resolve, 5));

    const reclaimed = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_04', 'step_01', executionKey, 'worker_02', 300000
    );
    expect(reclaimed?.workerId).toBe('worker_02');

    await expect(
      workflowStepExecutionRepository.completeExecution(
        tenantId, executionKey, 'worker_01', { stale: true }
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    const authoritative = await workflowStepExecutionRepository.getExecution(tenantId, executionKey);
    expect(authoritative?.status).toBe('EXECUTING');
    expect(authoritative?.workerId).toBe('worker_02');
  });
});
