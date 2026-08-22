import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenVerifier } from '../identity/tokenVerifier';
import { AuthenticationError, AuthorizationError } from '../errors/kernelErrors';
import { configManager } from '../configuration/configManager';
import { tenantIsolation } from '../tenancy/tenantIsolation';
import { masterAuthority } from '../master/masterAuthority';
import { provisioningService } from '../../platform/provisioning/provisioningService';
import { SecurityContext } from '../types';

describe('Production Identity Verification Boundary', () => {
  let verifier: TokenVerifier;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    verifier = new TokenVerifier();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('1. unsigned token -> DENIED', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ uid: 'hacker' })).toString('base64url');
    const token = `${header}.${payload}.`;
    await expect(verifier.verifyTokenAsync(`Bearer ${token}`)).rejects.toThrow(AuthenticationError);
  });

  it('2. arbitrary JSON token -> DENIED', async () => {
    const arbitrary = Buffer.from(JSON.stringify({ uid: 'hacker' })).toString('base64url');
    await expect(verifier.verifyTokenAsync(`Bearer ${arbitrary}`)).rejects.toThrow(/Malformed security token/);
  });

  it('3. malformed Bearer header -> DENIED', async () => {
    await expect(verifier.verifyTokenAsync('Basic token123')).rejects.toThrow(/Expected "Bearer <token>"/);
    await expect(verifier.verifyTokenAsync('')).rejects.toThrow(/Missing Authorization header/);
    await expect(verifier.verifyTokenAsync('Bearer ')).rejects.toThrow(/Empty authentication token/);
  });

  it('4. expired token -> DENIED', async () => {
    const expiredToken = TokenVerifier.mintTestToken({ uid: 'user1', exp: Math.floor(Date.now() / 1000) - 10000 });
    await expect(verifier.verifyTokenAsync(`Bearer ${expiredToken}`)).rejects.toThrow(/expired/);
  });

  it('5. invalid signature -> DENIED', async () => {
    const valid = TokenVerifier.mintTestToken({ uid: 'user1' });
    const parts = valid.split('.');
    const invalidToken = `${parts[0]}.${parts[1]}.invalidsignature123`;
    await expect(verifier.verifyTokenAsync(`Bearer ${invalidToken}`)).rejects.toThrow(/Invalid cryptographic signature/);
  });

  it('6. mintTestToken() in production -> DENIED', () => {
    process.env.NODE_ENV = 'production';
    expect(() => TokenVerifier.mintTestToken({ uid: 'user' })).toThrow(/FATAL: mintTestToken cannot be used in a production environment/);
    process.env.NODE_ENV = originalEnv;
  });

  it('7. TDBK MASTER identity -> ACCEPTED only through authoritative master boundary', async () => {
    const masterSecret = 'tdbk-test-master-secret';
    process.env.MASTER_AUTH_SECRET = masterSecret;

    const principal = await verifier.verifyTokenAsync(`Bearer ${masterSecret}`);
    expect(principal.isMaster).toBe(true);
    expect(principal.id).toBe('MASTER_SERVICE_ACCOUNT');
  });

  describe('Production Firebase Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      verifier = new TokenVerifier();
      verifier._setAdminForTesting({
        auth: () => ({
          verifyIdToken: async (token: string) => {
            if (token === 'valid_prod_token') {
              return {
                uid: 'prod_user1',
                iss: 'https://securetoken.google.com/test-project',
                aud: 'test-project',
                exp: Math.floor(Date.now() / 1000) + 3600,
              };
            }
            if (token === 'wrong_issuer') {
              throw new Error('Firebase ID token has incorrect "iss" (issuer) claim');
            }
            if (token === 'wrong_audience') {
              throw new Error('Firebase ID token has incorrect "aud" (audience) claim');
            }
            if (token === 'invalid_signature_prod') {
              throw new Error('Firebase ID token has invalid signature');
            }
            if (token === 'expired_prod_token') {
              throw new Error('Firebase ID token has expired');
            }
            if (token === 'owner_token') {
              return {
                uid: 'owner1',
                roles: ['BUSINESS_OWNER'],
                exp: Math.floor(Date.now() / 1000) + 3600,
              };
            }
            if (token === 'unauthorized_dbk') {
              return {
                uid: 'hacker',
                tenantId: 'tenantA',
                exp: Math.floor(Date.now() / 1000) + 3600,
              };
            }
            if (token === 'regular_user_token') {
              return {
                uid: 'regular_user_1',
                roles: ['STAFF'],
                tenantId: 'tenantA',
                exp: Math.floor(Date.now() / 1000) + 3600,
              };
            }
            throw new Error('Invalid token');
          },
        }),
      });
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('8. valid Firebase token -> ACCEPTED', async () => {
      const principal = await verifier.verifyTokenAsync('Bearer valid_prod_token');
      expect(principal.id).toBe('prod_user1');
    });

    it('9. wrong issuer in production -> DENIED', async () => {
      await expect(verifier.verifyTokenAsync('Bearer wrong_issuer')).rejects.toThrow(/incorrect "iss"/);
    });

    it('10. wrong audience in production -> DENIED', async () => {
      await expect(verifier.verifyTokenAsync('Bearer wrong_audience')).rejects.toThrow(/incorrect "aud"/);
    });

    it('11. invalid signature in production -> DENIED', async () => {
      await expect(verifier.verifyTokenAsync('Bearer invalid_signature_prod')).rejects.toThrow(/invalid signature/);
    });

    it('12. expired token in production -> DENIED', async () => {
      await expect(verifier.verifyTokenAsync('Bearer expired_prod_token')).rejects.toThrow(/expired/);
    });

    it('13. verified authorized owner -> ACCEPTED by MasterAuthority', async () => {
      const principal = await verifier.verifyTokenAsync('Bearer owner_token');
      expect(principal.roles).toContain('BUSINESS_OWNER');
      expect(() => masterAuthority.assertOwnerOrMasterAuthority(principal, 'PROVISION_DBK')).not.toThrow();
    });

    it('14. verified user without owner authority -> REJECTED by provisioning', async () => {
      const principal = await verifier.verifyTokenAsync('Bearer regular_user_token');
      expect(principal.roles).not.toContain('BUSINESS_OWNER');
      expect(principal.roles).not.toContain('TDBK_MASTER_ADMIN');
      
      const context: SecurityContext = {
        requestId: 'req_test_prov_unauth',
        correlationId: 'corr_test_prov_unauth',
        timestamp: new Date().toISOString(),
        principal,
        tenantContext: null,
        branchContext: null,
      };

      await expect(
        provisioningService.provisionDbk(context, {
          dbkId: 'dbk_unauth_test',
          legalName: 'Unauthorized DBK',
          blueprintId: 'school_fee_structure',
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('15. tenant boundary remains strictly enforced after verification', async () => {
      const principal = await verifier.verifyTokenAsync('Bearer unauthorized_dbk');
      expect(principal.tenantId).toBe('tenantA');
      expect(() => tenantIsolation.assertTenantIsolation(principal, 'tenantB', 'READ')).toThrow(/Cross-tenant access denied/);
    });
  });
});
