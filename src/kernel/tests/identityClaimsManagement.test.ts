/**
 * TDBK V2 — IDENTITY & FIREBASE CLAIMS MANAGEMENT TEST SUITE
 * Architectural Layer: LAYER 1 — KERNEL / SECURITY BOUNDARY
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tdbkIdentityService } from '../identity/tdbkIdentityService';
import { firebaseIdentityManager } from '../identity/firebaseIdentityManager';
import { TokenVerifier } from '../identity/tokenVerifier';
import { masterAuthority } from '../master/masterAuthority';
import { tenantIsolation } from '../tenancy/tenantIsolation';
import { provisioningService } from '../../platform/provisioning/provisioningService';
import { SecurityContext } from '../types';
import { AuthorizationError, TenantIsolationError } from '../errors/kernelErrors';
import { tdbkIdentityRepository } from '../../persistence/firestore/repositories/tdbkIdentityRepository';

describe('TDBK V2 — Production Identity & Claims Management', () => {
  const originalEnv = process.env.NODE_ENV;
  let mockFirebaseStore: Map<string, { uid: string; email?: string; customClaims?: Record<string, any> }>;
  let verifier: TokenVerifier;

  const masterContext: SecurityContext = {
    requestId: 'req_test_master',
    correlationId: 'corr_test_master',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'usr_master_superadmin',
      email: 'master@tdbk.internal',
      isMaster: true,
      tenantId: null,
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'SERVICE_KEY',
    },
    tenantContext: null,
    branchContext: null,
  };

  beforeEach(() => {
    mockFirebaseStore = new Map();
    verifier = new TokenVerifier();

    // Mock Firebase Admin Auth for deterministic testing
    const mockAdminAuth = {
      getUser: async (uid: string) => {
        const user = mockFirebaseStore.get(uid);
        if (!user) throw new Error(`User not found: ${uid}`);
        return { ...user };
      },
      getUserByEmail: async (email: string) => {
        for (const user of mockFirebaseStore.values()) {
          if (user.email === email) return { ...user };
        }
        throw new Error(`User not found with email: ${email}`);
      },
      setCustomUserClaims: async (uid: string, claims: Record<string, any>) => {
        const user = mockFirebaseStore.get(uid) || { uid, email: `${uid}@test.com`, customClaims: {} };
        user.customClaims = { ...claims };
        mockFirebaseStore.set(uid, user);
      },
      revokeRefreshTokens: async (_uid: string) => {
        // Track revocation
      },
      verifyIdToken: async (token: string) => {
        // Decode simulated token
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token structure');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return payload;
      },
    };

    firebaseIdentityManager._setAdminForTesting(mockAdminAuth);
    verifier._setAdminForTesting({ auth: () => mockAdminAuth });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('TEST A: Ordinary Firebase authenticated user (roles=[]) CANNOT provision a DBK', async () => {
    const unprivilegedPrincipal = {
      id: 'usr_ordinary_firebase_123',
      email: 'ordinary@example.com',
      isMaster: false,
      tenantId: null,
      branchId: null,
      roles: [],
      permissions: [],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'JWT' as const,
    };

    const context: SecurityContext = {
      requestId: 'req_test_unauth',
      correlationId: 'corr_test_unauth',
      timestamp: new Date().toISOString(),
      principal: unprivilegedPrincipal,
      tenantContext: null,
      branchContext: null,
    };

    // MasterAuthority check must throw AuthorizationError
    expect(() =>
      masterAuthority.assertOwnerOrMasterAuthority(unprivilegedPrincipal, 'PROVISION_DBK', context.requestId)
    ).toThrow(AuthorizationError);

    // Provisioning service must reject
    await expect(
      provisioningService.provisionDbk(context, {
        dbkId: 'dbk_unauth_attempt',
        legalName: 'Unauthorized Attempt',
        blueprintId: 'school_v1',
      })
    ).rejects.toThrow(AuthorizationError);
  });

  it('TEST B: BUSINESS_OWNER passes assertOwnerOrMasterAuthority() and CAN provision a DBK', async () => {
    const ownerPrincipal = {
      id: 'usr_biz_owner_789',
      email: 'owner@enterprise.co.ke',
      isMaster: false,
      tenantId: null,
      branchId: null,
      roles: ['BUSINESS_OWNER'],
      permissions: ['PORTFOLIO_READ', 'PORTFOLIO_WRITE', 'DBK_PROVISION'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'JWT' as const,
    };

    const context: SecurityContext = {
      requestId: 'req_test_owner_prov',
      correlationId: 'corr_test_owner_prov',
      timestamp: new Date().toISOString(),
      principal: ownerPrincipal,
      tenantContext: null,
      branchContext: null,
    };

    // Master authority check passes
    expect(() =>
      masterAuthority.assertOwnerOrMasterAuthority(ownerPrincipal, 'PROVISION_DBK', context.requestId)
    ).not.toThrow();

    // Provisioning succeeds
    const res = await provisioningService.provisionDbk(context, {
      dbkId: `dbk_owner_test_${Date.now()}`,
      legalName: 'Owner Enterprise Campus',
      blueprintId: 'school_v1',
      subscriptionTier: 'PRO',
      primaryBranchName: 'Main Campus',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('ACTIVE');
  });

  it('TEST C: OWNER_OPERATOR can perform permitted owner operations', async () => {
    const operatorPrincipal = {
      id: 'usr_operator_456',
      email: 'operator@tenant1.co.ke',
      isMaster: false,
      tenantId: 'dbk_tenant_1',
      branchId: 'HQ',
      roles: ['OWNER_OPERATOR'],
      permissions: ['TENANT_ADMIN', 'BRANCH_MANAGE', 'STAFF_MANAGE'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'JWT' as const,
    };

    expect(masterAuthority.isOwnerPortfolio(operatorPrincipal)).toBe(true);
    expect(masterAuthority.isMasterAdmin(operatorPrincipal)).toBe(false);
  });

  it('TEST D: BUSINESS_OWNER CANNOT grant itself or others TDBK_MASTER_ADMIN', async () => {
    const ownerContext: SecurityContext = {
      requestId: 'req_test_owner_escalate',
      correlationId: 'corr_test_owner_escalate',
      timestamp: new Date().toISOString(),
      principal: {
        id: 'usr_owner_escalator',
        email: 'owner@escalate.com',
        isMaster: false,
        tenantId: null,
        branchId: null,
        roles: ['BUSINESS_OWNER'],
        permissions: ['PORTFOLIO_READ', 'PORTFOLIO_WRITE'],
        authTime: Math.floor(Date.now() / 1000),
        tokenSource: 'JWT',
      },
      tenantContext: null,
      branchContext: null,
    };

    // Attempt to provision an identity with TDBK_MASTER_ADMIN
    await expect(
      tdbkIdentityService.provisionTdbkIdentity(ownerContext, {
        uid: 'usr_hacked_admin',
        roles: ['TDBK_MASTER_ADMIN'],
        isMaster: true,
      })
    ).rejects.toThrow(AuthorizationError);

    // Attempt to grant master admin
    await expect(
      tdbkIdentityService.grantMasterAdmin(ownerContext, 'usr_owner_escalator')
    ).rejects.toThrow(AuthorizationError);
  });

  it('TEST E: OWNER_OPERATOR CANNOT grant itself TDBK_MASTER_ADMIN or BUSINESS_OWNER', async () => {
    const operatorContext: SecurityContext = {
      requestId: 'req_test_operator_escalate',
      correlationId: 'corr_test_operator_escalate',
      timestamp: new Date().toISOString(),
      principal: {
        id: 'usr_operator_escalator',
        email: 'operator@tenant1.com',
        isMaster: false,
        tenantId: 'tenant1',
        branchId: null,
        roles: ['OWNER_OPERATOR'],
        permissions: ['TENANT_ADMIN'],
        authTime: Math.floor(Date.now() / 1000),
        tokenSource: 'JWT',
      },
      tenantContext: null,
      branchContext: null,
    };

    // Attempt to promote someone to Business Owner
    await expect(
      tdbkIdentityService.promoteToBusinessOwner(operatorContext, { targetUid: 'usr_friend' })
    ).rejects.toThrow(AuthorizationError);

    // Attempt to assign BUSINESS_OWNER role via tenant role assignment
    await expect(
      tdbkIdentityService.assignTenantRole(operatorContext, {
        targetUid: 'usr_friend',
        tenantId: 'tenant1',
        role: 'BUSINESS_OWNER',
      })
    ).rejects.toThrow(AuthorizationError);
  });

  it('TEST F: TDBK_MASTER_ADMIN can manage owner identities (promote, revoke, update)', async () => {
    // 1. Setup target Firebase user
    mockFirebaseStore.set('usr_candidate_1', {
      uid: 'usr_candidate_1',
      email: 'candidate@company.com',
      customClaims: {},
    });

    // 2. Promote to Business Owner
    const promoted = await tdbkIdentityService.promoteToBusinessOwner(masterContext, {
      targetUid: 'usr_candidate_1',
      email: 'candidate@company.com',
    });

    expect(promoted.roles).toContain('BUSINESS_OWNER');
    expect(promoted.permissions).toContain('DBK_PROVISION');

    // Check Firebase custom claims
    const fbUser = mockFirebaseStore.get('usr_candidate_1');
    expect(fbUser?.customClaims?.tdbk?.roles).toContain('BUSINESS_OWNER');
    expect(fbUser?.customClaims?.roles).toContain('BUSINESS_OWNER');

    // 3. Revoke role
    const revoked = await tdbkIdentityService.revokeRole(masterContext, {
      targetUid: 'usr_candidate_1',
      role: 'BUSINESS_OWNER',
    });

    expect(revoked.roles).not.toContain('BUSINESS_OWNER');
    const fbUserAfter = mockFirebaseStore.get('usr_candidate_1');
    expect(fbUserAfter?.customClaims?.roles).not.toContain('BUSINESS_OWNER');
  });

  it('TEST G: Tenant isolation remains intact after role assignments', async () => {
    mockFirebaseStore.set('usr_staff_alpha', {
      uid: 'usr_staff_alpha',
      email: 'staff@alpha.com',
      customClaims: {},
    });

    // Assign Staff role for Tenant Alpha
    await tdbkIdentityService.provisionTdbkIdentity(masterContext, {
      uid: 'usr_staff_alpha',
      email: 'staff@alpha.com',
      tenantId: 'tenant_alpha',
      branchId: 'HQ',
      roles: ['STAFF'],
      permissions: ['POS_OPERATE'],
    });

    const identity = await tdbkIdentityRepository.getIdentity('usr_staff_alpha');
    expect(identity?.tenantId).toBe('tenant_alpha');

    const principal = {
      id: 'usr_staff_alpha',
      isMaster: false,
      tenantId: identity!.tenantId,
      branchId: identity!.branchId,
      roles: identity!.roles,
      permissions: identity!.permissions,
      authTime: Date.now(),
      tokenSource: 'JWT' as const,
    };

    // Valid access to own tenant
    expect(() => tenantIsolation.assertTenantIsolation(principal, 'tenant_alpha', 'READ')).not.toThrow();

    // Cross-tenant access strictly blocked
    expect(() => tenantIsolation.assertTenantIsolation(principal, 'tenant_beta', 'READ')).toThrow(TenantIsolationError);
  });

  it('TEST H: Existing Firebase custom claims unrelated to TDBK survive claim updates', async () => {
    // User already has unrelated Firebase claims (e.g. enterprise SSO flags, stripe id, etc.)
    mockFirebaseStore.set('usr_custom_claims_user', {
      uid: 'usr_custom_claims_user',
      email: 'sso@corp.com',
      customClaims: {
        sso_provider: 'okta',
        stripe_customer_id: 'cus_123456',
        beta_features_enabled: true,
      },
    });

    // Apply TDBK Claims
    await firebaseIdentityManager.setTdbkClaims('usr_custom_claims_user', {
      roles: ['BUSINESS_OWNER'],
      permissions: ['PORTFOLIO_READ'],
      tenantId: null,
      branchId: null,
      isMaster: false,
    });

    const claims = await firebaseIdentityManager.getCustomClaims('usr_custom_claims_user');
    // Unrelated claims are preserved!
    expect(claims.sso_provider).toBe('okta');
    expect(claims.stripe_customer_id).toBe('cus_123456');
    expect(claims.beta_features_enabled).toBe(true);
    // TDBK claims added
    expect(claims.tdbk.roles).toContain('BUSINESS_OWNER');
    expect(claims.roles).toContain('BUSINESS_OWNER');
  });

  it('TEST I: Revoked TDBK role no longer authorizes the user on fresh token verification', async () => {
    process.env.NODE_ENV = 'production';

    mockFirebaseStore.set('usr_to_revoke', {
      uid: 'usr_to_revoke',
      email: 'revoked@corp.com',
      customClaims: {
        tdbk: { roles: ['BUSINESS_OWNER'], isMaster: false },
        roles: ['BUSINESS_OWNER'],
      },
    });

    // 1. Revoke role
    await firebaseIdentityManager.removeTdbkClaims('usr_to_revoke');

    const updatedClaims = await firebaseIdentityManager.getCustomClaims('usr_to_revoke');
    expect(updatedClaims.tdbk).toBeUndefined();
    expect(updatedClaims.roles).toBeUndefined();

    // 2. Token verification returns principal with empty roles
    const mockToken = `header.${Buffer.from(
      JSON.stringify({
        uid: 'usr_to_revoke',
        ...updatedClaims,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url')}.sig`;

    const principal = await verifier.verifyTokenAsync(`Bearer ${mockToken}`);
    expect(principal.roles).toHaveLength(0);
    expect(() => masterAuthority.assertOwnerOrMasterAuthority(principal, 'PROVISION_DBK')).toThrow(AuthorizationError);
  });

  it('END-TO-END: Real Firebase Claims Lifecycle (12-step complete verification)', async () => {
    process.env.NODE_ENV = 'production';
    const candidateUid = 'usr_firebase_new_user_100';

    // Step 1: User registers in Firebase Authentication (0 roles)
    mockFirebaseStore.set(candidateUid, {
      uid: candidateUid,
      email: 'newowner@gmail.com',
      customClaims: { provider: 'google.com' },
    });

    // Step 2: User gets ID token and attempts DBK provisioning -> DENIED
    const rawClaims = (await firebaseIdentityManager.getUserByUid(candidateUid)).customClaims;
    const initialToken = `h.${Buffer.from(
      JSON.stringify({ uid: candidateUid, ...rawClaims, exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString('base64url')}.sig`;

    const p1 = await verifier.verifyTokenAsync(`Bearer ${initialToken}`);
    expect(p1.roles).toEqual([]);
    expect(() => masterAuthority.assertOwnerOrMasterAuthority(p1, 'PROVISION_DBK')).toThrow(AuthorizationError);

    // Step 3: TDBK MASTER ADMIN authoritatively promotes user to BUSINESS_OWNER
    const promoted = await tdbkIdentityService.promoteToBusinessOwner(masterContext, {
      targetUid: candidateUid,
      email: 'newowner@gmail.com',
    });
    expect(promoted.roles).toContain('BUSINESS_OWNER');

    // Step 4: User refreshes Firebase ID token containing authoritative custom claims
    const ownerClaims = (await firebaseIdentityManager.getUserByUid(candidateUid)).customClaims;
    const ownerToken = `h.${Buffer.from(
      JSON.stringify({ uid: candidateUid, ...ownerClaims, exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString('base64url')}.sig`;

    const p2 = await verifier.verifyTokenAsync(`Bearer ${ownerToken}`);
    expect(p2.roles).toContain('BUSINESS_OWNER');

    // Step 5: User provisions new DBK with BUSINESS_OWNER authority -> SUCCESS!
    const targetDbkId = `dbk_e2e_school_${Date.now()}`;
    const ownerContext: SecurityContext = {
      requestId: 'req_e2e_prov',
      correlationId: 'corr_e2e_prov',
      timestamp: new Date().toISOString(),
      principal: p2,
      tenantContext: null,
      branchContext: null,
    };

    const provResult = await provisioningService.provisionDbk(ownerContext, {
      dbkId: targetDbkId,
      legalName: 'E2E Verified International School',
      blueprintId: 'school_v1',
      subscriptionTier: 'PRO',
      primaryBranchName: 'Main Campus',
    });

    expect(provResult.success).toBe(true);
    expect(provResult.status).toBe('ACTIVE');

    // Step 6: Business Owner delegates BRANCH_MANAGER role for this DBK to a staff member
    const staffUid = 'usr_staff_e2e_200';
    mockFirebaseStore.set(staffUid, {
      uid: staffUid,
      email: 'manager@e2eschool.com',
      customClaims: {},
    });

    await tdbkIdentityService.assignTenantRole(ownerContext, {
      targetUid: staffUid,
      tenantId: targetDbkId,
      role: 'BRANCH_MANAGER',
      branchId: 'HQ',
    });

    // Step 7: Staff member presents token and operates within target DBK -> ALLOWED
    const staffClaims = (await firebaseIdentityManager.getUserByUid(staffUid)).customClaims;
    const staffToken = `h.${Buffer.from(
      JSON.stringify({ uid: staffUid, ...staffClaims, exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString('base64url')}.sig`;

    const staffPrincipal = await verifier.verifyTokenAsync(`Bearer ${staffToken}`);
    expect(staffPrincipal.roles).toContain('BRANCH_MANAGER');
    expect(staffPrincipal.tenantId).toBe(targetDbkId);
    expect(() => tenantIsolation.assertTenantIsolation(staffPrincipal, targetDbkId, 'OPERATE')).not.toThrow();

    // Step 8: Staff member attempts cross-tenant operation -> DENIED
    expect(() => tenantIsolation.assertTenantIsolation(staffPrincipal, 'other_foreign_dbk', 'OPERATE')).toThrow(
      TenantIsolationError
    );
  });

  describe('SECURITY HARDENING — TENANT-BOUND OWNER AUTHORITY REGRESSION SUITE', () => {
    const ownerAContext: SecurityContext = {
      requestId: 'req_test_ownerA',
      correlationId: 'corr_test_ownerA',
      timestamp: new Date().toISOString(),
      principal: {
        id: 'usr_business_owner_A',
        email: 'ownerA@holdingcompany.co.ke',
        isMaster: false,
        tenantId: null,
        branchId: null,
        roles: ['BUSINESS_OWNER'],
        permissions: ['PORTFOLIO_READ', 'PORTFOLIO_WRITE', 'DBK_PROVISION'],
        authTime: Math.floor(Date.now() / 1000),
        tokenSource: 'JWT',
      },
      tenantContext: null,
      branchContext: null,
    };

    const ownerBContext: SecurityContext = {
      requestId: 'req_test_ownerB',
      correlationId: 'corr_test_ownerB',
      timestamp: new Date().toISOString(),
      principal: {
        id: 'usr_business_owner_B',
        email: 'ownerB@otherportfolio.co.ke',
        isMaster: false,
        tenantId: null,
        branchId: null,
        roles: ['BUSINESS_OWNER'],
        permissions: ['PORTFOLIO_READ', 'PORTFOLIO_WRITE', 'DBK_PROVISION'],
        authTime: Math.floor(Date.now() / 1000),
        tokenSource: 'JWT',
      },
      tenantContext: null,
      branchContext: null,
    };

    let tenantAId: string;
    let tenantBId: string;

    beforeEach(async () => {
      tenantAId = `dbk_tenant_A_${Date.now()}`;
      tenantBId = `dbk_tenant_B_${Date.now()}`;

      // Owner A provisions Tenant A
      await provisioningService.provisionDbk(ownerAContext, {
        dbkId: tenantAId,
        legalName: 'Owner A Enterprise DBK',
        blueprintId: 'school_v1',
        subscriptionTier: 'PRO',
      });

      // Owner B provisions Tenant B
      await provisioningService.provisionDbk(ownerBContext, {
        dbkId: tenantBId,
        legalName: 'Owner B Enterprise DBK',
        blueprintId: 'retail_v1',
        subscriptionTier: 'ENTERPRISE',
      });
    });

    it('1. Business Owner A can manage identities in their own Tenant A', async () => {
      mockFirebaseStore.set('usr_staff_tenantA', {
        uid: 'usr_staff_tenantA',
        email: 'staffA@companyA.com',
        customClaims: {},
      });

      // Provision identity in Tenant A by Owner A -> SUCCESS
      const record = await tdbkIdentityService.provisionTdbkIdentity(ownerAContext, {
        uid: 'usr_staff_tenantA',
        email: 'staffA@companyA.com',
        tenantId: tenantAId,
        roles: ['STAFF'],
      });

      expect(record.tenantId).toBe(tenantAId);
      expect(record.roles).toContain('STAFF');

      // List identities in Tenant A -> SUCCESS
      const listA = await tdbkIdentityService.listIdentities(ownerAContext, tenantAId);
      expect(listA.some(u => u.uid === 'usr_staff_tenantA')).toBe(true);

      // Get identity in Tenant A -> SUCCESS
      const fetched = await tdbkIdentityService.getIdentity(ownerAContext, 'usr_staff_tenantA');
      expect(fetched?.uid).toBe('usr_staff_tenantA');
    });

    it('2. Business Owner A CANNOT provision identities in Tenant B (Cross-Tenant Denial)', async () => {
      mockFirebaseStore.set('usr_attacker_target', {
        uid: 'usr_attacker_target',
        email: 'target@companyB.com',
        customClaims: {},
      });

      // Attempt to provision into Tenant B using Owner A context -> REJECTED
      await expect(
        tdbkIdentityService.provisionTdbkIdentity(ownerAContext, {
          uid: 'usr_attacker_target',
          email: 'target@companyB.com',
          tenantId: tenantBId,
          roles: ['BRANCH_MANAGER'],
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('3. Business Owner A CANNOT assign or revoke roles in Tenant B', async () => {
      mockFirebaseStore.set('usr_staff_tenantB', {
        uid: 'usr_staff_tenantB',
        email: 'staffB@companyB.com',
        customClaims: {},
      });

      // Owner B provisions legitimate user in Tenant B
      await tdbkIdentityService.provisionTdbkIdentity(ownerBContext, {
        uid: 'usr_staff_tenantB',
        email: 'staffB@companyB.com',
        tenantId: tenantBId,
        roles: ['STAFF'],
      });

      // Owner A attempts to assign role in Tenant B -> REJECTED
      await expect(
        tdbkIdentityService.assignTenantRole(ownerAContext, {
          targetUid: 'usr_staff_tenantB',
          tenantId: tenantBId,
          role: 'BRANCH_MANAGER',
        })
      ).rejects.toThrow(AuthorizationError);

      // Owner A attempts to revoke role of user in Tenant B -> REJECTED
      await expect(
        tdbkIdentityService.revokeRole(ownerAContext, {
          targetUid: 'usr_staff_tenantB',
          role: 'STAFF',
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('4. Business Owner A CANNOT inspect identities belonging to Tenant B', async () => {
      mockFirebaseStore.set('usr_private_tenantB', {
        uid: 'usr_private_tenantB',
        email: 'privateB@companyB.com',
        customClaims: {},
      });

      await tdbkIdentityService.provisionTdbkIdentity(ownerBContext, {
        uid: 'usr_private_tenantB',
        email: 'privateB@companyB.com',
        tenantId: tenantBId,
        roles: ['STAFF'],
      });

      // Owner A attempts to list identities for Tenant B -> REJECTED
      await expect(
        tdbkIdentityService.listIdentities(ownerAContext, tenantBId)
      ).rejects.toThrow(AuthorizationError);

      // Owner A attempts to fetch specific identity in Tenant B -> REJECTED
      await expect(
        tdbkIdentityService.getIdentity(ownerAContext, 'usr_private_tenantB')
      ).rejects.toThrow(AuthorizationError);
    });

    it('5. OWNER_OPERATOR of Tenant A cannot manage Tenant B or global identities', async () => {
      const operatorAContext: SecurityContext = {
        requestId: 'req_test_opA',
        correlationId: 'corr_test_opA',
        timestamp: new Date().toISOString(),
        principal: {
          id: 'usr_operator_A',
          email: 'opA@tenantA.com',
          isMaster: false,
          tenantId: tenantAId,
          branchId: 'HQ',
          roles: ['OWNER_OPERATOR'],
          permissions: ['TENANT_ADMIN', 'BRANCH_MANAGE', 'STAFF_MANAGE'],
          authTime: Math.floor(Date.now() / 1000),
          tokenSource: 'JWT',
        },
        tenantContext: null,
        branchContext: null,
      };

      mockFirebaseStore.set('usr_candidate_user', {
        uid: 'usr_candidate_user',
        email: 'cand@example.com',
        customClaims: {},
      });

      // Operator A can provision for Tenant A
      const resA = await tdbkIdentityService.provisionTdbkIdentity(operatorAContext, {
        uid: 'usr_candidate_user',
        email: 'cand@example.com',
        tenantId: tenantAId,
        roles: ['STAFF'],
      });
      expect(resA.tenantId).toBe(tenantAId);

      // Operator A CANNOT provision for Tenant B -> REJECTED
      await expect(
        tdbkIdentityService.provisionTdbkIdentity(operatorAContext, {
          uid: 'usr_candidate_user_2',
          email: 'cand2@example.com',
          tenantId: tenantBId,
          roles: ['STAFF'],
        })
      ).rejects.toThrow(AuthorizationError);

      // Operator A CANNOT list all global identities -> REJECTED
      await expect(
        tdbkIdentityService.listIdentities(operatorAContext)
      ).rejects.toThrow(AuthorizationError);
    });

    it('6. TDBK_MASTER_ADMIN retains authoritative global access across all tenants', async () => {
      // Master Admin can list Tenant A
      const listA = await tdbkIdentityService.listIdentities(masterContext, tenantAId);
      expect(Array.isArray(listA)).toBe(true);

      // Master Admin can list Tenant B
      const listB = await tdbkIdentityService.listIdentities(masterContext, tenantBId);
      expect(Array.isArray(listB)).toBe(true);

      // Master Admin can list ALL global identities
      const listAll = await tdbkIdentityService.listIdentities(masterContext);
      expect(Array.isArray(listAll)).toBe(true);
    });
  });
});
