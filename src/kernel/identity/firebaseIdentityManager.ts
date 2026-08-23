/**
 * TDBK V2 — FIREBASE IDENTITY & CLAIMS MANAGER
 * Architectural Layer: LAYER 1 — KERNEL / IDENTITY
 * Server-Authoritative Management of Firebase Authentication custom claims & security boundaries.
 */

import { TdbkIdentityClaims } from './types';
import { AuthenticationError, KernelError } from '../errors/kernelErrors';
import { configManager } from '../configuration/configManager';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminInstance: any = null;

export class FirebaseIdentityManager {
  private static instance: FirebaseIdentityManager;

  private constructor() {}

  public static getInstance(): FirebaseIdentityManager {
    if (!FirebaseIdentityManager.instance) {
      FirebaseIdentityManager.instance = new FirebaseIdentityManager();
    }
    return FirebaseIdentityManager.instance;
  }

  /**
   * Mock injector for deterministic unit and security test execution.
   */
  public _setAdminForTesting(mockAdmin: any): void {
    adminInstance = mockAdmin;
  }

  /**
   * Lazily initializes and returns Firebase Admin Auth instance.
   */
  private getAuthInstance(): any {
    if (adminInstance) {
      if (typeof adminInstance.auth === 'function') {
        return adminInstance.auth();
      }
      if (adminInstance.default && typeof adminInstance.default.auth === 'function') {
        return adminInstance.default.auth();
      }
      return adminInstance;
    }

    try {
      if (getApps().length === 0) {
        let credential;
        try {
          const privateSecrets = configManager.getPrivateSecrets();
          if (privateSecrets.firebaseServiceAccount) {
            credential = cert(JSON.parse(privateSecrets.firebaseServiceAccount));
          } else {
            credential = applicationDefault();
          }
        } catch {
          credential = applicationDefault();
        }

        initializeApp({
          credential,
          projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT,
        });
      }

      return getAuth();
    } catch (err: any) {
      // In local dev/test or when SDK is not present, provide a graceful fallback or error
      if (process.env.NODE_ENV === 'production') {
        throw new AuthenticationError(`Failed to initialize Firebase Admin Auth: ${err.message}`);
      }
      // Return a lightweight in-memory auth simulation for non-production environments
      return this.createDevAuthFallback();
    }
  }

  private devUsers: Map<string, { uid: string; email?: string; customClaims?: Record<string, any> }> = new Map();

  private createDevAuthFallback(): any {
    return {
      getUser: async (uid: string) => {
        const user = this.devUsers.get(uid);
        if (!user) {
          return { uid, email: `${uid}@tdbk.local`, customClaims: {} };
        }
        return user;
      },
      getUserByEmail: async (email: string) => {
        for (const user of this.devUsers.values()) {
          if (user.email === email) return user;
        }
        return { uid: `usr_${Date.now()}`, email, customClaims: {} };
      },
      setCustomUserClaims: async (uid: string, claims: Record<string, any>) => {
        const existing = this.devUsers.get(uid) || { uid, email: `${uid}@tdbk.local`, customClaims: {} };
        existing.customClaims = claims;
        this.devUsers.set(uid, existing);
      },
      revokeRefreshTokens: async (_uid: string) => {
        // No-op for dev fallback
      },
    };
  }

  /**
   * Retrieves user record by UID from Firebase Auth.
   */
  public async getUserByUid(uid: string): Promise<any> {
    if (!uid) {
      throw new KernelError('VALIDATION_ERROR', 'Firebase UID is required', 400);
    }
    const auth = this.getAuthInstance();
    try {
      return await auth.getUser(uid);
    } catch (err: any) {
      throw new KernelError('NOT_FOUND', `Firebase user with UID '${uid}' not found: ${err.message}`, 404);
    }
  }

  /**
   * Retrieves user record by Email from Firebase Auth.
   */
  public async getUserByEmail(email: string): Promise<any> {
    if (!email) {
      throw new KernelError('VALIDATION_ERROR', 'Email address is required', 400);
    }
    const auth = this.getAuthInstance();
    try {
      return await auth.getUserByEmail(email);
    } catch (err: any) {
      throw new KernelError('NOT_FOUND', `Firebase user with email '${email}' not found: ${err.message}`, 404);
    }
  }

  /**
   * Retrieves existing custom claims for a given user.
   */
  public async getCustomClaims(uid: string): Promise<Record<string, any>> {
    const user = await this.getUserByUid(uid);
    return (user && user.customClaims) || {};
  }

  /**
   * Authoritatively writes TDBK claims to Firebase custom user claims,
   * preserving all existing unrelated custom claims and revoking refresh tokens.
   */
  public async setTdbkClaims(uid: string, tdbkClaims: TdbkIdentityClaims): Promise<void> {
    if (!uid) {
      throw new KernelError('VALIDATION_ERROR', 'Target UID is required to set claims', 400);
    }

    const auth = this.getAuthInstance();
    const existingClaims = await this.getCustomClaims(uid);

    // Merge without overwriting unrelated Firebase claims
    const updatedClaims: Record<string, any> = {
      ...existingClaims,
      tdbk: {
        roles: tdbkClaims.roles || [],
        permissions: tdbkClaims.permissions || [],
        tenantId: tdbkClaims.tenantId ?? null,
        branchId: tdbkClaims.branchId ?? null,
        isMaster: Boolean(tdbkClaims.isMaster),
        metadata: tdbkClaims.metadata || {},
      },
      // Top-level aliases for direct claims reading
      roles: tdbkClaims.roles || [],
      permissions: tdbkClaims.permissions || [],
      tenantId: tdbkClaims.tenantId ?? null,
      branchId: tdbkClaims.branchId ?? null,
      isMaster: Boolean(tdbkClaims.isMaster),
    };

    await auth.setCustomUserClaims(uid, updatedClaims);

    // Invalidate existing sessions so updated claims take effect on next token refresh
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (err) {
      console.warn(`[FirebaseIdentityManager] revokeRefreshTokens warning for ${uid}:`, err);
    }
  }

  /**
   * Authoritatively removes TDBK claims while preserving all other custom claims.
   */
  public async removeTdbkClaims(uid: string): Promise<void> {
    if (!uid) {
      throw new KernelError('VALIDATION_ERROR', 'Target UID is required to remove claims', 400);
    }

    const auth = this.getAuthInstance();
    const existingClaims = await this.getCustomClaims(uid);

    const cleanedClaims: Record<string, any> = {};
    for (const key of Object.keys(existingClaims)) {
      if (!['tdbk', 'roles', 'permissions', 'tenantId', 'branchId', 'isMaster'].includes(key)) {
        cleanedClaims[key] = existingClaims[key];
      }
    }

    await auth.setCustomUserClaims(uid, cleanedClaims);

    try {
      await auth.revokeRefreshTokens(uid);
    } catch (err) {
      console.warn(`[FirebaseIdentityManager] revokeRefreshTokens warning for ${uid}:`, err);
    }
  }
}

export const firebaseIdentityManager = FirebaseIdentityManager.getInstance();
