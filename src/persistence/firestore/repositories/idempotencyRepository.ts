/**
 * TDBK V2 — IDEMPOTENCY REPOSITORY
 * Firestore Path: /tenants/{tenantId}/idempotency/{idempotencyKey}
 */

import { IIdempotencyRepository, IdempotencyRecord } from '../../types';
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
