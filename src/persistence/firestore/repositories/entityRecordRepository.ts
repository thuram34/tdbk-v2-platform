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
    await firestoreClient.set(
      this.getPath(tenantId, capabilityId, recordId),
      record as unknown as Record<string, unknown>
    );
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
