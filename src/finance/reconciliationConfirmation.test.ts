import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { reconciliationService } from './reconciliationService';

const tenantId = 'tenant_reconcile_confirm';
const transactionId = 'txn_reconcile_confirm_001';

function reconciliationRequired() {
  const now = new Date().toISOString();
  return {
    transactionId,
    tenantId,
    branchId: 'branch_hq',
    source: 'MPESA' as const,
    providerReference: 'QAB-CONFIRM-001',
    amount: 1250,
    currency: 'KES',
    status: 'RECONCILIATION_REQUIRED' as const,
    description: 'Provider confirmation pending reconciliation',
    correlationId: 'corr-confirm-001',
    createdAt: now,
    postedAt: null,
    reversedAt: null,
  };
}

function confirmedTransaction() {
  const current = reconciliationRequired();
  const now = new Date().toISOString();
  return {
    ...current,
    status: 'POSTED' as const,
    postedAt: now,
  };
}

function entries() {
  const now = new Date().toISOString();
  return [
    {
      entryId: transactionId + '_debit',
      transactionId,
      tenantId,
      account: 'CASH:MPESA',
      entryType: 'DEBIT' as const,
      amount: 1250,
      currency: 'KES',
      createdAt: now,
      immutable: true as const,
    },
    {
      entryId: transactionId + '_credit',
      transactionId,
      tenantId,
      account: 'RECEIVABLES:PAYMENTS',
      entryType: 'CREDIT' as const,
      amount: 1250,
      currency: 'KES',
      createdAt: now,
      immutable: true as const,
    },
  ];
}

describe('Authoritative reconciliation confirmation', () => {
  beforeEach(() => firestoreClient.clearAllForTesting());

  it('atomically promotes RECONCILIATION_REQUIRED to POSTED with balanced immutable ledger entries', async () => {
    await firestoreClient.set(
      `/tenants/${tenantId}/financialTransactions/${transactionId}`,
      reconciliationRequired()
    );

    const result = await reconciliationService.resolveConfirmed(
      confirmedTransaction(),
      entries()
    );

    expect(result.status).toBe('POSTED');
    expect(result.postedAt).toBeTruthy();

    const persisted = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/${transactionId}`
    );
    const ledger = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/ledgerTransactions/${transactionId}/entries`
    );

    expect(persisted?.status).toBe('POSTED');
    expect(ledger).toHaveLength(2);
    expect(ledger.every((entry) => entry.immutable === true)).toBe(true);

    const outbox = await firestoreClient.get<any>(
      `/tenants/${tenantId}/outbox/evt_payment_confirmed_${transactionId}`
    );
    expect(outbox?.eventType).toBe('payment.confirmed.v1');
    expect(outbox?.status).toBe('PENDING');
    expect(ledger.reduce((sum, entry) => sum + entry.amount, 0)).toBe(2500);
  });

  it('survives restart with both posted state and ledger entries', async () => {
    await firestoreClient.set(
      `/tenants/${tenantId}/financialTransactions/${transactionId}`,
      reconciliationRequired()
    );

    await reconciliationService.resolveConfirmed(
      confirmedTransaction(),
      entries()
    );

    firestoreClient.simulateServerRestart();

    const persisted = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/${transactionId}`
    );
    const ledger = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/ledgerTransactions/${transactionId}/entries`
    );

    expect(persisted?.status).toBe('POSTED');
    expect(ledger).toHaveLength(2);
  });

  it('is idempotent when the same reconciliation is confirmed again', async () => {
    await firestoreClient.set(
      `/tenants/${tenantId}/financialTransactions/${transactionId}`,
      reconciliationRequired()
    );

    const confirmed = confirmedTransaction();
    await reconciliationService.resolveConfirmed(confirmed, entries());
    await reconciliationService.resolveConfirmed(confirmed, entries());

    const ledger = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/ledgerTransactions/${transactionId}/entries`
    );

    expect(ledger).toHaveLength(2);
  });

  it('rejects confirmation if the authoritative identity changes', async () => {
    await firestoreClient.set(
      `/tenants/${tenantId}/financialTransactions/${transactionId}`,
      reconciliationRequired()
    );

    await expect(
      reconciliationService.resolveConfirmed(
        { ...confirmedTransaction(), amount: 999 },
        entries()
      )
    ).rejects.toThrow('identity conflicts');
  });

  it('does not allow confirmation from FAILED', async () => {
    await firestoreClient.set(
      `/tenants/${tenantId}/financialTransactions/${transactionId}`,
      { ...reconciliationRequired(), status: 'FAILED' as const }
    );

    await expect(
      reconciliationService.resolveConfirmed(confirmedTransaction(), entries())
    ).rejects.toThrow(/Cannot confirm financial transaction/);
  });
});
