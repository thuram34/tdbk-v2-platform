import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { financialLedgerRepository } from '../persistence/firestore/repositories/financialLedgerRepository';
import { financialIntegrityService } from './financialIntegrityService';

const tenantId = 'tenant_financial_integrity';

function transaction(id: string) {
  const now = new Date().toISOString();
  return {
    transactionId: id,
    tenantId,
    branchId: 'branch_hq',
    source: 'MPESA' as const,
    providerReference: 'MPESA-' + id,
    amount: 1000,
    currency: 'KES',
    status: 'POSTED' as const,
    description: 'Integrity test payment',
    correlationId: 'corr-' + id,
    createdAt: now,
    postedAt: now,
    reversedAt: null,
  };
}

function entries(id: string) {
  const now = new Date().toISOString();
  return [
    {
      entryId: id + '_debit',
      transactionId: id,
      tenantId,
      account: 'CASH:MPESA',
      entryType: 'DEBIT' as const,
      amount: 1000,
      currency: 'KES',
      createdAt: now,
      immutable: true as const,
    },
    {
      entryId: id + '_credit',
      transactionId: id,
      tenantId,
      account: 'RECEIVABLES:PAYMENTS',
      entryType: 'CREDIT' as const,
      amount: 1000,
      currency: 'KES',
      createdAt: now,
      immutable: true as const,
    },
  ];
}

describe('Financial integrity inspection', () => {
  beforeEach(() => firestoreClient.clearAllForTesting());

  it('reports a valid balanced immutable transaction', async () => {
    const tx = transaction('txn_integrity_valid');
    await financialLedgerRepository.postTransaction(tx, entries(tx.transactionId));
    const report = await financialIntegrityService.inspect(tenantId, tx.transactionId);
    expect(report.status).toBe('VALID');
    expect(report.balanced).toBe(true);
    expect(report.immutable).toBe(true);
    expect(report.identityConsistent).toBe(true);
    expect(report.entryCount).toBe(2);
    expect(report.errors).toEqual([]);
  });

  it('reports missing transactions without throwing', async () => {
    const report = await financialIntegrityService.inspect(tenantId, 'missing');
    expect(report.status).toBe('NOT_FOUND');
    expect(report.transaction).toBeNull();
    expect(report.errors).toContain('Financial transaction not found');
  });

  it('detects a tampered non-immutable entry', async () => {
    const tx = transaction('txn_integrity_tampered');
    await financialLedgerRepository.postTransaction(tx, entries(tx.transactionId));
    await firestoreClient.update(
      `/tenants/${tenantId}/ledgerTransactions/${tx.transactionId}/entries/${tx.transactionId}_credit`,
      { immutable: false }
    );
    const report = await financialIntegrityService.inspect(tenantId, tx.transactionId);
    expect(report.status).toBe('INVALID');
    expect(report.immutable).toBe(false);
    expect(report.errors).toContain('One or more ledger entries are not immutable');
  });

  it('detects a balance mismatch', async () => {
    const tx = transaction('txn_integrity_unbalanced');
    await firestoreClient.set(`/tenants/${tenantId}/financialTransactions/${tx.transactionId}`, tx);
    const originalEntries = entries(tx.transactionId);
    await firestoreClient.set(`/tenants/${tenantId}/ledgerTransactions/${tx.transactionId}`, {
      ledgerTransactionId: tx.transactionId,
      tenantId,
      transactionId: tx.transactionId,
      status: 'POSTED',
      amount: tx.amount,
      currency: tx.currency,
      postedAt: tx.postedAt,
      createdAt: tx.createdAt,
    });
    await firestoreClient.set(`/tenants/${tenantId}/ledgerTransactions/${tx.transactionId}/entries/${originalEntries[0].entryId}`, originalEntries[0]);
    await firestoreClient.set(`/tenants/${tenantId}/ledgerTransactions/${tx.transactionId}/entries/${originalEntries[1].entryId}`, { ...originalEntries[1], amount: 999 });
    const report = await financialIntegrityService.inspect(tenantId, tx.transactionId);
    expect(report.status).toBe('INVALID');
    expect(report.balanced).toBe(false);
    expect(report.debitTotal).toBe(1000);
    expect(report.creditTotal).toBe(999);
  });
});
