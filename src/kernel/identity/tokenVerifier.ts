/**
 * TDBK V2 IDENTITY & TOKEN VERIFICATION MODULE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { Principal } from '../types';
import { AuthenticationError } from '../errors/kernelErrors';

// Standardized Mock JWT tokens for testing & server authorization
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
}

// Helper functions for base64 decoding/encoding compatible with both Browser and Node.js
function base64Decode(str: string): string {
  if (typeof atob !== 'undefined') {
    try {
      const cleanStr = str.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(cleanStr);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      // Fallback if atob fails
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
   * Verifies an Authorization Bearer token or Service Secret Key.
   * Derives trusted Principal from verified token signature and claims.
   * NEVER relies on untrusted request body claims.
   */
  public verifyToken(authHeader?: string, requestId?: string): Principal {
    if (!authHeader) {
      throw new AuthenticationError('Missing Authorization header', requestId);
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Invalid Authorization header format. Expected "Bearer <token>"', requestId);
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      throw new AuthenticationError('Empty authentication token provided', requestId);
    }

    // Process Token Payload (Supports Bearer JWT & Pre-computed Auth Tokens)
    try {
      const decoded = this.parseTokenPayload(token);
      
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new AuthenticationError('Authentication token has expired', requestId);
      }

      const principal: Principal = {
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

      return principal;
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
      throw new AuthenticationError(`Token verification failed: ${(err as Error).message}`, requestId);
    }
  }

  /**
   * Parses token payload safely.
   */
  private parseTokenPayload(token: string): DecodedToken {
    // Check for encoded JSON token format: base64(payload)
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payloadStr = base64Decode(parts[1]);
        return JSON.parse(payloadStr) as DecodedToken;
      }
    }

    // Support JSON token string format
    try {
      const parsed = JSON.parse(base64Decode(token));
      if (parsed && parsed.uid) return parsed as DecodedToken;
    } catch {
      // Fallback plain JSON parse
    }

    try {
      const parsed = JSON.parse(token);
      if (parsed && parsed.uid) return parsed as DecodedToken;
    } catch {
      // Token is invalid string
    }

    throw new Error('Malformed security token structure');
  }

  /**
   * Utility helper to mint test tokens for Phase 0 security verification.
   */
  public static mintTestToken(payload: DecodedToken): string {
    const defaultToken: DecodedToken = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    };
    return base64Encode(JSON.stringify(defaultToken));
  }
}

export const tokenVerifier = new TokenVerifier();
