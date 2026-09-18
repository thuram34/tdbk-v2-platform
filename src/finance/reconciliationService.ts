import { financialLedgerRepository } from '../persistence/firestore/repositories/financialLedgerRepository';
import type { FinancialTransaction } from './types';

export class ReconciliationService {
  public async markRequired(
    tenantId: string,
    transactionId: string,
  ): Promise<FinancialTransaction> {
    const transaction = await financialLedgerRepository.getTransaction(tenantId, transactionId);
    if (!transaction) throw new Error('Financial transaction not found');
    if (transaction.status === 'POSTED' || transaction.status === 'REVERSED') {
      throw new Error('Posted/reversed financial history cannot be changed to reconciliation-required');
    }

    // This transition will be made atomic with provider reconciliation in the next hardening batch.
    return { ...transaction, status: 'RECONCILIATION_REQUIRED' };
  }
}

export const reconciliationService = new ReconciliationService();
