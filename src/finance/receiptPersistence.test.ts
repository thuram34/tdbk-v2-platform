import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { financialLedgerRepository } from '../persistence/firestore/repositories/financialLedgerRepository';
import { outboxRepository } from '../persistence/firestore/repositories/outboxRepository';
import { receiptService } from './receiptService';

const tenantId = 'tenant_receipt_test';

function postedTransaction(id: string) {
  const now = new Date().toISOString();
  return {
    transactionId: id, tenantId, branchId: 'branch_hq', source: 'MPESA' as const,
    providerReference: 'MPESA-' + id, amount: 1500, currency: 'KES', status: 'POSTED' as const,
    description: 'Test payment', correlationId: 'corr-' + id, createdAt: now, postedAt: now, reversedAt: null,
  };
}

function entries(transactionId: string) {
  const now = new Date().toISOString();
  return [
    { entryId: transactionId + '_debit', transactionId, tenantId, account: 'CASH:MPESA', entryType: 'DEBIT' as const, amount: 1500, currency: 'KES', createdAt: now, immutable: true as const },
    { entryId: transactionId + '_credit', transactionId, tenantId, account: 'RECEIVABLES:PAYMENTS', entryType: 'CREDIT' as const, amount: 1500, currency: 'KES', createdAt: now, immutable: true as const },
  ];
}

describe('Receipt persistence hardening', () => {
  beforeEach(() => firestoreClient.clearAllForTesting());

  it('creates a receipt only from authoritative POSTED financial state', async () => {
    const transaction = postedTransaction('txn_receipt_001');
    await financialLedgerRepository.postTransaction(transaction, entries(transaction.transactionId));
    const receipt = await receiptService.createFromPostedTransaction(tenantId, transaction.transactionId);
    expect(receipt.receiptId).toBe('receipt_' + transaction.transactionId);
    expect(receipt.transactionId).toBe(transaction.transactionId);
    expect(receipt.amount).toBe(transaction.amount);
    expect(await firestoreClient.get('/tenants/' + tenantId + '/receipts/' + receipt.receiptId)).toEqual(receipt);
  });

  it('rejects receipt creation for non-POSTED financial state', async () => {
    const transaction = { ...postedTransaction('txn_receipt_pending_001'), status: 'PENDING' as const };
    await firestoreClient.set('/tenants/' + tenantId + '/financialTransactions/' + transaction.transactionId, transaction);
    await expect(receiptService.createFromPostedTransaction(tenantId, transaction.transactionId)).rejects.toThrow('Receipts can only be created from POSTED financial state');
  });

  it('creates exactly one receipt and one durable receipt event on repeated calls', async () => {
    const transaction = postedTransaction('txn_receipt_idempotent_001');
    await financialLedgerRepository.postTransaction(transaction, entries(transaction.transactionId));
    const first = await receiptService.createFromPostedTransaction(tenantId, transaction.transactionId);
    const second = await receiptService.createFromPostedTransaction(tenantId, transaction.transactionId);
    expect(second).toEqual(first);
    const receipts = await receiptService.listReceipts(tenantId);
    const outbox = (await outboxRepository.listOutbox(tenantId)).filter((event) => event.eventType === 'receipt.created.v1');
    expect(receipts).toHaveLength(1);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].eventType).toBe('receipt.created.v1');
    expect(outbox[0].payload).toMatchObject({ receiptId: first.receiptId, transactionId: transaction.transactionId, amount: transaction.amount, currency: transaction.currency });
  });

  it('reconstructs receipt and pending delivery event after restart', async () => {
    const transaction = postedTransaction('txn_receipt_restart_001');
    await financialLedgerRepository.postTransaction(transaction, entries(transaction.transactionId));
    const receipt = await receiptService.createFromPostedTransaction(tenantId, transaction.transactionId);
    firestoreClient.simulateServerRestart();
    expect(await receiptService.getReceipt(tenantId, receipt.receiptId)).toEqual(receipt);
    const outbox = (await outboxRepository.listOutbox(tenantId)).filter((event) => event.eventType === 'receipt.created.v1');
    expect(outbox).toHaveLength(1);
    expect(outbox[0].status).toBe('PENDING');
    expect(outbox[0].eventType).toBe('receipt.created.v1');
  });
});
