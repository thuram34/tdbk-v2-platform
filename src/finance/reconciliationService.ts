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

  public async get(
    tenantId: string,
    transactionId: string,
  ): Promise<FinancialTransaction | null> {
    return reconciliationRepository.get(tenantId, transactionId);
  }
}

export const reconciliationService = new ReconciliationService();
