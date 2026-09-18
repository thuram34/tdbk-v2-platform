import type {
  FinancialTransaction,
  FinancialTransactionStatus,
  LedgerEntry,
  LedgerEntryType,
} from '../persistence/types';

export type { FinancialTransaction, FinancialTransactionStatus, LedgerEntry, LedgerEntryType };

export interface CreateFinancialTransactionInput {
  transactionId: string;
  tenantId: string;
  branchId?: string | null;
  source: FinancialTransaction['source'];
  providerReference: string;
  amount: number;
  currency?: string;
  description: string;
  correlationId: string;
}

export interface PostFinancialTransactionInput {
  transaction: FinancialTransaction;
  entries: LedgerEntry[];
}

export interface ReverseFinancialTransactionInput {
  original: FinancialTransaction;
  reversalTransactionId: string;
  providerReference: string;
  correlationId: string;
  description?: string;
}
