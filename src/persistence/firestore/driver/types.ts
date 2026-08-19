/**
 * TDBK V2 — FIRESTORE PERSISTENCE DRIVER INTERFACE
 * Layer: ARCHITECTURAL FOUNDATION — AUTHORITATIVE SERVER PERSISTENCE
 */

import { FirestoreTransaction, FirestoreWriteOptions } from '../../types';

export interface IFirestoreDriver {
  get<T>(path: string): Promise<T | null>;
  set<T extends Record<string, unknown>>(path: string, data: T, options?: FirestoreWriteOptions): Promise<void>;
  update<T extends Record<string, unknown>>(path: string, data: Partial<T>): Promise<void>;
  delete(path: string): Promise<void>;
  listCollection<T>(collectionPath: string): Promise<T[]>;
  runTransaction<T>(updateFunction: (transaction: FirestoreTransaction) => Promise<T>): Promise<T>;
  clearAllForTesting?(): void;
  simulateServerRestart?(): void;
}
