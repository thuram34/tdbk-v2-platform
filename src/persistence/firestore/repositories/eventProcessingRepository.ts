/**
 * TDBK V2 — DURABLE EVENT PROCESSING REPOSITORY
 *
 * Firestore Path:
 * /tenants/{tenantId}/processedEvents/{eventId}
 *
 * This is the durable idempotency/in-flight lease used by the event bus.
 * A PROCESSING record may be reclaimed after its lease expires, while a
 * COMPLETED record permanently suppresses duplicate delivery.
 */

import { FirestoreTransaction } from '../../types';
import { firestoreClient } from '../firestoreClient';

export type EventProcessingStatus = 'PROCESSING' | 'COMPLETED';

export interface EventProcessingRecord {
  tenantId: string;
  eventId: string;
  idempotencyKey: string;
  status: EventProcessingStatus;
  workerId: string;
  leaseUntil: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class EventProcessingRepository {
  private static instance: EventProcessingRepository;

  private constructor() {}

  public static getInstance(): EventProcessingRepository {
    if (!EventProcessingRepository.instance) {
      EventProcessingRepository.instance = new EventProcessingRepository();
    }
    return EventProcessingRepository.instance;
  }

  private getPath(tenantId: string, eventId: string): string {
    return `/tenants/${tenantId}/processedEvents/${eventId}`;
  }

  public async claim(
    tenantId: string,
    eventId: string,
    idempotencyKey: string,
    workerId: string,
    leaseDurationMs = 30_000,
    transaction?: FirestoreTransaction,
  ): Promise<{ claimed: boolean; record: EventProcessingRecord | null }> {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const path = this.getPath(tenantId, eventId);

    const execute = async (tx: FirestoreTransaction) => {
      const current = await tx.get<EventProcessingRecord>(path);
      if (current?.status === 'COMPLETED') {
        return { claimed: false, record: current };
      }

      if (
        current?.status === 'PROCESSING' &&
        current.leaseUntil &&
        Date.parse(current.leaseUntil) > now
      ) {
        return { claimed: false, record: current };
      }

      const record: EventProcessingRecord = {
        tenantId,
        eventId,
        idempotencyKey,
        status: 'PROCESSING',
        workerId,
        leaseUntil: new Date(now + leaseDurationMs).toISOString(),
        completedAt: null,
        createdAt: current?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      await tx.set(path, record as unknown as Record<string, unknown>);
      return { claimed: true, record };
    };

    if (transaction) {
      return execute(transaction);
    }

    return firestoreClient.runTransaction(execute);
  }

  public async complete(
    tenantId: string,
    eventId: string,
    workerId: string,
  ): Promise<void> {
    const path = this.getPath(tenantId, eventId);
    await firestoreClient.runTransaction(async (transaction) => {
      const current = await transaction.get<EventProcessingRecord>(path);
      if (!current) return;
      if (current.status === 'COMPLETED') return;
      if (current.workerId !== workerId) {
        throw new Error(`Event processing lease is owned by '${current.workerId}', not '${workerId}'`);
      }

      const now = new Date().toISOString();
      await transaction.set(path, {
        ...current,
        status: 'COMPLETED',
        leaseUntil: null,
        completedAt: now,
        updatedAt: now,
      } as unknown as Record<string, unknown>);
    });
  }

  public async release(
    tenantId: string,
    eventId: string,
    workerId: string,
  ): Promise<void> {
    const path = this.getPath(tenantId, eventId);
    await firestoreClient.runTransaction(async (transaction) => {
      const current = await transaction.get<EventProcessingRecord>(path);
      if (!current || current.status === 'COMPLETED') return;
      if (current.workerId !== workerId) {
        return;
      }

      await transaction.delete(path);
    });
  }

  public async get(
    tenantId: string,
    eventId: string,
  ): Promise<EventProcessingRecord | null> {
    return firestoreClient.get<EventProcessingRecord>(this.getPath(tenantId, eventId));
  }
}

export const eventProcessingRepository = EventProcessingRepository.getInstance();
