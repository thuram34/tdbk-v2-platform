/**
 * TDBK V2 — DBK REGISTRY REPOSITORY
 * Firestore Path: /tenants/{tenantId}
 */

import { IDbkRegistryRepository } from '../../types';
import { DbkIdentity } from '../../../platform/types';
import { firestoreClient } from '../firestoreClient';

export class DbkRegistryRepository implements IDbkRegistryRepository {
  private static instance: DbkRegistryRepository;

  private constructor() {}

  public static getInstance(): DbkRegistryRepository {
    if (!DbkRegistryRepository.instance) {
      DbkRegistryRepository.instance = new DbkRegistryRepository();
    }
    return DbkRegistryRepository.instance;
  }

  private getPath(tenantId: string): string {
    return `/tenants/${tenantId}`;
  }

  public async saveDbk(tenantId: string, dbk: DbkIdentity): Promise<void> {
    await firestoreClient.set(this.getPath(tenantId), dbk as unknown as Record<string, unknown>);
  }

  public async getDbk(tenantId: string): Promise<DbkIdentity | null> {
    return await firestoreClient.get<DbkIdentity>(this.getPath(tenantId));
  }

  public async listAllDbks(): Promise<DbkIdentity[]> {
    return await firestoreClient.listCollection<DbkIdentity>('/tenants');
  }

  public async hasDbk(tenantId: string): Promise<boolean> {
    const dbk = await this.getDbk(tenantId);
    return dbk !== null;
  }

  public async deleteDbk(tenantId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId));
  }
}

export const dbkRegistryRepository = DbkRegistryRepository.getInstance();
