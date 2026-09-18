/**
 * TDBK V2 — TEST ISOLATION IN-MEMORY FIRESTORE DRIVER
 * Layer: TEST HARNESS & UNIT ISOLATION ONLY
 * 
 * Rules:
 * - Restricted strictly to unit test execution and isolated test suites.
 * - Must NEVER be used as a silent production fallback.
 * - Provides point-in-time snapshot isolation, transaction rollback, and restart simulation.
 */

import { IFirestoreDriver } from './types';
import { FirestoreTransaction, FirestoreWriteOptions } from '../../types';
import { KernelError } from '../../../kernel/errors/kernelErrors';

export class TestMemoryFirestoreDriver implements IFirestoreDriver {
  private documents: Map<
    string,
    { data: Record<string, unknown>; _createdAt: string; _updatedAt: string; _version: number }
  > = new Map();

  private persistentBackingStore: Map<string, string> = new Map();
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.rehydrateFromBackingStore();
  }

  public clearAllForTesting(): void {
    this.documents.clear();
    this.persistentBackingStore.clear();
  }

  public simulateServerRestart(): void {
    this.syncToBackingStore();
    this.documents.clear();
    this.rehydrateFromBackingStore();
  }

  private syncToBackingStore(): void {
    this.persistentBackingStore.clear();
    for (const [path, entry] of this.documents.entries()) {
      this.persistentBackingStore.set(path, JSON.stringify(entry));
    }
  }

  private rehydrateFromBackingStore(): void {
    for (const [path, json] of this.persistentBackingStore.entries()) {
      try {
        const parsed = JSON.parse(json);
        this.documents.set(path, parsed);
      } catch {
        // Skip malformed entries
      }
    }
  }

  public async get<T>(path: string): Promise<T | null> {
    const entry = this.documents.get(path);
    if (!entry) return null;
    return JSON.parse(JSON.stringify(entry.data)) as T;
  }

  public async set<T extends Record<string, unknown>>(
    path: string,
    data: T,
    options: FirestoreWriteOptions = {}
  ): Promise<void> {
    const now = new Date().toISOString();
    const existing = this.documents.get(path);

    if (options.expectedVersion !== undefined && existing && existing._version !== options.expectedVersion) {
      throw new KernelError(
        'OPTIMISTIC_LOCK_ERROR',
        `Concurrent modification on '${path}': expected version ${options.expectedVersion}, found ${existing._version}`,
        409
      );
    }

    const version = existing ? existing._version + 1 : 1;
    const createdAt = existing ? existing._createdAt : now;
    const finalData = options.merge && existing ? { ...existing.data, ...data } : { ...data };

    const entry = {
      data: finalData,
      _createdAt: createdAt,
      _updatedAt: now,
      _version: version,
    };

    this.documents.set(path, entry);
    this.syncToBackingStore();
  }

  public async update<T extends Record<string, unknown>>(path: string, data: Partial<T>): Promise<void> {
    const existing = this.documents.get(path);
    if (!existing) {
      throw new KernelError('NOT_FOUND', `Cannot update non-existent document at '${path}'`, 404);
    }

    await this.set(path, data as Record<string, unknown>, { merge: true });
  }

  public async delete(path: string): Promise<void> {
    this.documents.delete(path);
    this.syncToBackingStore();
  }

  public async listCollection<T>(collectionPath: string): Promise<T[]> {
    const prefix = `${collectionPath}/`;
    const results: T[] = [];

    for (const [path, entry] of this.documents.entries()) {
      if (path.startsWith(prefix)) {
        const subPath = path.substring(prefix.length);
        if (!subPath.includes('/')) {
          results.push(JSON.parse(JSON.stringify(entry.data)) as T);
        }
      }
    }

    return results;
  }

  public async runTransaction<T>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<T>
  ): Promise<T> {
    const execute = async (): Promise<T> => {
    const snapshot = new Map(this.documents);
    const stagingWrites = new Map<string, { data: Record<string, unknown>; options?: FirestoreWriteOptions }>();
    const stagingDeletes = new Set<string>();

    const transaction: FirestoreTransaction = {
      get: async <R>(path: string): Promise<R | null> => {
        if (stagingDeletes.has(path)) return null;
        if (stagingWrites.has(path)) {
          return JSON.parse(JSON.stringify(stagingWrites.get(path)!.data)) as R;
        }
        const entry = snapshot.get(path);
        if (!entry) return null;
        return JSON.parse(JSON.stringify(entry.data)) as R;
      },
      set: async <R>(path: string, data: R, options?: FirestoreWriteOptions): Promise<void> => {
        stagingDeletes.delete(path);
        stagingWrites.set(path, { data: data as unknown as Record<string, unknown>, options });
      },
      update: async <R>(path: string, data: Partial<R>): Promise<void> => {
        const current = stagingWrites.get(path)?.data || snapshot.get(path)?.data;
        if (!current) {
          throw new KernelError('NOT_FOUND', `Transaction update failed: Document '${path}' does not exist`, 404);
        }
        stagingDeletes.delete(path);
        stagingWrites.set(path, {
          data: { ...current, ...data } as Record<string, unknown>,
          options: { merge: true },
        });
      },
      delete: async (path: string): Promise<void> => {
        stagingWrites.delete(path);
        stagingDeletes.add(path);
      },
    };

    try {
      const result = await updateFunction(transaction);

      for (const [path, { data, options }] of stagingWrites.entries()) {
        await this.set(path, data, options);
      }
      for (const path of stagingDeletes) {
        await this.delete(path);
      }

      return result;
    } catch (err) {
      this.documents = snapshot;
      this.syncToBackingStore();
      throw err;
    }
    };

    const previous = this.transactionQueue;
    let release!: () => void;
    this.transactionQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await execute();
    } finally {
      release();
    }
  }
}
