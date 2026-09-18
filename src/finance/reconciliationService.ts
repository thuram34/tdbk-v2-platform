import { reconciliationRepository } from '../persistence/firestore/repositories/reconciliationRepository';
import type { FinancialTransaction, FinancialTransactionStatus } from './types';

export class ReconciliationService {
  public async markRequired(
    tenantId: string,
    transactionId: string,
    expectedStatus: FinancialTransactionStatus = 'PENDING',
  ): Promise<FinancialTransaction> {
    return reconciliationRepository.markRequired(tenantId, transactionId, expectedStatus);
  }

  /**
   * Resolves an uncertain provider result to FAILED durably.
   * Confirmation and reversal deliberately delegate to the ledger engine so
   * financial truth can never be changed by a status-only mutation.
   */
  public async resolveFailed(
    tenantId: string,
    transactionId: string,
  ): Promise<FinancialTransaction> {
    return reconciliationRepository.resolve(
      tenantId,
      transactionId,
      'RECONCILIATION_REQUIRED',
      'FAILED'
    );
  }

  /**
   * Confirms an uncertain transaction only through the authoritative ledger.
   * The repository atomically changes RECONCILIATION_REQUIRED -> POSTED and
   * writes the immutable balanced entries in the same Firestore transaction.
   */
  public async resolveConfirmed(
    transaction: FinancialTransaction,
    entries: import('./types').LedgerEntry[],
  ): Promise<FinancialTransaction> {
    if (transaction.status !== 'POSTED') {
      throw new Error('Confirmed reconciliation must provide a POSTED transaction');
    }

    const current = await reconciliationRepository.get(transaction.tenantId, transaction.transactionId);
    if (!current) throw new Error('Financial transaction not found');
    if (current.status !== 'RECONCILIATION_REQUIRED' && current.status !== 'POSTED') {
      throw new Error(
        `Cannot confirm financial transaction from status '${current.status}'`
      );
    }

    const { ledgerService } = await import('./ledgerService');
    await ledgerService.confirmReconciled(transaction, entries);
    return (await reconciliationRepository.get(transaction.tenantId, transaction.transactionId))!;
  }

  public async get(
    tenantId: string,
    transactionId: string,
  ): Promise<FinancialTransaction | null> {
    return reconciliationRepository.get(tenantId, transactionId);
  }
}

export const reconciliationService = new ReconciliationService();
