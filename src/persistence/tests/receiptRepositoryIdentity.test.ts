import { describe, expect, it, beforeEach } from 'vitest';
import { firestoreClient } from '../firestore/firestoreClient';
import { receiptRepository } from '../firestore/repositories/receiptRepository';
import type { FinancialReceipt, OutboxRecord } from '../types';

const tenantId = 'tenant_receipt_identity';
const receipt: FinancialReceipt = {
  receiptId: 'receipt_tx_001',
  tenantId,
  transactionId: 'tx_001',
  providerReference: 'CO_001',
  amount: 100,
  currency: 'KES',
  status: 'CREATED',
  createdAt: '2026-09-21T00:00:00.000Z',
};

function outbox(eventId = 'evt_receipt_created_receipt_tx_001', causationId = receipt.transactionId): OutboxRecord {
  return {
    eventId,
    tenantId,
    branchId: null,
    eventType: 'receipt.created.v1',
    eventVersion: 'v1',
    occurredAt: receipt.createdAt,
    correlationId: 'corr_001',
    causationId,
    source: 'TDBK_FINANCE_RECEIPT_SERVICE',
    payload: {
      receiptId: receipt.receiptId,
      transactionId: receipt.transactionId,
      providerReference: receipt.providerReference,
      amount: receipt.amount,
      currency: receipt.currency,
      status: receipt.status,
    },
    status: 'PENDING',
    attemptCount: 0,
    availableAt: receipt.createdAt,
    createdAt: receipt.createdAt,
    updatedAt: receipt.createdAt,
    leaseOwner: null,
    leaseUntil: null,
    lastError: null,
    deliveredAt: null,
  };
}

describe('ReceiptRepository identity hardening', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('rejects a receipt whose embedded tenant differs from the authoritative tenant path', async () => {
    const forgedReceipt = { ...receipt, tenantId: 'tenant_attacker' };

    await expect(
      firestoreClient.runTransaction((tx) =>
        receiptRepository.createIfAbsent(tenantId, forgedReceipt, tx, outbox())
      )
    ).rejects.toThrow('Receipt tenant mismatch');

    expect(
      await firestoreClient.get(`/tenants/${tenantId}/receipts/${receipt.receiptId}`)
    ).toBeNull();
  });

  it('rejects an existing receipt outbox record with conflicting identity instead of silently accepting it', async () => {
    await firestoreClient.runTransaction(async (tx) => {
      await tx.set(`/tenants/${tenantId}/receipts/${receipt.receiptId}`, receipt);
      await tx.set(`/tenants/${tenantId}/outbox/${outbox().eventId}`, {
        ...outbox(),
        causationId: 'attacker_transaction',
      });
    });

    await expect(
      firestoreClient.runTransaction((tx) =>
        receiptRepository.createIfAbsent(tenantId, receipt, tx, outbox())
      )
    ).rejects.toThrow(`Receipt outbox identity conflict for '${outbox().eventId}'`);
  });
});
