import { financialLedgerRepository } from '../persistence/firestore/repositories/financialLedgerRepository';
import type { CreateFinancialTransactionInput, FinancialTransaction } from './types';

export class FinancialTransactionService {
  public async createPending(input: CreateFinancialTransactionInput): Promise<FinancialTransaction> {
    const now = new Date().toISOString();
    const transaction: FinancialTransaction = {
      transactionId: input.transactionId,
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      source: input.source,
      providerReference: input.providerReference,
      amount: input.amount,
      currency: input.currency ?? 'KES',
      status: 'PENDING',
      description: input.description,
      correlationId: input.correlationId,
      createdAt: now,
      postedAt: null,
      reversedAt: null,
    };

    await financialLedgerRepository.savePendingTransaction(transaction);
    return transaction;
  }

  public async get(tenantId: string, transactionId: string): Promise<FinancialTransaction | null> {
    return financialLedgerRepository.getTransaction(tenantId, transactionId);
  }
}

export const financialTransactionService = new FinancialTransactionService();
