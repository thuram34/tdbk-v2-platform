/**
 * TDBK V2 — FIRESTORE NATIVE CLIENT
 * Layer: ARCHITECTURAL FOUNDATION — AUTHORITATIVE SERVER PERSISTENCE
 *
 * Rules:
 * - Authoritative Canonical Paths: /tenants/{tenantId}/...
 * - No /tdbk_tenants/ competing namespace.
 * - Server-only execution; credentials never exposed to client.
 * - Authoritative production backend: Google Cloud Firestore (Native Mode) via ADC.
 * - Isolated test execution: TestMemoryFirestoreDriver for deterministic unit testing.
 * - NO silent mock fallback in production or server runtime.
 * - Supports atomic transactions with rollback safety.
 * - Optimistic concurrency, deterministic keys, and server timestamps.
 */

import { IFirestoreDriver } from './driver/types';
import { TestMemoryFirestoreDriver } from './driver/testMemoryFirestoreDriver';
import { GoogleCloudFirestoreDriver } from './driver/googleCloudFirestoreDriver';
import { FirestoreTransaction, FirestoreWriteOptions } from '../types';
import { KernelError } from '../../kernel/errors/kernelErrors';

export class FirestoreClient {
  private static instance: FirestoreClient;
  private driver: IFirestoreDriver;
  private isProductionMode: boolean;

  private constructor() {
    const isBrowser = typeof window !== 'undefined';
    const isTest =
      !isBrowser &&
      typeof process !== 'undefined' &&
      (process.env.NODE_ENV === 'test' ||
        process.env.VITEST === 'true' ||
        process.env.TDBK_PERSISTENCE_DRIVER === 'test_memory');

    // Any non-browser, non-test execution is a server execution and must use
    // authoritative Firestore. A missing NODE_ENV must never silently select
    // the in-memory driver, especially on Cloud Run.
    this.isProductionMode = !isBrowser && !isTest;

    if (isBrowser || isTest) {
      this.driver = new TestMemoryFirestoreDriver();
    } else {
      this.driver = new GoogleCloudFirestoreDriver();
    }
  }

  public static getInstance(): FirestoreClient {
    if (!FirestoreClient.instance) {
      FirestoreClient.instance = new FirestoreClient();
    }
    return FirestoreClient.instance;
  }

  public getDriver(): IFirestoreDriver {
    return this.driver;
  }

  public setDriverForTesting(driver: IFirestoreDriver): void {
    this.driver = driver;
  }

  public clearAllForTesting(): void {
    if (typeof this.driver.clearAllForTesting === 'function') {
      this.driver.clearAllForTesting();
    }
  }

  public simulateServerRestart(): void {
    if (typeof this.driver.simulateServerRestart === 'function') {
      this.driver.simulateServerRestart();
    }
  }

  public normalizePath(path: string): string {
    let cleanPath = path.trim();
    if (!cleanPath.startsWith('/')) {
      cleanPath = `/${cleanPath}`;
    }
    if (cleanPath.endsWith('/') && cleanPath.length > 1) {
      cleanPath = cleanPath.slice(0, -1);
    }

    if (!cleanPath.startsWith('/tenants/') && cleanPath !== '/tenants' && !cleanPath.startsWith('/system/')) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Invalid Firestore Path '${cleanPath}': All authoritative state must reside under '/tenants/{tenantId}/...'`,
        400
      );
    }

    if (cleanPath.includes('/tdbk_tenants/')) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Forbidden namespace '/tdbk_tenants/': Must strictly use canonical '/tenants/{tenantId}/...'`,
        400
      );
    }

    return cleanPath;
  }

  public async get<T>(path: string): Promise<T | null> {
    return await this.driver.get<T>(this.normalizePath(path));
  }

  public async set<T extends Record<string, unknown>>(path: string, data: T, options: FirestoreWriteOptions = {}): Promise<void> {
    await this.driver.set(this.normalizePath(path), data, options);
  }

  public async update<T extends Record<string, unknown>>(path: string, data: Partial<T>): Promise<void> {
    await this.driver.update(this.normalizePath(path), data);
  }

  public async delete(path: string): Promise<void> {
    await this.driver.delete(this.normalizePath(path));
  }

  public async listCollection<T>(collectionPath: string): Promise<T[]> {
    return await this.driver.listCollection<T>(this.normalizePath(collectionPath));
  }

  public async runTransaction<T>(updateFunction: (transaction: FirestoreTransaction) => Promise<T>): Promise<T> {
    return await this.driver.runTransaction(async (tx) => {
      const txProxy: FirestoreTransaction = {
        get: async <R>(path: string): Promise<R | null> => tx.get<R>(this.normalizePath(path)),
        set: async <R>(path: string, data: R, options?: FirestoreWriteOptions): Promise<void> => tx.set<R>(this.normalizePath(path), data, options),
        update: async <R>(path: string, data: Partial<R>): Promise<void> => tx.update<R>(this.normalizePath(path), data),
        delete: async (path: string): Promise<void> => tx.delete(this.normalizePath(path)),
      };
      return await updateFunction(txProxy);
    });
  }
}

export const firestoreClient = FirestoreClient.getInstance();
