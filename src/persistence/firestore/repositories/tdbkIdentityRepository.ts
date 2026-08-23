/**
 * TDBK V2 — AUTHORITATIVE IDENTITY REPOSITORY
 * Firestore Path: /tdbk_identities/{uid}
 * Architectural Layer: LAYER 1 — KERNEL / PERSISTENCE
 */

import { ITdbkIdentityRepository, FirestoreTransaction } from '../../types';
import { TdbkIdentityRecord } from '../../../kernel/identity/types';
import { firestoreClient } from '../firestoreClient';

export class TdbkIdentityRepository implements ITdbkIdentityRepository {
  private static instance: TdbkIdentityRepository;

  private constructor() {}

  public static getInstance(): TdbkIdentityRepository {
    if (!TdbkIdentityRepository.instance) {
      TdbkIdentityRepository.instance = new TdbkIdentityRepository();
    }
    return TdbkIdentityRepository.instance;
  }

  private getPath(uid: string): string {
    return `/tenants/system/identities/${uid}`;
  }

  public async saveIdentity(uid: string, identity: TdbkIdentityRecord): Promise<void> {
    await firestoreClient.set(this.getPath(uid), identity as unknown as Record<string, unknown>);
  }

  public async getIdentity(uid: string): Promise<TdbkIdentityRecord | null> {
    return await firestoreClient.get<TdbkIdentityRecord>(this.getPath(uid));
  }

  public async listIdentities(tenantId?: string): Promise<TdbkIdentityRecord[]> {
    const all = await firestoreClient.listCollection<TdbkIdentityRecord>('/tenants/system/identities');
    if (!tenantId) {
      return all;
    }
    return all.filter((rec) => rec.tenantId === tenantId);
  }

  public async hasIdentity(uid: string): Promise<boolean> {
    const identity = await this.getIdentity(uid);
    return identity !== null;
  }

  public async hasMasterIdentity(): Promise<boolean> {
    const all = await firestoreClient.listCollection<TdbkIdentityRecord>('/tenants/system/identities');
    return all.some((rec) => rec.isMaster === true && rec.roles.includes('TDBK_MASTER_ADMIN'));
  }

  public async deleteIdentity(uid: string): Promise<void> {
    await firestoreClient.delete(this.getPath(uid));
  }

  public async runTransaction<T>(updateFunction: (transaction: FirestoreTransaction) => Promise<T>): Promise<T> {
    return await firestoreClient.runTransaction(updateFunction);
  }
}

export const tdbkIdentityRepository = TdbkIdentityRepository.getInstance();
