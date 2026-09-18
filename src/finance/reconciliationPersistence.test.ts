import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { reconciliationService } from './reconciliationService';

const tenantId = 'tenant_reconciliation_test';

function pending(id: string) {
  const now = new Date().toISOString();
  return {
    transactionId: id,
    tenantId,
    branchId: 'branch_hq',
    source: 'MPESA' as const,
    providerReference: 'UNKNOWN-' + id,
    amount: 1000,
    currency: 'KES',
    status: 'PENDING' as const,
    description: 'Unknown provider result',
    correlationId: 'corr-' + id,
    createdAt: now,
    postedAt: null,
    reversedAt: null,
  };
}

describe('Durable reconciliation', () => {
  beforeEach(() => firestoreClient.clearAllForTesting());

  it('persists RECONCILIATION_REQUIRED instead of returning an in-memory mutation', async () => {
    const tx = pending('txn_reconcile_001');
    await firestoreClient.set('/tenants/' + tenantId + '/financialTransactions/' + tx.transactionId, tx);

    const result = await reconciliationService.markRequired(
      tenantId,
      tx.transactionId,
      'PENDING'
    );

    expect(result.status).toBe('RECONCILIATION_REQUIRED');
    expect(
      await firestoreClient.get('/tenants/' + tenantId + '/financialTransactions/' + tx.transactionId)
    ).toEqual(result);
  });

  it('is idempotent when the transaction is already reconciliation-required', async () => {
    const tx = pending('txn_reconcile_002');
    await firestoreClient.set('/tenants/' + tenantId + '/financialTransactions/' + tx.transactionId, {
      ...tx,
      status: 'RECONCILIATION_REQUIRED' as const,
    });

    const result = await reconciliationService.markRequired(
      tenantId,
      tx.transactionId,
      'PENDING'
    );

    expect(result.status).toBe('RECONCILIATION_REQUIRED');
  });

  it('survives restart with durable reconciliation state', async () => {
    const tx = pending('txn_reconcile_restart_001');
    await firestoreClient.set('/tenants/' + tenantId + '/financialTransactions/' + tx.transactionId, tx);

    await reconciliationService.markRequired(tenantId, tx.transactionId, 'PENDING');
    firestoreClient.simulateServerRestart();

    const reconstructed = await reconciliationService.get(tenantId, tx.transactionId);
    expect(reconstructed?.status).toBe('RECONCILIATION_REQUIRED');
  });

  it('does not permit a status-only confirmation or reversal', async () => {
    const tx = pending('txn_reconcile_guard_001');
    await firestoreClient.set('/tenants/' + tenantId + '/financialTransactions/' + tx.transactionId, {
      ...tx,
      status: 'RECONCILIATION_REQUIRED' as const,
    });

    await expect(
      (async () => {
        const { reconciliationRepository } = await import(
          '../persistence/firestore/repositories/reconciliationRepository'
        );
        return reconciliationRepository.resolve(
          tenantId,
          tx.transactionId,
          'RECONCILIATION_REQUIRED',
          'POSTED'
        );
      })()
    ).rejects.toThrow('authoritative ledger posting');
  });
});
