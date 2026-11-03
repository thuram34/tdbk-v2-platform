import {
  FinancialTransaction,
  FinancialTransactionStatus,
  IReconciliationRepository,
} from '../../types';
import { firestoreClient } from '../firestoreClient';

export class ReconciliationRepository implements IReconciliationRepository {
  private static instance: ReconciliationRepository;

  private constructor() {}

  public static getInstance(): ReconciliationRepository {
    return (this.instance ??= new ReconciliationRepository());
  }

  private path(tenantId: string, transactionId: string): string {
    return `/tenants/${tenantId}/financialTransactions/${transactionId}`;
  }

  public async markRequired(
    tenantId: string,
    transactionId: string,
    expectedStatus: FinancialTransactionStatus,
    updates: Partial<Pick<FinancialTransaction, 'providerReference' | 'description'>> = {},
  ): Promise<FinancialTransaction> {
    return firestoreClient.runTransaction(async (tx) => {
      const path = this.path(tenantId, transactionId);
      const current = await tx.get<FinancialTransaction>(path);

      if (!current) throw new Error('Financial transaction not found');
      if (current.tenantId !== tenantId) throw new Error('Financial transaction tenant mismatch');

      if (current.status === 'POSTED' || current.status === 'REVERSED') {
        throw new Error('Posted/reversed financial history cannot be changed to reconciliation-required');
      }

      // A failed reconciliation is terminal and safe to resolve idempotently.
      // Do not generalize this shortcut to POSTED or REVERSED: those require
      // authoritative ledger posting or the dedicated reversal operation.
      if (status === 'FAILED' && current.status === 'FAILED') return current;

      if (current.status !== expectedStatus && current.status !== 'RECONCILIATION_REQUIRED') {
        throw new Error(
          `Financial transaction status conflict: expected '${expectedStatus}', found '${current.status}'`
        );
      }

      if (updates.providerReference && !updates.providerReference.trim()) {
        throw new Error('Reconciliation provider reference cannot be empty');
      }

      if (current.status === 'RECONCILIATION_REQUIRED') {
        if (updates.providerReference && current.providerReference !== updates.providerReference) {
          throw new Error('Reconciliation-required provider reference cannot be changed');
        }
        return current;
      }

      const updated: FinancialTransaction = {
        ...current,
        ...updates,
        status: 'RECONCILIATION_REQUIRED',
      };
      await tx.set(path, updated);
      return updated;
    });
  }

  public async resolve(
    tenantId: string,
    transactionId: string,
    expectedStatus: FinancialTransactionStatus,
    status: Extract<FinancialTransactionStatus, 'POSTED' | 'FAILED' | 'REVERSED'>
  ): Promise<FinancialTransaction> {
    return firestoreClient.runTransaction(async (tx) => {
      const path = this.path(tenantId, transactionId);
      const current = await tx.get<FinancialTransaction>(path);

      if (!current) throw new Error('Financial transaction not found');
      if (current.tenantId !== tenantId) throw new Error('Financial transaction tenant mismatch');

      if (current.status !== expectedStatus && current.status !== 'RECONCILIATION_REQUIRED') {
        throw new Error(
          `Financial transaction status conflict: expected '${expectedStatus}', found '${current.status}'`
        );
      }

      if (status === 'POSTED') {
        if (current.status !== 'RECONCILIATION_REQUIRED') {
          throw new Error('Only reconciliation-required transactions may be confirmed');
        }
        throw new Error('Confirmation requires an authoritative ledger posting, not a status-only mutation');
      }

      if (status === 'REVERSED') {
        throw new Error('Reversal must use the ledger reversal operation, not a status-only mutation');
      }

      const updated: FinancialTransaction = {
        ...current,
        status: 'FAILED',
      };
      await tx.set(path, updated);
      return updated;
    });
  }

  public async get(tenantId: string, transactionId: string): Promise<FinancialTransaction | null> {
    return firestoreClient.get<FinancialTransaction>(this.path(tenantId, transactionId));
  }
}

export const reconciliationRepository = ReconciliationRepository.getInstance();
