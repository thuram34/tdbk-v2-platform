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
 * - NO silent mock fallback in production.
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

    this.isProductionMode =
      !isBrowser &&
      typeof process !== 'undefined' &&
      (process.env.NODE_ENV === 'production' || process.env.TDBK_PERSISTENCE_DRIVER === 'gcp_firestore');

    if (isBrowser || isTest || !this.isProductionMode) {
      // In browser preview, isolated test runner, or local dev without GCP ADC
      this.driver = new TestMemoryFirestoreDriver();
    } else {
      // In production / GCP Cloud Run environment, strictly use GoogleCloudFirestoreDriver
      this.driver = new GoogleCloudFirestoreDriver();
    }
  }

  public static getInstance(): FirestoreClient {
    if (!FirestoreClient.instance) {
      FirestoreClient.instance = new FirestoreClient();
    }
    return FirestoreClient.instance;
  }

  /**
   * Returns the currently configured persistence driver.
   */
  public getDriver(): IFirestoreDriver {
    return this.driver;
  }

  /**
   * Allows test harnesses to explicitly inject a test driver.
   */
  public setDriverForTesting(driver: IFirestoreDriver): void {
    this.driver = driver;
  }

  /**
   * Resets local memory and backing store (used strictly for isolated test suites).
   */
  public clearAllForTesting(): void {
    if (typeof this.driver.clearAllForTesting === 'function') {
      this.driver.clearAllForTesting();
    }
  }

  /**
   * Simulates a hard server restart by re-instantiating state from persistent store.
   */
  public simulateServerRestart(): void {
    if (typeof this.driver.simulateServerRestart === 'function') {
      this.driver.simulateServerRestart();
    }
  }

  /**
   * Canonicalizes and validates document paths.
   */
  public normalizePath(path: string): string {
    let cleanPath = path.trim();
    if (!cleanPath.startsWith('/')) {
      cleanPath = `/${cleanPath}`;
    }
    if (cleanPath.endsWith('/') && cleanPath.length > 1) {
      cleanPath = cleanPath.slice(0, -1);
    }

    if (!cleanPath.startsWith('/tenants/') && !cleanPath.startsWith('/system/')) {
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

  /**
   * Reads a single document by its canonical path.
   */
  public async get<T>(path: string): Promise<T | null> {
    const normalized = this.normalizePath(path);
    return await this.driver.get<T>(normalized);
  }

  /**
   * Sets / writes a document at a canonical path.
   */
  public async set<T extends Record<string, unknown>>(
    path: string,
    data: T,
    options: FirestoreWriteOptions = {}
  ): Promise<void> {
    const normalized = this.normalizePath(path);
    await this.driver.set(normalized, data, options);
  }

  /**
   * Updates specific fields of an existing document.
   */
  public async update<T extends Record<string, unknown>>(path: string, data: Partial<T>): Promise<void> {
    const normalized = this.normalizePath(path);
    await this.driver.update(normalized, data);
  }

  /**
   * Deletes a document by canonical path.
   */
  public async delete(path: string): Promise<void> {
    const normalized = this.normalizePath(path);
    await this.driver.delete(normalized);
  }

  /**
   * Lists documents in a subcollection under a specific parent path.
   */
  public async listCollection<T>(collectionPath: string): Promise<T[]> {
    const normalizedCollection = this.normalizePath(collectionPath);
    return await this.driver.listCollection<T>(normalizedCollection);
  }

  /**
   * Runs an atomic transaction with automatic rollback on error.
   */
  public async runTransaction<T>(
    updateFunction: (transaction: FirestoreTransaction) => Promise<T>
  ): Promise<T> {
    return await this.driver.runTransaction(async (tx) => {
      const txProxy: FirestoreTransaction = {
        get: async <R>(path: string): Promise<R | null> => {
          const normalized = this.normalizePath(path);
          return await tx.get<R>(normalized);
        },
        set: async <R>(path: string, data: R, options?: FirestoreWriteOptions): Promise<void> => {
          const normalized = this.normalizePath(path);
          await tx.set<R>(normalized, data, options);
        },
        update: async <R>(path: string, data: Partial<R>): Promise<void> => {
          const normalized = this.normalizePath(path);
          await tx.update<R>(normalized, data);
        },
        delete: async (path: string): Promise<void> => {
          const normalized = this.normalizePath(path);
          await tx.delete(normalized);
        },
      };

      return await updateFunction(txProxy);
    });
  }
}

export const firestoreClient = FirestoreClient.getInstance();
