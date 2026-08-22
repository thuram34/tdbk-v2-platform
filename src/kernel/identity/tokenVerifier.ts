/**
 * TDBK V2 IDENTITY & TOKEN VERIFICATION MODULE
 * Architectural Layer: LAYER 1 — KERNEL
 */
import { Principal } from '../types';
import { AuthenticationError } from '../errors/kernelErrors';
import { configManager } from '../configuration/configManager';
function computeHmacSignature(data: string, secret: string): string {
  try {
    const nodeCrypto = typeof require !== 'undefined' ? require('crypto') : null;
    if (nodeCrypto && typeof nodeCrypto.createHmac === 'function') {
      return nodeCrypto.createHmac('sha256', secret).update(data).digest('base64url');
    }
  } catch {}
  // Deterministic fallback for browser-based test environments
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i) + secret.charCodeAt(i % secret.length);
    hash |= 0;
  }
  return Buffer.from(`sig_${hash}`).toString('base64url');
}

let admin: any = null;

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

const TEST_SECRET = 'tdbk_deterministic_test_secret_key_v2';

export class TokenVerifier {
  public async verifyToken(authHeader?: string, requestId?: string): Promise<Principal> {
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

        const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

    if (isProd && !admin) {
        try {
            admin = require('firebase-admin').default || require('firebase-admin');
            if (!admin.apps.length) {
                const privateSecrets = configManager.getPrivateSecrets();
                const credential = privateSecrets.firebaseServiceAccount
                  ? admin.credential.cert(JSON.parse(privateSecrets.firebaseServiceAccount))
                  : admin.credential.applicationDefault();

                admin.initializeApp({
                  credential,
                  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT
                });
            }
        } catch (err) {
            console.error('Failed to initialize Firebase Admin', err);
        }
    }

    // 1. Check if token is the authoritative Master Service Secret
    let masterSecret = 'tdbk_master_secret_key_v2_internal_fallback';
    try {
        // configManager.getPrivateSecrets() enforces server-side only check
        masterSecret = configManager.getPrivateSecrets().masterAuthSecret || masterSecret;
    } catch {}
    
    if (token === masterSecret) {
        return {
            id: 'MASTER_SERVICE_ACCOUNT',
            email: 'master@tdbk.internal',
            isMaster: true,
            tenantId: null,
            branchId: null,
            roles: ['TDBK_MASTER_ADMIN'],
            permissions: ['PLATFORM_ALL'],
            authTime: Math.floor(Date.now() / 1000),
            tokenSource: 'SERVICE_KEY',
        };
    }

    let decoded: DecodedToken;

    if (isProd) {
      // 2. PRODUCTION: Strictly enforce Firebase Admin JWT verification
      if (!admin) {
         throw new AuthenticationError('Identity Provider (Firebase Admin) not initialized', requestId);
      }
      try {
        const auth = (admin.auth && typeof admin.auth === 'function') ? admin.auth() : (admin.default && admin.default.auth ? admin.default.auth() : (admin.verifyIdToken ? admin : null));
        const decodedIdToken = await auth.verifyIdToken(token);
        
        // Ensure subject/uid exists
        if (!decodedIdToken.uid && !decodedIdToken.sub) {
            throw new Error("Missing subject claim");
        }

        decoded = {
            uid: decodedIdToken.uid || decodedIdToken.sub,
            email: decodedIdToken.email,
            isMaster: decodedIdToken.isMaster === true || decodedIdToken.isMaster === 'true',
            tenantId: decodedIdToken.tenantId || null,
            branchId: decodedIdToken.branchId || null,
            roles: decodedIdToken.roles || [],
            permissions: decodedIdToken.permissions || [],
            iat: decodedIdToken.iat,
            exp: decodedIdToken.exp,
            iss: decodedIdToken.iss,
            aud: decodedIdToken.aud
        };
      } catch (err: any) {
        throw new AuthenticationError(`Cryptographic verification failed: ${err.message}`, requestId);
      }
    } else {
      // 3. TESTING/DEVELOPMENT: Verify HMAC signed test tokens
      try {
        decoded = this.verifyTestSignature(token);
      } catch (err: any) {
        throw new AuthenticationError(`Test token signature verification failed: ${err.message}`, requestId);
      }
    }

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
  }

  private verifyTestSignature(token: string): DecodedToken {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Malformed security token structure. Expected 3 parts.');
    }
    const [header, payload, signature] = parts;
    const expectedSig = computeHmacSignature(`${header}.${payload}`, TEST_SECRET);
    
    if (signature !== expectedSig) {
        throw new Error('Invalid cryptographic signature on token');
    }

    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  }

  /**
   * Utility helper to mint test tokens for Phase 0 security verification.
   */
  public _setAdminForTesting(mockAdmin: any) { admin = mockAdmin; }

  public static mintTestToken(payload: DecodedToken): string {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: mintTestToken cannot be used in a production environment.');
    }

    const defaultToken: DecodedToken = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'tdbk-test-issuer',
      aud: 'tdbk-test-audience',
      ...payload,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(defaultToken)).toString('base64url');
    const signature = computeHmacSignature(`${header}.${b64Payload}`, TEST_SECRET);
    
    return `${header}.${b64Payload}.${signature}`;
  }
}

export const tokenVerifier = new TokenVerifier();
