import { reconciliationRepository } from '../persistence/firestore/repositories/reconciliationRepository';
import type { FinancialTransaction, FinancialTransactionStatus, LedgerEntry } from './types';
import type { OutboxRecord } from '../persistence/types';

export class ReconciliationService {
  public async markRequired(
    tenantId: string,
    transactionId: string,
    expectedStatus: FinancialTransactionStatus = 'PENDING',
    updates: Partial<Pick<FinancialTransaction, 'providerReference' | 'description'>> = {},
  ): Promise<FinancialTransaction> {
    return reconciliationRepository.markRequired(tenantId, transactionId, expectedStatus, updates);
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
    entries: LedgerEntry[],
    outboxRecord?: OutboxRecord,
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

    // Validate the provider confirmation against authoritative transaction identity
    // before any ledger-balance checks. A changed amount/reference/currency/branch is
    // an identity conflict, not a ledger-shape error.
    const identityFields: Array<keyof FinancialTransaction> = ['tenantId', 'transactionId', 'branchId', 'providerReference', 'currency', 'amount'];
    const identityConflict = identityFields.some((field) => current[field] !== transaction[field]);
    if (identityConflict) {
      throw new Error('Authoritative reconciliation identity conflicts with persisted transaction');
    }

    const occurredAt = transaction.postedAt!;
    const confirmationOutbox = outboxRecord ?? {
      eventId: `evt_payment_confirmed_${transaction.transactionId}`,
      tenantId: transaction.tenantId, branchId: transaction.branchId,
      eventType: 'payment.confirmed.v1', eventVersion: 'v1', occurredAt,
      correlationId: transaction.correlationId, causationId: transaction.providerReference,
      source: 'TDBK_RECONCILIATION_SERVICE',
      payload: { transactionId: transaction.transactionId, providerReference: transaction.providerReference, amount: transaction.amount, currency: transaction.currency, status: 'POSTED' },
      status: 'PENDING' as const, attemptCount: 0, availableAt: occurredAt, createdAt: occurredAt, updatedAt: occurredAt,
      leaseOwner: null, leaseUntil: null, lastError: null, deliveredAt: null,
    };
    const { financialLedgerRepository } = await import(
      '../persistence/firestore/repositories/financialLedgerRepository'
    );
    await financialLedgerRepository.confirmReconciledTransaction(
      transaction,
      entries,
      confirmationOutbox,
    );
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
