/**
 * TDBK V2 — GOOGLE CLOUD FIRESTORE NATIVE DRIVER
 * Layer: ARCHITECTURAL FOUNDATION — AUTHORITATIVE SERVER PERSISTENCE
 * 
 * Rules:
 * - Direct integration with official @google-cloud/firestore SDK.
 * - Authenticates strictly via Google Application Default Credentials (ADC).
 * - Zero service-account JSON or secret files committed or required in source.
 * - Cloud Run authenticates via its attached runtime service account.
 * - Supports native transactions, optimistic concurrency, and subcollection listing.
 * - NO fallback to in-memory persistence in production.
 */

import { Firestore, type Transaction } from '@google-cloud/firestore';
import { IFirestoreDriver } from './types';
import { FirestoreTransaction, FirestoreWriteOptions } from '../../types';
import { KernelError } from '../../../kernel/errors/kernelErrors';

export class GoogleCloudFirestoreDriver implements IFirestoreDriver {
  private db: Firestore;

  constructor(options?: { projectId?: string; databaseId?: string }) {
    const config: { projectId?: string; databaseId?: string } = {};

    const projectId =
      options?.projectId ||
      (typeof process !== 'undefined' && (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT));
    if (projectId) {
      config.projectId = projectId;
    }

    const databaseId =
      options?.databaseId || (typeof process !== 'undefined' && process.env.FIRESTORE_DATABASE_ID);
    if (databaseId) {
      config.databaseId = databaseId;
    }

    // Dynamic resolution on Node server runtime prevents browser bundle errors
    if (typeof window !== 'undefined') {
      throw new KernelError(
        'INTERNAL_ERROR',
        'GoogleCloudFirestoreDriver cannot run directly in browser client. Use server API or TestMemoryFirestoreDriver for preview.',
        500
      );
    }

    // Instantiates official Firestore client with Application Default Credentials (ADC)
    this.db = new Firestore(config);
  }

  public getRawFirestoreInstance(): Firestore {
    return this.db;
  }

  private cleanPath(path: string): string {
    let p = path.trim();
    if (p.startsWith('/')) {
      p = p.slice(1);
    }
    if (p.endsWith('/') && p.length > 1) {
      p = p.slice(0, -1);
    }
    return p;
  }

  public async get<T>(path: string): Promise<T | null> {
    const docRef = this.db.doc(this.cleanPath(path));
    const snap = await docRef.get();
    if (!snap.exists) {
      return null;
    }
    const data = snap.data();
    return data as T;
  }

  public async set<T extends Record<string, unknown>>(
    path: string,
    data: T,
    options: FirestoreWriteOptions = {}
  ): Promise<void> {
    const docRef = this.db.doc(this.cleanPath(path));

    if (options.expectedVersion !== undefined) {
      await this.db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const existing = snap.data();
        const currentVersion = existing && typeof existing._version === 'number' ? existing._version : 0;
        if (currentVersion !== options.expectedVersion) {
          throw new KernelError(
            'OPTIMISTIC_LOCK_ERROR',
            `Concurrent modification on '${path}': expected version ${options.expectedVersion}, found ${currentVersion}`,
            409
          );
        }
        const now = new Date().toISOString();
        const nextVersion = currentVersion + 1;
        const payload: Record<string, unknown> = {
          ...data,
          _updatedAt: now,
          _version: nextVersion,
          ...(existing ? {} : { _createdAt: now }),
        };
        tx.set(docRef, payload, { merge: !!options.merge });
      });
      return;
    }

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      ...data,
      _updatedAt: now,
    };
    await docRef.set(payload, { merge: !!options.merge });
  }

  public async update<T extends Record<string, unknown>>(path: string, data: Partial<T>): Promise<void> {
    const docRef = this.db.doc(this.cleanPath(path));
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new KernelError('NOT_FOUND', `Cannot update non-existent document at '${path}'`, 404);
    }
    await docRef.update({
      ...data,
      _updatedAt: new Date().toISOString(),
    });
  }

  public async delete(path: string): Promise<void> {
    const docRef = this.db.doc(this.cleanPath(path));
    await docRef.delete();
  }

  public async listCollection<T>(collectionPath: string): Promise<T[]> {
    const colRef = this.db.collection(this.cleanPath(collectionPath));
    const snapshot = await colRef.get();
    return snapshot.docs.map((doc) => doc.data() as T);
  }

  public async runTransaction<T>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<T>
  ): Promise<T> {
    return await this.db.runTransaction(async (gcpTx: Transaction) => {
      const txAdapter: FirestoreTransaction = {
        get: async <R>(path: string): Promise<R | null> => {
          const docRef = this.db.doc(this.cleanPath(path));
          const snap = await gcpTx.get(docRef);
          if (!snap.exists) return null;
          return snap.data() as R;
        },
        set: async <R>(path: string, data: R, options?: FirestoreWriteOptions): Promise<void> => {
          const docRef = this.db.doc(this.cleanPath(path));
          const now = new Date().toISOString();
          const payload = {
            ...(data as unknown as Record<string, unknown>),
            _updatedAt: now,
          };
          gcpTx.set(docRef, payload, { merge: !!options?.merge });
        },
        update: async <R>(path: string, data: Partial<R>): Promise<void> => {
          const docRef = this.db.doc(this.cleanPath(path));
          gcpTx.update(docRef, {
            ...(data as unknown as Record<string, unknown>),
            _updatedAt: new Date().toISOString(),
          });
        },
        delete: async (path: string): Promise<void> => {
          const docRef = this.db.doc(this.cleanPath(path));
          gcpTx.delete(docRef);
        },
      };

      return await updateFunction(txAdapter);
    });
  }
}
