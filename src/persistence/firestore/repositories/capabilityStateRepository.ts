/**
 * TDBK V2 — CAPABILITY STATE REPOSITORY
 * Firestore Path: /tenants/{tenantId}/capabilities/{capabilityId}
 */

import { ICapabilityStateRepository } from '../../types';
import { DbkCapabilityRecord } from '../../../capability/types';
import { firestoreClient } from '../firestoreClient';

export class CapabilityStateRepository implements ICapabilityStateRepository {
  private static instance: CapabilityStateRepository;

  private constructor() {}

  public static getInstance(): CapabilityStateRepository {
    if (!CapabilityStateRepository.instance) {
      CapabilityStateRepository.instance = new CapabilityStateRepository();
    }
    return CapabilityStateRepository.instance;
  }

  private getPath(tenantId: string, capabilityId: string): string {
    return `/tenants/${tenantId}/capabilities/${capabilityId}`;
  }

  public async saveCapabilityState(
    tenantId: string,
    capabilityId: string,
    record: DbkCapabilityRecord
  ): Promise<void> {
    await firestoreClient.set(this.getPath(tenantId, capabilityId), record as unknown as Record<string, unknown>);
  }

  public async getCapabilityState(
    tenantId: string,
    capabilityId: string
  ): Promise<DbkCapabilityRecord | null> {
    return await firestoreClient.get<DbkCapabilityRecord>(this.getPath(tenantId, capabilityId));
  }

  public async listCapabilityStates(tenantId: string): Promise<DbkCapabilityRecord[]> {
    return await firestoreClient.listCollection<DbkCapabilityRecord>(`/tenants/${tenantId}/capabilities`);
  }

  public async deleteCapabilityState(tenantId: string, capabilityId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, capabilityId));
  }
}

export const capabilityStateRepository = CapabilityStateRepository.getInstance();
