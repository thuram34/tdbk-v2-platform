import { FirestoreTransaction, FinancialReceipt, IReceiptRepository, OutboxRecord } from '../../types';
import { firestoreClient } from '../firestoreClient';

export class ReceiptRepository implements IReceiptRepository {
  private static instance: ReceiptRepository;

  private constructor() {}

  public static getInstance(): ReceiptRepository {
    return (this.instance ??= new ReceiptRepository());
  }

  private path(tenantId: string, receiptId: string): string {
    return `/tenants/${tenantId}/receipts/${receiptId}`;
  }

  private collectionPath(tenantId: string): string {
    return `/tenants/${tenantId}/receipts`;
  }

  public async createIfAbsent(
    tenantId: string,
    receipt: FinancialReceipt,
    transaction: FirestoreTransaction,
    outboxRecord: OutboxRecord
  ): Promise<boolean> {
    const path = this.path(tenantId, receipt.receiptId);
    const existing = await transaction.get<FinancialReceipt>(path);
    if (existing) {
      if (
        existing.tenantId !== receipt.tenantId ||
        existing.transactionId !== receipt.transactionId ||
        existing.amount !== receipt.amount ||
        existing.currency !== receipt.currency ||
        existing.providerReference !== receipt.providerReference
      ) {
        throw new Error(`Receipt identity conflict for '${receipt.receiptId}'`);
      }
      return false;
    }

    await transaction.set(path, receipt);
    await transaction.set(
      `/tenants/${tenantId}/outbox/${outboxRecord.eventId}`,
      outboxRecord
    );
    return true;
  }

  public async getReceipt(tenantId: string, receiptId: string): Promise<FinancialReceipt | null> {
    return firestoreClient.get<FinancialReceipt>(this.path(tenantId, receiptId));
  }

  public async listReceipts(tenantId: string): Promise<FinancialReceipt[]> {
    return firestoreClient.listCollection<FinancialReceipt>(this.collectionPath(tenantId));
  }
}

export const receiptRepository = ReceiptRepository.getInstance();
