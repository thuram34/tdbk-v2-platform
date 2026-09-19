/** TDBK V2 — CANONICAL BUSINESS STATE SNAPSHOT REPOSITORY */

import { firestoreClient } from '../firestoreClient';
import { BusinessStateSnapshot } from '../../../platform/businessState/types';

export class BusinessStateRepository {
  private static instance: BusinessStateRepository;
  private constructor() {}

  public static getInstance(): BusinessStateRepository {
    if (!BusinessStateRepository.instance) BusinessStateRepository.instance = new BusinessStateRepository();
    return BusinessStateRepository.instance;
  }

  private path(tenantId: string): string {
    return `/tenants/${tenantId}/businessState/current`;
  }

  public async getCurrent(tenantId: string): Promise<BusinessStateSnapshot | null> {
    return firestoreClient.get<BusinessStateSnapshot>(this.path(tenantId));
  }

  public async save(snapshot: BusinessStateSnapshot): Promise<void> {
    await firestoreClient.set(this.path(snapshot.tenantId), snapshot as unknown as Record<string, unknown>);
  }

  public async saveNextVersion(
    snapshot: BusinessStateSnapshot,
    expectedVersion: number | null,
  ): Promise<BusinessStateSnapshot> {
    return firestoreClient.runTransaction(async (tx) => {
      const path = this.path(snapshot.tenantId);
      const current = await tx.get<BusinessStateSnapshot>(path);
      const currentVersion = current?.version ?? 0;
      if (expectedVersion !== null && currentVersion !== expectedVersion) {
        throw new Error(
          `Business state version conflict for tenant '${snapshot.tenantId}': expected ${expectedVersion}, found ${currentVersion}.`,
        );
      }
      const next = {
        ...snapshot,
        version: currentVersion + 1,
        snapshotId: `state_${snapshot.tenantId}_${currentVersion + 1}`,
      };
      await tx.set(path, next as unknown as Record<string, unknown>);
      return next;
    });
  }
}

export const businessStateRepository = BusinessStateRepository.getInstance();
