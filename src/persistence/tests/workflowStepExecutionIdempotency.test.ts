import { describe, expect, it, beforeEach } from 'vitest';
import { firestoreClient } from '../firestore/firestoreClient';
import { workflowStepExecutionRepository } from '../firestore/repositories/workflowStepExecutionRepository';

describe('workflow step execution lease idempotency', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('rejects a second claim while the existing execution lease is active, including for the same worker', async () => {
    const first = await workflowStepExecutionRepository.claimExecution(
      'tenant_idempotency',
      'wf_idempotency',
      'step_1',
      'exec_wf_idempotency_step_1',
      'worker_1',
      300_000,
    );

    const second = await workflowStepExecutionRepository.claimExecution(
      'tenant_idempotency',
      'wf_idempotency',
      'step_1',
      'exec_wf_idempotency_step_1',
      'worker_1',
      300_000,
    );

    expect(first?.status).toBe('EXECUTING');
    expect(first?.attemptCount).toBe(1);
    expect(second).toBeNull();

    const durable = await workflowStepExecutionRepository.getExecution(
      'tenant_idempotency',
      'exec_wf_idempotency_step_1',
    );
    expect(durable?.attemptCount).toBe(1);
    expect(durable?.workerId).toBe('worker_1');
  });
});
