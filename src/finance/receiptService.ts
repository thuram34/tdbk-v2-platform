import type { FinancialTransaction } from './types';

export interface FinancialReceipt {
  receiptId: string;
  tenantId: string;
  transactionId: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: 'CREATED';
  createdAt: string;
}

export class ReceiptService {
  public buildFromPostedTransaction(transaction: FinancialTransaction): FinancialReceipt {
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
}

export const receiptService = new ReceiptService();
