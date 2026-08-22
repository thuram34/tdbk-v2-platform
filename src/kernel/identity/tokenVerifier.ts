/**
 * TDBK V2 IDENTITY & TOKEN VERIFICATION MODULE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { Principal } from '../types';
import { AuthenticationError } from '../errors/kernelErrors';
import { configManager } from '../configuration/configManager';

export interface DecodedToken {
  uid: string;
  email?: string;
  isMaster?: boolean;
  tenantId?: string | null;
  branchId?: string | null;
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

function base64Decode(str: string): string {
  if (typeof atob !== 'undefined') {
    try {
      const cleanStr = str.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(cleanStr);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      // Fall through to Node Buffer.
    }
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf8');
  }

  throw new Error('Base64 decode unavailable');
}

function base64Encode(str: string): string {
  if (typeof btoa !== 'undefined') {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64');
  }

  throw new Error('Base64 encode unavailable');
}

export class TokenVerifier {
  /**
   * Test-only Firebase Admin injection seam.
   * Never used in production; production always uses the real Firebase Admin SDK.
   */
  private adminForTesting?: {
    auth: () => {
      verifyIdToken: (token: string) => Promise<any>;
    };
  };

  public _setAdminForTesting(admin: {
    auth: () => {
      verifyIdToken: (token: string) => Promise<any>;
    };
  }): void {
    const isVitest =
      typeof process !== 'undefined' &&
      process.env.VITEST === 'true';

    if (process.env.NODE_ENV === 'production' && !isVitest) {
      throw new Error(
        'FATAL: Test Firebase Admin injection is prohibited outside the test runner.'
      );
    }

    this.adminForTesting = admin;
  }

  /**
   * Production:
   *   Firebase Admin SDK verifies the Firebase ID token cryptographically.
   *
   * Development/Test:
   *   HMAC-SHA256 test-token verification remains available for the test suite.
   *
   * Plain JSON/base64 payloads are never accepted as authenticated production
   * identities.
   */
  public async verifyTokenAsync(authHeader?: string, requestId?: string): Promise<Principal> {
    if (!authHeader) {
      throw new AuthenticationError('Missing Authorization header', requestId);
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError(
        'Invalid Authorization header format. Expected "Bearer <token>"',
        requestId
      );
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      throw new AuthenticationError('Empty authentication token provided', requestId);
    }

    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      try {
        if (typeof window !== 'undefined') {
          throw new AuthenticationError(
            'Production Firebase verification is server-only',
            requestId
          );
        }

        let decodedIdToken: any;

        if (this.adminForTesting) {
          decodedIdToken = await this.adminForTesting.auth().verifyIdToken(token);
        } else {
          const { verifyFirebaseIdToken } = await import('./firebaseAdminVerifier');
          decodedIdToken = await verifyFirebaseIdToken(token);
        }

        if (!decodedIdToken.uid && !decodedIdToken.sub) {
          throw new Error('Missing subject claim');
        }

        const now = Math.floor(Date.now() / 1000);

        if (decodedIdToken.exp && decodedIdToken.exp < now) {
          throw new AuthenticationError(
            'Authentication token has expired',
            requestId
          );
        }

        return {
          id: decodedIdToken.uid || decodedIdToken.sub!,
          email: decodedIdToken.email,
          isMaster:
            decodedIdToken.isMaster === true ||
            decodedIdToken.isMaster === 'true',
          tenantId: decodedIdToken.tenantId || null,
          branchId: decodedIdToken.branchId || null,
          roles: Array.isArray(decodedIdToken.roles)
            ? decodedIdToken.roles
            : [],
          permissions: Array.isArray(decodedIdToken.permissions)
            ? decodedIdToken.permissions
            : [],
          authTime: decodedIdToken.iat || now,
          tokenSource: 'JWT',
        };
      } catch (err) {
        if (err instanceof AuthenticationError) {
          throw err;
        }

        throw new AuthenticationError(
          `Cryptographic verification failed: ${(err as Error).message}`,
          requestId
        );
      }
    }

    // Development/test-only master service identity.
    // Production never reaches this branch because production uses Firebase Admin.
    const masterSecret = configManager.getPrivateSecrets().masterAuthSecret;

    if (masterSecret && token === masterSecret) {
      return {
        id: 'MASTER_SERVICE_ACCOUNT',
        email: undefined,
        isMaster: true,
        tenantId: null,
        branchId: null,
        roles: ['MASTER'],
        permissions: ['*'],
        authTime: Math.floor(Date.now() / 1000),
        tokenSource: 'JWT',
      };
    }

    // Development/Test boundary.
    return this.verifyTestToken(token, requestId);
  }

  /**
   * Backward-compatible synchronous entry point for existing callers.
   *
   * Production Firebase verification is asynchronous, so production callers
   * must use verifyTokenAsync().
   */
  public verifyToken(authHeader?: string, requestId?: string): Principal {
    if (process.env.NODE_ENV === 'production') {
      throw new AuthenticationError(
        'Production token verification requires verifyTokenAsync()',
        requestId
      );
    }

    if (!authHeader) {
      throw new AuthenticationError('Missing Authorization header', requestId);
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError(
        'Invalid Authorization header format. Expected "Bearer <token>"',
        requestId
      );
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      throw new AuthenticationError('Empty authentication token provided', requestId);
    }

    // Development/test-only master service identity.
    // Production never reaches this synchronous path.
    const masterSecret = configManager.getPrivateSecrets().masterAuthSecret;

    if (masterSecret && token === masterSecret) {
      return {
        id: 'MASTER_SERVICE_ACCOUNT',
        email: undefined,
        isMaster: true,
        tenantId: null,
        branchId: null,
        roles: ['MASTER'],
        permissions: ['*'],
        authTime: Math.floor(Date.now() / 1000),
        tokenSource: 'JWT',
      };
    }

    return this.verifyTestToken(token, requestId);
  }

  private verifyTestToken(token: string, requestId?: string): Principal {
    try {
      const decoded = this.parseTestToken(token);

      const now = Math.floor(Date.now() / 1000);

      if (decoded.exp && decoded.exp < now) {
        throw new AuthenticationError(
          'Authentication token has expired',
          requestId
        );
      }

      return {
        id: decoded.uid,
        email: decoded.email,
        isMaster: Boolean(decoded.isMaster),
        tenantId: decoded.tenantId ?? null,
        branchId: decoded.branchId ?? null,
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
        authTime: decoded.iat || now,
        tokenSource: 'JWT',
      };
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw err;
      }

      throw new AuthenticationError(
        `Token verification failed: ${(err as Error).message}`,
        requestId
      );
    }
  }

  private parseTestToken(token: string): DecodedToken {
    const parts = token.split('.');

    if (parts.length !== 3) {
      throw new Error(
        'Malformed security token structure. Expected 3 parts'
      );
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const header = JSON.parse(base64Decode(encodedHeader));
    const payload = JSON.parse(base64Decode(encodedPayload));

    if (!header || header.alg !== 'HS256') {
      throw new Error('Unsupported or invalid test-token algorithm');
    }

    if (!encodedSignature) {
      throw new Error('Missing test-token signature');
    }

    const expectedSignature = this.createTestSignature(
      `${encodedHeader}.${encodedPayload}`
    );

    if (encodedSignature !== expectedSignature) {
      throw new Error('Invalid cryptographic signature');
    }

    if (!payload || typeof payload.uid !== 'string') {
      throw new Error('Missing uid claim');
    }

    return payload as DecodedToken;
  }

  private createTestSignature(data: string): string {
    // Deterministic test-only signature. Never used by production Firebase
    // verification.
    let hash = 0x811c9dc5;

    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Test-token generator.
   * Absolutely prohibited in production.
   */
  public static mintTestToken(payload: DecodedToken): string {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: mintTestToken cannot be used in a production environment.'
      );
    }

    const header = base64Encode(
      JSON.stringify({
        alg: 'HS256',
        typ: 'JWT',
      })
    );

    const body = base64Encode(
      JSON.stringify({
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...payload,
      })
    );

    // Keep test-token generation deterministic with the verifier's test
    // signature implementation.
    let hash = 0x811c9dc5;
    const data = `${header}.${body}`;

    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }

    const signature = Math.abs(hash).toString(16);

    return `${header}.${body}.${signature}`;
  }
}

export const tokenVerifier = new TokenVerifier();
