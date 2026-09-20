/**
 * TDBK V2 — DURABLE FINANCIAL LEDGER REPOSITORY
 *
 * Canonical paths:
 * /tenants/{tenantId}/financialTransactions/{transactionId}
 * /tenants/{tenantId}/ledgerTransactions/{ledgerTransactionId}/entries/{entryId}
 *
 * Financial truth is committed atomically. Posted ledger entries are immutable:
 * there is no update operation for an entry, and reversal creates counter-entries.
 */
import {
  IFinancialLedgerRepository,
  FinancialTransaction,
  LedgerEntry,
  FirestoreTransaction,
  OutboxRecord,
} from '../../types';
import { firestoreClient } from '../firestoreClient';

export class FinancialLedgerRepository implements IFinancialLedgerRepository {
  private static instance: FinancialLedgerRepository;

  private constructor() {}

  public static getInstance(): FinancialLedgerRepository {
    return (this.instance ??= new FinancialLedgerRepository());
  }

  private transactionPath(tenantId: string, transactionId: string): string {
    return `/tenants/${tenantId}/financialTransactions/${transactionId}`;
  }

  private ledgerPath(tenantId: string, transactionId: string): string {
    return `/tenants/${tenantId}/ledgerTransactions/${transactionId}`;
  }

  private entryPath(tenantId: string, transactionId: string, entryId: string): string {
    return `${this.ledgerPath(tenantId, transactionId)}/entries/${entryId}`;
  }

  private outboxPath(tenantId: string, eventId: string): string {
    return `/tenants/${tenantId}/outbox/${eventId}`;
  }

  private buildFinancialOutboxRecord(
    transaction: FinancialTransaction,
    eventType: 'payment.posted.v1' | 'payment.reversed.v1',
    causationId: string,
  ): OutboxRecord {
    const occurredAt = transaction.postedAt ?? transaction.createdAt;
    return {
      eventId: `evt_${eventType.replace(/[^a-z0-9]+/gi, '_')}_${transaction.transactionId}`,
      tenantId: transaction.tenantId,
      branchId: transaction.branchId,
      eventType,
      eventVersion: 'v1',
      occurredAt,
      correlationId: transaction.correlationId,
      causationId,
      source: 'TDBK_FINANCE_TRUTH_LAYER',
      payload: {
        transactionId: transaction.transactionId,
        providerReference: transaction.providerReference,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        reversalOfTransactionId: transaction.reversalOfTransactionId ?? null,
      },
      status: 'PENDING',
      attemptCount: 0,
      availableAt: occurredAt,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      leaseOwner: null,
      leaseUntil: null,
      lastError: null,
      deliveredAt: null,
    };
  }

  private async ensureFinancialOutbox(
    tx: FirestoreTransaction,
    transaction: FinancialTransaction,
    eventType: 'payment.posted.v1' | 'payment.reversed.v1',
    causationId: string,
  ): Promise<void> {
    const record = this.buildFinancialOutboxRecord(transaction, eventType, causationId);
    const path = this.outboxPath(transaction.tenantId, record.eventId);
    const existing = await tx.get<OutboxRecord>(path);
    if (!existing) await tx.set(path, record);
  }

