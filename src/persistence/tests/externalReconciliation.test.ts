import { describe, expect, it, beforeEach } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { workflowStepExecutionRepository } from '../firestore/repositories/workflowStepExecutionRepository';

describe('durable external reconciliation', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('atomically resolves an ambiguous provider outcome as reconciled success', async () => {
    const tenantId = 'tenant_reconcile_001';
    const executionKey = 'exec_reconcile_001';

    await firestoreClient.set(`/tenants/${tenantId}/workflowExecutions/${executionKey}`, {
      executionKey,
      tenantId,
      workflowId: 'wf_reconcile_001',
      stepId: 'payment',
      attemptCount: 1,
      status: 'EXECUTING',
      output: null,
      error: null,
      workerId: null,
      leaseUntil: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      providerOperation: 'STK_PUSH',
      providerOperationIdentity: 'provider-op-reconcile-001',
      providerName: 'SAFARICOM_MPESA',
      providerReference: 'ws_CO_reconcile_001',
      providerIdempotencySupported: false,
      providerReconciliationSupported: true,
      outcomeState: 'RECONCILIATION_REQUIRED',
    });

    const result = await workflowStepExecutionRepository.recordReconciliation(
      tenantId,
      executionKey,
      'RECONCILED_SUCCESS',
      { resultCode: 0, receipt: 'ABC123' },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.outcomeState).toBe('RECONCILED_SUCCESS');
    expect(result.output).toEqual({ resultCode: 0, receipt: 'ABC123' });
  });

  it('refuses reconciliation when the provider has no reconciliation capability', async () => {
    const tenantId = 'tenant_reconcile_002';
    const executionKey = 'exec_reconcile_002';

    await firestoreClient.set(`/tenants/${tenantId}/workflowExecutions/${executionKey}`, {
      executionKey,
      tenantId,
      workflowId: 'wf_reconcile_002',
      stepId: 'notification',
      attemptCount: 1,
      status: 'EXECUTING',
      output: null,
      error: null,
      workerId: null,
      leaseUntil: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      providerName: 'SYSTEM_SMTP',
      providerReference: 'smtp-001',
      providerIdempotencySupported: false,
      providerReconciliationSupported: false,
      outcomeState: 'RECONCILIATION_REQUIRED',
    });

    await expect(
      workflowStepExecutionRepository.recordReconciliation(
        tenantId,
        executionKey,
        'RECONCILED_SUCCESS',
        { delivered: true },
      ),
    ).rejects.toThrow();
  });
});
