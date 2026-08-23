import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityContext } from '../types';
import { tdbkIdentityService } from '../identity/tdbkIdentityService';
import { firebaseIdentityManager } from '../identity/firebaseIdentityManager';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { tdbkIdentityRepository } from '../../persistence/firestore/repositories/tdbkIdentityRepository';
import { AuthorizationError } from '../errors/kernelErrors';

describe('TDBK Master Bootstrap', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalBootstrapUid = process.env.TDBK_BOOTSTRAP_MASTER_UID;
  const BOOTSTRAP_UID = 'bootstrap_user_123';

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.TDBK_BOOTSTRAP_MASTER_UID = BOOTSTRAP_UID;
    
    // Mock Firebase
    firebaseIdentityManager._setAdminForTesting({
      auth: () => ({
        getUser: async (uid: string) => {
          if (uid === BOOTSTRAP_UID) return { uid, email: 'master@tdbk.local' };
          throw new Error('Not found');
        },
        setCustomUserClaims: async () => {},
        revokeRefreshTokens: async () => {},
      }),
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.TDBK_BOOTSTRAP_MASTER_UID = originalBootstrapUid;
    firestoreClient.clearAllForTesting();
  });

  it('A. First configured Firebase UID can bootstrap -> SUCCESS', async () => {
    const context: SecurityContext = {
      requestId: 'req_1',
      correlationId: 'corr_1',
      timestamp: new Date().toISOString(),
      principal: { id: BOOTSTRAP_UID, email: 'master@tdbk.local', roles: [], isMaster: false },
      tenantContext: null,
      branchContext: null,
    };

    const identity = await tdbkIdentityService.bootstrapProductionMaster(context);
    expect(identity.isMaster).toBe(true);
    expect(identity.roles).toContain('TDBK_MASTER_ADMIN');
    
    const saved = await tdbkIdentityRepository.getIdentity(BOOTSTRAP_UID);
    expect(saved?.isMaster).toBe(true);
  });

  it('B. Wrong Firebase UID -> DENIED', async () => {
    const context: SecurityContext = {
      requestId: 'req_2',
      correlationId: 'corr_2',
      timestamp: new Date().toISOString(),
      principal: { id: 'hacker', email: 'hacker@tdbk.local', roles: [], isMaster: false },
      tenantContext: null,
      branchContext: null,
    };

    await expect(tdbkIdentityService.bootstrapProductionMaster(context)).rejects.toThrow(AuthorizationError);
  });

  it('D. Non-production environment -> DENIED', async () => {
    process.env.NODE_ENV = 'development';
    const context: SecurityContext = {
      requestId: 'req_3',
      correlationId: 'corr_3',
      timestamp: new Date().toISOString(),
      principal: { id: BOOTSTRAP_UID, email: 'master@tdbk.local', roles: [], isMaster: false },
      tenantContext: null,
      branchContext: null,
    };

    await expect(tdbkIdentityService.bootstrapProductionMaster(context)).rejects.toThrow(AuthorizationError);
  });

  it('E. Bootstrap cannot be called twice -> DENIED', async () => {
    const context: SecurityContext = {
      requestId: 'req_4',
      correlationId: 'corr_4',
      timestamp: new Date().toISOString(),
      principal: { id: BOOTSTRAP_UID, email: 'master@tdbk.local', roles: [], isMaster: false },
      tenantContext: null,
      branchContext: null,
    };

    await tdbkIdentityService.bootstrapProductionMaster(context);
    await expect(tdbkIdentityService.bootstrapProductionMaster(context)).rejects.toThrow(AuthorizationError);
  });
});
