import type { FinancialReceipt, FinancialTransaction, OutboxRecord } from '../persistence/types';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { receiptRepository } from '../persistence/firestore/repositories/receiptRepository';

export class ReceiptService {
  private transactionPath(tenantId: string, transactionId: string): string {
    return `/tenants/${tenantId}/financialTransactions/${transactionId}`;
  }

  private buildFromPostedTransaction(transaction: FinancialTransaction): FinancialReceipt {
    if (transaction.status !== 'POSTED') {
      throw new Error('Receipts can only be created from POSTED financial state');
    }

    return {
      receiptId: `receipt_${transaction.transactionId}`,
      tenantId: transaction.tenantId,
      transactionId: transaction.transactionId,
      providerReference: transaction.providerReference,
      amount: transaction.amount,
      currency: transaction.currency,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Creates a durable receipt from authoritative POSTED financial state.
   *
   * Receipt creation and receipt.created.v1 outbox creation are one atomic
   * Firestore transaction. Downstream messaging therefore cannot roll back
   * the receipt or the financial transaction.
   */
  public async createFromPostedTransaction(
    tenantId: string,
    transactionId: string,
    principalId: string = 'sys_internal'
  ): Promise<FinancialReceipt> {
    return firestoreClient.runTransaction(async (transaction) => {
      const financialTransaction = await transaction.get<FinancialTransaction>(
        this.transactionPath(tenantId, transactionId)
      );

      if (!financialTransaction) {
        throw new Error(`Financial transaction '${transactionId}' not found`);
      }
      if (financialTransaction.tenantId !== tenantId) {
        throw new Error('Financial transaction tenant mismatch');
      }

      const receipt = this.buildFromPostedTransaction(financialTransaction);
      const eventId = `evt_receipt_created_${receipt.receiptId}`;
      const now = new Date().toISOString();

      const outboxRecord: OutboxRecord = {
        eventId,
        tenantId,
        branchId: financialTransaction.branchId,
        eventType: 'receipt.created.v1',
        eventVersion: 'v1',
        occurredAt: now,
        correlationId: financialTransaction.correlationId,
        causationId: financialTransaction.transactionId,
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
        availableAt: now,
        createdAt: now,
        updatedAt: now,
        leaseOwner: null,
        leaseUntil: null,
        lastError: null,
        deliveredAt: null,
      };

      await receiptRepository.createIfAbsent(
        tenantId,
        receipt,
        transaction,
        outboxRecord
      );

      return receipt;
    });
  }

  public async getReceipt(tenantId: string, receiptId: string): Promise<FinancialReceipt | null> {
    return receiptRepository.getReceipt(tenantId, receiptId);
  }

  public async listReceipts(tenantId: string): Promise<FinancialReceipt[]> {
    return receiptRepository.listReceipts(tenantId);
  }
}

export const receiptService = new ReceiptService();
