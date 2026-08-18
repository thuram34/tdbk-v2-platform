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
    return await firestoreClient.runTransaction(async (transaction) => {
      const allRecords = await firestoreClient.listCollection<OutboxRecord>(this.getCollectionPath(tenantId));
      const nowMs = Date.now();

      const eligible = allRecords.find((r) => {
        if (r.status === 'PENDING') return true;
        if (r.status === 'RETRY_WAIT' && r.availableAt && new Date(r.availableAt).getTime() <= nowMs) return true;
        if (r.status === 'PROCESSING' && r.leaseUntil && new Date(r.leaseUntil).getTime() <= nowMs) return true;
        return false;
      });

      if (!eligible) return null;

      const nowIso = new Date(nowMs).toISOString();
      const leaseUntilIso = new Date(nowMs + leaseDurationMs).toISOString();
      const updatedRecord: OutboxRecord = {
        ...eligible,
        status: 'PROCESSING',
        attemptCount: (eligible.attemptCount || 0) + 1,
        leaseOwner: workerId,
        leaseUntil: leaseUntilIso,
        updatedAt: nowIso,
      };

      const path = this.getPath(tenantId, eligible.eventId);
      await transaction.set(path, updatedRecord as unknown as Record<string, unknown>);
      return updatedRecord;
    });
  }

  public async updateStatus(
    tenantId: string,
    eventId: string,
    status: OutboxStatus,
    extra?: Partial<OutboxRecord>
  ): Promise<void> {
    const path = this.getPath(tenantId, eventId);
    const existing = await firestoreClient.get<OutboxRecord>(path);
    if (!existing) {
      throw new KernelError('NOT_FOUND', `Outbox record '${eventId}' not found for tenant '${tenantId}'`, 404);
    }

    const now = new Date().toISOString();
    const updated: OutboxRecord = {
      ...existing,
      status,
      updatedAt: now,
      ...(extra || {}),
    };

    if (status === 'DELIVERED') {
      updated.deliveredAt = now;
      updated.leaseOwner = null;
      updated.leaseUntil = null;
    }

    await firestoreClient.set(path, updated as unknown as Record<string, unknown>);
  }

  public async deleteOutbox(tenantId: string, eventId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, eventId));
  }
}

export const outboxRepository = OutboxRepository.getInstance();
