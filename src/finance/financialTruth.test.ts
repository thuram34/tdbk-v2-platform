import { describe, expect, it, beforeEach } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { financialLedgerRepository } from '../persistence/firestore/repositories/financialLedgerRepository';
import { financialTransactionService } from './transactionService';
import { ledgerService } from './ledgerService';

const tenantId = 'tenant_finance_test';

function postedTransaction(id: string) {
  const now = new Date().toISOString();
  return {
    transactionId: id,
    tenantId,
    branchId: 'branch_hq',
    source: 'MPESA' as const,
    providerReference: `MPESA-${id}`,
    amount: 1500,
    currency: 'KES',
    status: 'POSTED' as const,
    description: 'Test payment',
    correlationId: `corr-${id}`,
    createdAt: now,
    postedAt: now,
    reversedAt: null,
  };
}

function entries(transactionId: string) {
  return [
    {
      entryId: `${transactionId}_debit`,
      transactionId,
      tenantId,
      account: 'CASH:MPESA',
      entryType: 'DEBIT' as const,
      amount: 1500,
      currency: 'KES',
      createdAt: new Date().toISOString(),
      immutable: true as const,
    },
    {
      entryId: `${transactionId}_credit`,
      transactionId,
      tenantId,
      account: 'RECEIVABLES:PAYMENTS',
      entryType: 'CREDIT' as const,
      amount: 1500,
      currency: 'KES',
      createdAt: new Date().toISOString(),
      immutable: true as const,
    },
  ];
}

describe('Financial truth layer', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('persists pending transactions under the canonical financial path', async () => {
    const transaction = await financialTransactionService.createPending({
      transactionId: 'txn_pending_001',
      tenantId,
      branchId: 'branch_hq',
      source: 'MPESA',
      providerReference: 'CO_PENDING_001',
      amount: 2500,
      description: 'Pending M-Pesa payment',
      correlationId: 'corr_pending_001',
    });

    expect(await financialLedgerRepository.getTransaction(tenantId, transaction.transactionId)).toEqual(transaction);
    expect(
      await firestoreClient.get(`/tenants/${tenantId}/financialTransactions/${transaction.transactionId}`)
    ).toEqual(transaction);
  });

  it('enforces debit total equals credit total', async () => {
    const transaction = postedTransaction('txn_unbalanced_001');
    await expect(
      financialLedgerRepository.postTransaction(transaction, [
        entries(transaction.transactionId)[0],
        { ...entries(transaction.transactionId)[1], amount: 1499 },
      ])
    ).rejects.toThrow('Debit total must equal credit total');
  });

  it('posts a balanced ledger atomically and is idempotent', async () => {
    const transaction = postedTransaction('txn_posted_001');
    const ledgerEntries = entries(transaction.transactionId);

    await financialLedgerRepository.postTransaction(transaction, ledgerEntries);
    await financialLedgerRepository.postTransaction(transaction, ledgerEntries);

    const stored = await financialLedgerRepository.getTransaction(tenantId, transaction.transactionId);
    const storedEntries = await financialLedgerRepository.listEntries(tenantId, transaction.transactionId);

    expect(stored?.status).toBe('POSTED');
    expect(storedEntries).toHaveLength(2);
    expect(storedEntries.reduce((sum, e) => sum + (e.entryType === 'DEBIT' ? e.amount : -e.amount), 0)).toBe(0);
    expect(
      await firestoreClient.get(
        `/tenants/${tenantId}/ledgerTransactions/${transaction.transactionId}/entries/${ledgerEntries[0].entryId}`
      )
    ).toEqual(ledgerEntries[0]);
  });

  it('rejects conflicting ledger entries on repeated posting', async () => {
    const transaction = postedTransaction('txn_conflict_001');
    await financialLedgerRepository.postTransaction(transaction, entries(transaction.transactionId));

    await expect(
      financialLedgerRepository.postTransaction(
        transaction,
        entries(transaction.transactionId).map((entry) =>
          entry.entryType === 'CREDIT' ? { ...entry, amount: 1499 } : entry
        )
      )
    ).rejects.toThrow('conflicting immutable ledger entries');
  });

  it('reverses by creating counter-entries and never edits posted entries', async () => {
    const original = postedTransaction('txn_reverse_001');
    const originalEntries = entries(original.transactionId);
    await ledgerService.post(original, originalEntries);

    const reversal = await ledgerService.reverse({
      original,
      reversalTransactionId: 'txn_reverse_001_reversal',
      providerReference: 'REVERSAL-001',
      correlationId: 'corr-reversal-001',
    });

    const originalStored = await financialLedgerRepository.getTransaction(tenantId, original.transactionId);
    const reversalEntries = await ledgerService.entries(tenantId, reversal.transactionId);
    const originalStoredEntries = await ledgerService.entries(tenantId, original.transactionId);

    expect(originalStored?.status).toBe('REVERSED');
    expect(reversal.reversalOfTransactionId).toBe(original.transactionId);
    expect(reversalEntries).toHaveLength(2);
    expect(originalStoredEntries).toEqual(originalEntries);
  });

  it('reconstructs financial state after a simulated server restart', async () => {
    const transaction = postedTransaction('txn_restart_001');
    await ledgerService.post(transaction, entries(transaction.transactionId));

    firestoreClient.simulateServerRestart();

    const reconstructed = await financialLedgerRepository.getTransaction(tenantId, transaction.transactionId);
    const reconstructedEntries = await financialLedgerRepository.listEntries(tenantId, transaction.transactionId);

    expect(reconstructed?.status).toBe('POSTED');
    expect(reconstructedEntries).toHaveLength(2);
  });
});
