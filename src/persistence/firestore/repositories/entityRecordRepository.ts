/**
 * TDBK V2 — ENTITY RECORD REPOSITORY
 * Firestore Path: /tenants/{tenantId}/entities/{capabilityId}/records/{recordId}
 */

import { IEntityRecordRepository } from '../../types';
import { ExperienceEntityRecord } from '../../../experience/types';
import { firestoreClient } from '../firestoreClient';

export class EntityRecordRepository implements IEntityRecordRepository {
  private static instance: EntityRecordRepository;

  private constructor() {}

  public static getInstance(): EntityRecordRepository {
    if (!EntityRecordRepository.instance) {
      EntityRecordRepository.instance = new EntityRecordRepository();
    }
    return EntityRecordRepository.instance;
  }

  private getPath(tenantId: string, capabilityId: string, recordId: string): string {
    return `/tenants/${tenantId}/entities/${capabilityId}/records/${recordId}`;
  }

  public async saveRecord(
    tenantId: string,
    capabilityId: string,
    recordId: string,
    record: ExperienceEntityRecord
  ): Promise<void> {
    const path = this.getPath(tenantId, capabilityId, recordId);
    // Deterministic command retries must not overwrite an already-created
    // authoritative record with a newly generated timestamp/payload.
    const existing = await firestoreClient.get<ExperienceEntityRecord>(path);
    if (existing) {
      if (existing.entityType !== capabilityId || existing.id !== recordId) {
        throw new Error(`Entity record identity conflict for '${recordId}'`);
      }
      return;
    }
    await firestoreClient.set(path, record as unknown as Record<string, unknown>);
  }

  public async createIfAbsent(
    tenantId: string,
    capabilityId: string,
    recordId: string,
    record: ExperienceEntityRecord
  ): Promise<ExperienceEntityRecord> {
    const path = this.getPath(tenantId, capabilityId, recordId);
    return firestoreClient.runTransaction(async (tx) => {
      const existing = await tx.get<ExperienceEntityRecord>(path);
      if (existing) {
        if (existing.entityType !== capabilityId || existing.id !== recordId) {
          throw new Error("Entity record identity conflict for '" + recordId + "'");
        }
        return existing;
      }
      await tx.set(path, record as unknown as Record<string, unknown>);
      return record;
    });
  }
  public async getRecord(
    tenantId: string,
    capabilityId: string,
    recordId: string
  ): Promise<ExperienceEntityRecord | null> {
    return await firestoreClient.get<ExperienceEntityRecord>(
      this.getPath(tenantId, capabilityId, recordId)
    );
  }

  public async listRecords(
    tenantId: string,
    capabilityId: string,
    branchId?: string | null
  ): Promise<ExperienceEntityRecord[]> {
    const records = await firestoreClient.listCollection<ExperienceEntityRecord>(
      `/tenants/${tenantId}/entities/${capabilityId}/records`
    );

    if (branchId) {
      return records.filter((r) => !r.branchId || r.branchId === branchId);
    }
    return records;
  }

  public async deleteRecord(tenantId: string, capabilityId: string, recordId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, capabilityId, recordId));
  }
}

export const entityRecordRepository = EntityRecordRepository.getInstance();
