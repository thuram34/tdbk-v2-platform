import { financialLedgerRepository } from '../persistence/firestore/repositories/financialLedgerRepository';
import type {
  FinancialTransaction,
  LedgerEntry,
  ReverseFinancialTransactionInput,
} from './types';

export class LedgerService {
  public async post(transaction: FinancialTransaction, entries: LedgerEntry[]): Promise<void> {
    if (transaction.status !== 'POSTED') throw new Error('Ledger can only post a POSTED transaction');
    await financialLedgerRepository.postTransaction(transaction, entries);
  }

  public async confirmReconciled(
    transaction: FinancialTransaction,
    entries: LedgerEntry[],
  ): Promise<void> {
    if (transaction.status !== 'POSTED') {
      throw new Error('Reconciled confirmation must produce a POSTED transaction');
    }
    await financialLedgerRepository.confirmReconciledTransaction(transaction, entries);
  }

  public async entries(tenantId: string, transactionId: string): Promise<LedgerEntry[]> {
    return financialLedgerRepository.listEntries(tenantId, transactionId);
  }

  public async reverse(input: ReverseFinancialTransactionInput): Promise<FinancialTransaction> {
    if (input.original.status !== 'POSTED') throw new Error('Only POSTED transactions can be reversed');

    const now = new Date().toISOString();
    const reversal: FinancialTransaction = {
      transactionId: input.reversalTransactionId,
      tenantId: input.original.tenantId,
      branchId: input.original.branchId,
      source: input.original.source,
      providerReference: input.providerReference,
      amount: input.original.amount,
      currency: input.original.currency,
      status: 'POSTED',
      description: input.description ?? `Reversal of ${input.original.transactionId}`,
      correlationId: input.correlationId,
      createdAt: now,
      postedAt: now,
      reversedAt: null,
      reversalOfTransactionId: input.original.transactionId,
    };

    const entries: LedgerEntry[] = [
      {
        entryId: `${reversal.transactionId}_debit`,
        transactionId: reversal.transactionId,
        tenantId: reversal.tenantId,
        account: 'RECEIVABLES:PAYMENTS',
        entryType: 'DEBIT',
        amount: reversal.amount,
        currency: reversal.currency,
        createdAt: now,
        immutable: true,
      },
      {
        entryId: `${reversal.transactionId}_credit`,
        transactionId: reversal.transactionId,
        tenantId: reversal.tenantId,
        account: 'CASH:MPESA',
        entryType: 'CREDIT',
        amount: reversal.amount,
        currency: reversal.currency,
        createdAt: now,
        immutable: true,
      },
    ];

    await financialLedgerRepository.reverseTransaction(
      input.original.tenantId,
      input.original.transactionId,
      reversal,
      entries
    );
    return reversal;
  }
}

export const ledgerService = new LedgerService();
