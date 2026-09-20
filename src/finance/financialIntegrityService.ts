import { financialLedgerRepository } from '../persistence/firestore/repositories/financialLedgerRepository';
import type { FinancialTransaction, LedgerEntry } from './types';

export type FinancialIntegrityStatus = 'VALID' | 'INVALID' | 'NOT_FOUND';

export interface FinancialIntegrityReport {
  tenantId: string;
  transactionId: string;
  status: FinancialIntegrityStatus;
  transaction: FinancialTransaction | null;
  entryCount: number;
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
  immutable: boolean;
  identityConsistent: boolean;
  errors: string[];
}

export class FinancialIntegrityService {
  public async inspect(tenantId: string, transactionId: string): Promise<FinancialIntegrityReport> {
    const transaction = await financialLedgerRepository.getTransaction(tenantId, transactionId);

    if (!transaction) {
      return {
        tenantId,
        transactionId,
        status: 'NOT_FOUND',
        transaction: null,
        entryCount: 0,
        debitTotal: 0,
        creditTotal: 0,
        balanced: false,
        immutable: false,
        identityConsistent: false,
        errors: ['Financial transaction not found'],
      };
    }

    const entries = await financialLedgerRepository.listEntries(tenantId, transactionId);
    const errors: string[] = [];
    const debitTotal = entries.filter((entry) => entry.entryType === 'DEBIT').reduce((sum, entry) => sum + entry.amount, 0);
    const creditTotal = entries.filter((entry) => entry.entryType === 'CREDIT').reduce((sum, entry) => sum + entry.amount, 0);

    const balanced =
      entries.length > 0 &&
      Number.isFinite(debitTotal) &&
      Number.isFinite(creditTotal) &&
      Math.abs(debitTotal - creditTotal) <= 0.000001 &&
      Math.abs(debitTotal - transaction.amount) <= 0.000001;

    if (!balanced) errors.push('Ledger is not balanced to the authoritative transaction amount');

    const immutable = entries.every((entry) => entry.immutable === true);
    if (!immutable) errors.push('One or more ledger entries are not immutable');

    const seenEntryIds = new Set<string>();
    const identityConsistent = entries.every((entry: LedgerEntry) => {
      const valid =
        entry.entryId.length > 0 &&
        !seenEntryIds.has(entry.entryId) &&
        entry.transactionId === transaction.transactionId &&
        entry.tenantId === transaction.tenantId &&
        entry.currency === transaction.currency &&
        Number.isFinite(entry.amount) &&
        entry.amount > 0;
      seenEntryIds.add(entry.entryId);
      return valid;
    });

    if (!identityConsistent) errors.push('Ledger entries contain duplicate or inconsistent identity data');
    if (!entries.some((entry) => entry.entryType === 'DEBIT')) errors.push('Ledger contains no debit entry');
    if (!entries.some((entry) => entry.entryType === 'CREDIT')) errors.push('Ledger contains no credit entry');

    return {
      tenantId,
      transactionId,
      status: errors.length === 0 ? 'VALID' : 'INVALID',
      transaction,
      entryCount: entries.length,
      debitTotal,
      creditTotal,
      balanced,
      immutable,
      identityConsistent,
      errors,
    };
  }
}

export const financialIntegrityService = new FinancialIntegrityService();
