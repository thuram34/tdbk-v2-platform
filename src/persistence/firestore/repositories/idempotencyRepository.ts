/**
 * TDBK V2 — IDEMPOTENCY REPOSITORY
 * Firestore Path: /tenants/{tenantId}/idempotency/{idempotencyKey}
 */

import { IIdempotencyRepository, IdempotencyClaimResult, IdempotencyRecord } from '../../types';
import { firestoreClient } from '../firestoreClient';

export class IdempotencyRepository implements IIdempotencyRepository {
  private static instance: IdempotencyRepository;

  private constructor() {}

  public static getInstance(): IdempotencyRepository {
    if (!IdempotencyRepository.instance) {
      IdempotencyRepository.instance = new IdempotencyRepository();
    }
    return IdempotencyRepository.instance;
  }

  private getPath(tenantId: string, key: string): string {
    return `/tenants/${tenantId}/idempotency/${key}`;
  }

  public async claimIdempotencyRecord(
    tenantId: string,
    key: string,
    record: IdempotencyRecord
  ): Promise<IdempotencyClaimResult> {
    const path = this.getPath(tenantId, key);
    return await firestoreClient.runTransaction(async (transaction) => {
      const existing = await transaction.get<IdempotencyRecord>(path);
      if (existing?.status === 'COMPLETED') return 'COMPLETED';

      if (existing?.status === 'IN_PROGRESS') {
        const expiresAt = new Date(existing.expiresAt).getTime();
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return 'IN_PROGRESS';
      }

      await transaction.set(path, record as unknown as Record<string, unknown>);
      return 'CLAIMED';
    });
  }

  public async completeIdempotencyRecord(
    tenantId: string,
    key: string,
    responsePayload?: Record<string, unknown>
  ): Promise<void> {
    const path = this.getPath(tenantId, key);
    await firestoreClient.runTransaction(async (transaction) => {
      const existing = await transaction.get<IdempotencyRecord>(path);
      if (!existing) throw new Error('Cannot complete missing idempotency record');
      await transaction.update<IdempotencyRecord>(path, {
        status: 'COMPLETED',
        responsePayload,
      });
    });
  }

  public async failIdempotencyRecord(
    tenantId: string,
    key: string,
    responsePayload?: Record<string, unknown>
  ): Promise<void> {
    const path = this.getPath(tenantId, key);
    await firestoreClient.runTransaction(async (transaction) => {
      const existing = await transaction.get<IdempotencyRecord>(path);
      if (!existing) return;
      await transaction.update<IdempotencyRecord>(path, {
        status: 'FAILED',
        responsePayload,
      });
    });
  }

  public async saveIdempotencyRecord(
    tenantId: string,
    key: string,
    record: IdempotencyRecord
  ): Promise<void> {
    await firestoreClient.set(
      this.getPath(tenantId, key),
      record as unknown as Record<string, unknown>
    );
  }

  public async getIdempotencyRecord(tenantId: string, key: string): Promise<IdempotencyRecord | null> {
    return await firestoreClient.get<IdempotencyRecord>(this.getPath(tenantId, key));
  }

  public async deleteIdempotencyRecord(tenantId: string, key: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, key));
  }
}

export const idempotencyRepository = IdempotencyRepository.getInstance();
