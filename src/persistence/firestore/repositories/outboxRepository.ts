/**
 * TDBK V2 — OUTBOX REPOSITORY
 * Firestore Path: /tenants/{tenantId}/outbox/{eventId}
 */

import { IOutboxRepository, OutboxRecord, OutboxStatus, FirestoreTransaction } from '../../types';
import { firestoreClient } from '../firestoreClient';
import { KernelError } from '../../../kernel/errors/kernelErrors';

export class OutboxRepository implements IOutboxRepository {
  private static instance: OutboxRepository;

  private constructor() {}

  public static getInstance(): OutboxRepository {
    if (!OutboxRepository.instance) {
      OutboxRepository.instance = new OutboxRepository();
    }
    return OutboxRepository.instance;
  }

  private getPath(tenantId: string, eventId: string): string {
    return `/tenants/${tenantId}/outbox/${eventId}`;
  }

  private getCollectionPath(tenantId: string): string {
    return `/tenants/${tenantId}/outbox`;
  }

  public async saveOutbox(
    tenantId: string,
    eventId: string,
    record: OutboxRecord,
    transaction?: FirestoreTransaction
  ): Promise<void> {
    const path = this.getPath(tenantId, eventId);
    if (transaction) {
      await transaction.set(path, record as unknown as Record<string, unknown>);
    } else {
      await firestoreClient.set(path, record as unknown as Record<string, unknown>);
    }
  }

  public async getOutbox(tenantId: string, eventId: string): Promise<OutboxRecord | null> {
    return await firestoreClient.get<OutboxRecord>(this.getPath(tenantId, eventId));
  }

  public async listOutbox(tenantId: string, status?: OutboxStatus): Promise<OutboxRecord[]> {
    const allRecords = await firestoreClient.listCollection<OutboxRecord>(this.getCollectionPath(tenantId));
    if (status) {
      return allRecords.filter((r) => r.status === status);
    }
    return allRecords;
  }

  public async claimNextPending(
    tenantId: string,
    workerId: string,
    leaseDurationMs: number
  ): Promise<OutboxRecord | null> {
    // Candidate discovery is intentionally outside the transaction because the
    // persistence abstraction exposes document reads, not collection queries, on
    // FirestoreTransaction. The authoritative candidate is re-read INSIDE the
    // transaction before claiming, preventing two workers from claiming the same
    // record based on a stale collection snapshot.
    const candidates = await this.listOutbox(tenantId);
    const nowMs = Date.now();
    const eligibleCandidates = candidates.filter((r) =>
      r.status === 'PENDING' ||
      (r.status === 'RETRY_WAIT' && r.availableAt && new Date(r.availableAt).getTime() <= nowMs) ||
      (r.status === 'PROCESSING' && r.leaseUntil && new Date(r.leaseUntil).getTime() <= nowMs)
    );

    for (const candidate of eligibleCandidates) {
      const claimed = await firestoreClient.runTransaction(async (transaction) => {
        const current = await transaction.get<OutboxRecord>(this.getPath(tenantId, candidate.eventId));
        if (!current) return null;
        const now = Date.now();
        const eligible =
          current.status === 'PENDING' ||
          (current.status === 'RETRY_WAIT' && !!current.availableAt && Date.parse(current.availableAt) <= now) ||
          (current.status === 'PROCESSING' && !!current.leaseUntil && Date.parse(current.leaseUntil) <= now);
        if (!eligible) return null;

        const nowIso = new Date(now).toISOString();
        const updatedRecord: OutboxRecord = {
          ...current,
          status: 'PROCESSING',
          attemptCount: (current.attemptCount || 0) + 1,
          leaseOwner: workerId,
          leaseUntil: new Date(now + leaseDurationMs).toISOString(),
          updatedAt: nowIso,
        };
        await transaction.set(this.getPath(tenantId, current.eventId), updatedRecord as unknown as Record<string, unknown>);
        return updatedRecord;
      });
      if (claimed) return claimed;
    }
    return null;
  }

  public async updateStatus(
    tenantId: string,
    eventId: string,
    status: OutboxStatus,
    extra?: Partial<OutboxRecord>,
    expectedLeaseOwner?: string
  ): Promise<void> {
    const path = this.getPath(tenantId, eventId);
    await firestoreClient.runTransaction(async (transaction) => {
      const existing = await transaction.get<OutboxRecord>(path);
      if (!existing) {
        throw new KernelError('NOT_FOUND', `Outbox record '${eventId}' not found for tenant '${tenantId}'`, 404);
      }
      if (expectedLeaseOwner && (existing.status !== 'PROCESSING' || existing.leaseOwner !== expectedLeaseOwner)) {
        throw new KernelError('CONFLICT', `Outbox lease for '${eventId}' is no longer owned by '${expectedLeaseOwner}'`, 409);
      }

      const now = new Date().toISOString();
      const updated: OutboxRecord = { ...existing, status, updatedAt: now, ...(extra || {}) };
      if (status === 'DELIVERED') {
        updated.deliveredAt = now;
        updated.leaseOwner = null;
        updated.leaseUntil = null;
      }
      await transaction.set(path, updated as unknown as Record<string, unknown>);
    });
  }

  public async deleteOutbox(tenantId: string, eventId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, eventId));
  }
}

export const outboxRepository = OutboxRepository.getInstance();