  private assertValidTransaction(transaction: FinancialTransaction): void {
    if (!transaction.tenantId || !transaction.transactionId) throw new Error('Financial transaction identity is required');
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) throw new Error('Financial transaction amount must be positive');
    if (!transaction.currency) throw new Error('Financial transaction currency is required');
    if (!transaction.providerReference) throw new Error('Financial transaction provider reference is required');
  }

  private assertBalanced(transaction: FinancialTransaction, entries: LedgerEntry[]): void {
    this.assertValidTransaction(transaction);
    if (entries.length < 2) throw new Error('A financial transaction requires at least one debit and one credit entry');

    const entryIds = new Set<string>();
    for (const entry of entries) {
      if (!entry.entryId || entryIds.has(entry.entryId)) throw new Error('Ledger entry IDs must be unique');
      entryIds.add(entry.entryId);
    }
    if (!entries.some((entry) => entry.entryType === 'DEBIT')) throw new Error('A financial transaction requires at least one debit entry');
    if (!entries.some((entry) => entry.entryType === 'CREDIT')) throw new Error('A financial transaction requires at least one credit entry');

    const debit = entries.filter((entry) => entry.entryType === 'DEBIT').reduce((sum, entry) => sum + entry.amount, 0);
    const credit = entries.filter((entry) => entry.entryType === 'CREDIT').reduce((sum, entry) => sum + entry.amount, 0);

    if (!Number.isFinite(debit) || !Number.isFinite(credit)) throw new Error('Ledger amounts must be finite');
    if (Math.abs(debit - credit) > 0.000001) throw new Error('Debit total must equal credit total');
    if (Math.abs(debit - transaction.amount) > 0.000001) throw new Error('Ledger total must equal transaction amount');

    for (const entry of entries) {
      if (
        entry.transactionId !== transaction.transactionId ||
        entry.tenantId !== transaction.tenantId ||
        entry.currency !== transaction.currency ||
        !Number.isFinite(entry.amount) ||
        entry.amount <= 0 ||
        !entry.account ||
        entry.immutable !== true
      ) {
        throw new Error('Invalid immutable ledger entry');
      }
    }
  }

  private writePostedState(
    tx: FirestoreTransaction,
    transaction: FinancialTransaction,
    entries: LedgerEntry[],
  ): Promise<void> {
    return (async () => {
      await tx.set(this.transactionPath(transaction.tenantId, transaction.transactionId), transaction);
      await tx.set(this.ledgerPath(transaction.tenantId, transaction.transactionId), {
        ledgerTransactionId: transaction.transactionId,
        tenantId: transaction.tenantId,
        transactionId: transaction.transactionId,
        status: 'POSTED',
        amount: transaction.amount,
        currency: transaction.currency,
        postedAt: transaction.postedAt,
        createdAt: transaction.createdAt,
      });
      for (const entry of entries) {
        await tx.set(this.entryPath(transaction.tenantId, transaction.transactionId, entry.entryId), entry);
      }
    })();
  }

  public async savePendingTransaction(transaction: FinancialTransaction): Promise<void> {
    this.assertValidTransaction(transaction);
    if (transaction.status !== 'PENDING') throw new Error('Pending transaction must have PENDING status');

    await firestoreClient.runTransaction(async (tx) => {
      const path = this.transactionPath(transaction.tenantId, transaction.transactionId);
      const existing = await tx.get<FinancialTransaction>(path);

      if (existing) {
        if (
          existing.providerReference !== transaction.providerReference ||
          existing.amount !== transaction.amount ||
          existing.currency !== transaction.currency
        ) {
          throw new Error('Conflicting financial transaction identity');
        }
        return;
      }

      await tx.set(path, transaction);
    });
  }

  public async bindPendingTransaction(
    tenantId: string,
    pendingTransactionId: string,
    boundTransaction: FinancialTransaction,
  ): Promise<void> {
    this.assertValidTransaction(boundTransaction);
    if (boundTransaction.status !== 'PENDING') throw new Error('Bound M-Pesa transaction must remain PENDING');
    if (boundTransaction.tenantId !== tenantId) throw new Error('Pending transaction tenant mismatch');

    await firestoreClient.runTransaction(async (tx) => {
      const sourcePath = this.transactionPath(tenantId, pendingTransactionId);
      const targetPath = this.transactionPath(tenantId, boundTransaction.transactionId);
      const source = await tx.get<FinancialTransaction>(sourcePath);
      if (!source) throw new Error('Pending initiation transaction not found');
      if (source.tenantId !== tenantId || source.status !== 'PENDING') {
        throw new Error('Pending initiation transaction is not bindable');
      }
      if (source.amount !== boundTransaction.amount || source.currency !== boundTransaction.currency) {
        throw new Error('Bound transaction amount/currency conflicts with initiation');
      }

      const existing = await tx.get<FinancialTransaction>(targetPath);
      if (existing) {
        if (
          existing.status === 'PENDING' &&
          existing.amount === boundTransaction.amount &&
          existing.currency === boundTransaction.currency &&
          existing.providerReference === boundTransaction.providerReference
        ) {
          await tx.delete(sourcePath);
          return;
        }
        throw new Error('Conflicting bound M-Pesa transaction already exists');
      }

      await tx.set(targetPath, {
        ...source,
        ...boundTransaction,
        tenantId,
        status: 'PENDING',
      });
      await tx.delete(sourcePath);
    });
  }

  public async failPendingTransaction(tenantId: string, transactionId: string, reason: string): Promise<void> {
    await firestoreClient.runTransaction(async (tx) => {
      const path = this.transactionPath(tenantId, transactionId);
      const existing = await tx.get<FinancialTransaction>(path);
      if (!existing) throw new Error('Pending transaction not found');
      if (existing.tenantId !== tenantId) throw new Error('Financial transaction tenant mismatch');
      if (existing.status === 'FAILED') return;
      if (existing.status !== 'PENDING') throw new Error('Only PENDING transactions can be failed');
      await tx.update<FinancialTransaction>(path, {
        status: 'FAILED',
        description: `${existing.description} [${reason}]`,
      });
    });
  }

  public async postTransaction(transaction: FinancialTransaction, entries: LedgerEntry[]): Promise<void> {
    this.assertBalanced(transaction, entries);
    if (transaction.status !== 'POSTED') throw new Error('Posted transaction must have POSTED status');

    await firestoreClient.runTransaction(async (tx) => {
      const existing = await tx.get<FinancialTransaction>(
        this.transactionPath(transaction.tenantId, transaction.transactionId)
      );

      if (existing) {
        if (
          existing.status === 'POSTED' &&
          existing.amount === transaction.amount &&
          existing.currency === transaction.currency &&
          existing.providerReference === transaction.providerReference
        ) {
          const existingEntries = await Promise.all(
            entries.map((entry) => tx.get<LedgerEntry>(this.entryPath(transaction.tenantId, transaction.transactionId, entry.entryId)))
          );
          if (existingEntries.every((entry) => entry !== null)) {
            const matches = existingEntries.every((existing, index) => {
              const requested = entries[index];
              return !!existing &&
                existing.entryId === requested.entryId &&
                existing.transactionId === requested.transactionId &&
                existing.tenantId === requested.tenantId &&
                existing.account === requested.account &&
                existing.entryType === requested.entryType &&
                existing.amount === requested.amount &&
                existing.currency === requested.currency &&
                existing.immutable === true;
            });
            if (matches) {
              await this.ensureFinancialOutbox(tx, transaction, 'payment.posted.v1', transaction.providerReference);
              return;
            }
            throw new Error('Posted financial transaction has conflicting immutable ledger entries');
          }
          throw new Error('Posted financial transaction is missing immutable ledger entries');
        }
        throw new Error('Financial transaction already exists in a non-posted or conflicting state');
      }

      await this.writePostedState(tx, transaction, entries);
      await this.ensureFinancialOutbox(tx, transaction, 'payment.posted.v1', transaction.providerReference);
    });
  }

  public async confirmReconciledTransaction(
    transaction: FinancialTransaction,
    entries: LedgerEntry[],
    outboxRecord?: import('../../types').OutboxRecord,
  ): Promise<void> {
    this.assertBalanced(transaction, entries);
    if (transaction.status !== 'POSTED') throw new Error('Confirmed transaction must have POSTED status');
    if (!transaction.postedAt) throw new Error('Confirmed transaction must have postedAt');

    await firestoreClient.runTransaction(async (tx) => {
      const path = this.transactionPath(transaction.tenantId, transaction.transactionId);
      const existing = await tx.get<FinancialTransaction>(path);

      if (!existing) throw new Error('Financial transaction not found for reconciliation confirmation');
      if (existing.tenantId !== transaction.tenantId) throw new Error('Financial transaction tenant mismatch');

      if (existing.status === 'POSTED') {
        if (
          existing.amount !== transaction.amount ||
          existing.currency !== transaction.currency ||
          existing.providerReference !== transaction.providerReference
        ) {
          throw new Error('Conflicting already-posted financial transaction');
        }

        // A POSTED transaction is authoritative, but derived state may be
        // incomplete after a crash between durable writes in an older revision.
        // Replays must reconstruct only missing immutable artifacts and must
        // reject any conflicting artifact rather than silently accepting it.
        const existingEntries = await Promise.all(
          entries.map((entry) =>
            tx.get<LedgerEntry>(this.entryPath(transaction.tenantId, transaction.transactionId, entry.entryId))
          )
        );

        for (let index = 0; index < entries.length; index += 1) {
          const expected = entries[index];
          const actual = existingEntries[index];

          if (!actual) {
            await tx.set(this.entryPath(transaction.tenantId, transaction.transactionId, expected.entryId), expected);
            continue;
          }

          if (
            actual.transactionId !== expected.transactionId ||
            actual.tenantId !== expected.tenantId ||
            actual.account !== expected.account ||
            actual.entryType !== expected.entryType ||
            actual.amount !== expected.amount ||
            actual.currency !== expected.currency ||
            actual.immutable !== true
          ) {
            throw new Error('Existing immutable ledger entry conflicts with authoritative transaction');
          }
        }

        if (outboxRecord) {
          const outboxPath = this.outboxPath(transaction.tenantId, outboxRecord.eventId);
          const existingOutbox = await tx.get<import('../../types').OutboxRecord>(outboxPath);

          if (!existingOutbox) {
            await tx.set(outboxPath, outboxRecord);
          } else if (
            existingOutbox.tenantId !== outboxRecord.tenantId ||
            existingOutbox.eventType !== outboxRecord.eventType ||
            existingOutbox.eventVersion !== outboxRecord.eventVersion ||
            existingOutbox.causationId !== outboxRecord.causationId ||
            existingOutbox.payload.transactionId !== outboxRecord.payload.transactionId ||
            existingOutbox.payload.providerReference !== outboxRecord.payload.providerReference ||
            existingOutbox.payload.amount !== outboxRecord.payload.amount ||
            existingOutbox.payload.currency !== outboxRecord.payload.currency
          ) {
            throw new Error('Existing outbox record conflicts with authoritative transaction');
          }
        }

        return;
      }

      if (existing.status !== 'RECONCILIATION_REQUIRED') {
        throw new Error(
          `Only RECONCILIATION_REQUIRED transactions may be authoritatively confirmed; found '${existing.status}'`
        );
      }

      if (
        existing.amount !== transaction.amount ||
        existing.currency !== transaction.currency ||
        existing.providerReference !== transaction.providerReference
      ) {
        throw new Error('Reconciliation confirmation identity conflicts with original transaction');
      }

      const confirmed: FinancialTransaction = {
        ...existing,
        ...transaction,
        transactionId: existing.transactionId,
        tenantId: existing.tenantId,
        status: 'POSTED',
        postedAt: transaction.postedAt,
        reversedAt: null,
      };

      await this.writePostedState(tx, confirmed, entries);
      if (outboxRecord) {
        await tx.set(
          `/tenants/${transaction.tenantId}/outbox/${outboxRecord.eventId}`,
          outboxRecord,
        );
      }
    });
  }

  public async reverseTransaction(
    tenantId: string,
    transactionId: string,
    reversalTransaction: FinancialTransaction,
    reversalEntries: LedgerEntry[],
  ): Promise<void> {
    if (reversalTransaction.reversalOfTransactionId !== transactionId) {
      throw new Error('Reversal must reference the original transaction');
    }
    this.assertBalanced(reversalTransaction, reversalEntries);
    if (reversalTransaction.status !== 'POSTED') throw new Error('Reversal transaction must be POSTED');

    await firestoreClient.runTransaction(async (tx) => {
      const originalPath = this.transactionPath(tenantId, transactionId);
      const original = await tx.get<FinancialTransaction>(originalPath);

      if (!original) throw new Error('Original financial transaction not found');
      if (original.status === 'REVERSED') return;
      if (original.status !== 'POSTED') throw new Error('Only POSTED transactions can be reversed');
      if (original.tenantId !== tenantId) throw new Error('Cross-tenant reversal denied');
      if (reversalTransaction.amount !== original.amount || reversalTransaction.currency !== original.currency) {
        throw new Error('Reversal amount/currency must match original transaction');
      }

      const reversalPath = this.transactionPath(tenantId, reversalTransaction.transactionId);
      const existingReversal = await tx.get<FinancialTransaction>(reversalPath);
      if (existingReversal) {
        if (existingReversal.reversalOfTransactionId !== transactionId) {
          throw new Error('Conflicting reversal transaction identity');
        }
        return;
      }

      await tx.update<FinancialTransaction>(originalPath, {
        status: 'REVERSED',
        reversedAt: reversalTransaction.postedAt,
      });
      await this.writePostedState(tx, reversalTransaction, reversalEntries);
      await this.ensureFinancialOutbox(tx, reversalTransaction, 'payment.reversed.v1', reversalTransaction.providerReference);
    });
  }

  public async getTransaction(tenantId: string, transactionId: string): Promise<FinancialTransaction | null> {
    return firestoreClient.get<FinancialTransaction>(this.transactionPath(tenantId, transactionId));
  }

  public async listEntries(tenantId: string, transactionId: string): Promise<LedgerEntry[]> {
    return firestoreClient.listCollection<LedgerEntry>(
      `${this.ledgerPath(tenantId, transactionId)}/entries`
    );
  }
}

export const financialLedgerRepository = FinancialLedgerRepository.getInstance();
