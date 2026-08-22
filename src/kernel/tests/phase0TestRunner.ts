/**
 * TDBK V2 PHASE 0 MANDATORY SECURITY TEST SUITE RUNNER
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { TokenVerifier } from '../identity/tokenVerifier';
import { rbacEngine } from '../authorization/rbacEngine';
import { masterAuthority } from '../master/masterAuthority';
import { tenantIsolation } from '../tenancy/tenantIsolation';
import { branchAuthority } from '../branch/branchAuthority';
import { auditLogger } from '../audit/auditLogger';
import { securityContextFactory } from '../context/contextFactory';
import { Principal } from '../types';

export interface TestCaseResult {
  testId: string;
  name: string;
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'TENANT_ISOLATION' | 'BRANCH' | 'MASTER' | 'AUDIT';
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  expectedResult: string;
  actualResult: string;
  details?: string;
  traceableAuditEventId?: string;
}

export interface Phase0TestSuiteSummary {
  executedAt: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  overallStatus: 'PASS' | 'FAIL';
  results: TestCaseResult[];
}

export class Phase0TestRunner {
  public async runAllTests(): Promise<Phase0TestSuiteSummary> {
    auditLogger.clearBufferForTesting();
    const startTime = Date.now();
    const results: TestCaseResult[] = [];

    // Setup Test Principals & Tokens
    const masterAdminToken = TokenVerifier.mintTestToken({
      uid: 'user_master_001',
      email: 'master@tdbk.co.ke',
      isMaster: true,
      tenantId: null,
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
    });

    const tenantAAdminToken = TokenVerifier.mintTestToken({
      uid: 'user_tenantA_admin',
      email: 'admin@schoolA.ac.ke',
      isMaster: false,
      tenantId: 'tenant_school_a',
      branchId: 'branch_hq',
      roles: ['TENANT_ADMIN'],
      permissions: ['school:read', 'school:write', 'finance:read'],
    });

    const tenantAUserToken = TokenVerifier.mintTestToken({
      uid: 'user_tenantA_staff',
      email: 'staff@schoolA.ac.ke',
      isMaster: false,
      tenantId: 'tenant_school_a',
      branchId: 'branch_hq',
      roles: ['STAFF'],
      permissions: ['school:read'],
    });

    const tenantAUserOtherBranchToken = TokenVerifier.mintTestToken({
      uid: 'user_tenantA_branch2',
      email: 'staff2@schoolA.ac.ke',
      isMaster: false,
      tenantId: 'tenant_school_a',
      branchId: 'branch_secondary',
      roles: ['STAFF'],
      permissions: ['school:read'],
    });

    const tenantBUserToken = TokenVerifier.mintTestToken({
      uid: 'user_tenantB_admin',
      email: 'admin@hardwareB.co.ke',
      isMaster: false,
      tenantId: 'tenant_hardware_b',
      branchId: 'branch_main',
      roles: ['TENANT_ADMIN'],
      permissions: ['hardware:read', 'hardware:write'],
    });

    // -------------------------------------------------------------
    // TEST 1: Unauthenticated request -> DENIED
    // -------------------------------------------------------------
    const t1Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({ requestId: 'req_t1' });
      rbacEngine.assertAuthorization(ctx.principal, 'read', 'tenant:data', {
        tenantId: 'tenant_school_a',
        requiredPermission: 'school:read',
        requestId: 'req_t1',
      });
      results.push({
        testId: 'TEST_01',
        name: 'Unauthenticated Request Access Check',
        category: 'AUTHENTICATION',
        status: 'FAILED',
        durationMs: Date.now() - t1Start,
        expectedResult: 'Access DENIED with AuthenticationError or AuthorizationError',
        actualResult: 'Access unexpectedly ALLOWED',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_01',
        name: 'Unauthenticated Request Access Check',
        category: 'AUTHENTICATION',
        status: 'PASSED',
        durationMs: Date.now() - t1Start,
        expectedResult: 'Access DENIED',
        actualResult: `Access DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 2: Authenticated user without permission -> DENIED
    // -------------------------------------------------------------
    const t2Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAUserToken}`,
        targetTenantId: 'tenant_school_a',
        requestId: 'req_t2',
      });
      rbacEngine.assertAuthorization(ctx.principal, 'delete', 'finance:ledger', {
        tenantId: 'tenant_school_a',
        requiredPermission: 'finance:delete', // User only has school:read
        requestId: 'req_t2',
      });
      results.push({
        testId: 'TEST_02',
        name: 'Authenticated User Without Required Permission',
        category: 'AUTHORIZATION',
        status: 'FAILED',
        durationMs: Date.now() - t2Start,
        expectedResult: 'Access DENIED due to missing permission',
        actualResult: 'Access unexpectedly ALLOWED',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_02',
        name: 'Authenticated User Without Required Permission',
        category: 'AUTHORIZATION',
        status: 'PASSED',
        durationMs: Date.now() - t2Start,
        expectedResult: 'Access DENIED',
        actualResult: `Access DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 3: Authorized user -> ALLOWED
    // -------------------------------------------------------------
    const t3Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAAdminToken}`,
        targetTenantId: 'tenant_school_a',
        requestId: 'req_t3',
      });
      rbacEngine.assertAuthorization(ctx.principal, 'read', 'school:students', {
        tenantId: 'tenant_school_a',
        requiredPermission: 'school:read',
        requestId: 'req_t3',
      });
      results.push({
        testId: 'TEST_03',
        name: 'Fully Authorized User Request',
        category: 'AUTHORIZATION',
        status: 'PASSED',
        durationMs: Date.now() - t3Start,
        expectedResult: 'Access ALLOWED',
        actualResult: 'Access ALLOWED successfully',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_03',
        name: 'Fully Authorized User Request',
        category: 'AUTHORIZATION',
        status: 'FAILED',
        durationMs: Date.now() - t3Start,
        expectedResult: 'Access ALLOWED',
        actualResult: `Unexpected failure: ${(err as Error).message}`,
      });
    }

    // -------------------------------------------------------------
    // TEST 4: DBK-A user attempting DBK-B access -> DENIED
    // -------------------------------------------------------------
    const t4Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAAdminToken}`,
        requestId: 'req_t4',
      });
      tenantIsolation.assertTenantIsolation(
        ctx.principal,
        'tenant_hardware_b', // Attempting access to Tenant B!
        'read:inventory',
        'req_t4'
      );
      results.push({
        testId: 'TEST_04',
        name: 'Cross-Tenant Access Barrier (DBK-A -> DBK-B)',
        category: 'TENANT_ISOLATION',
        status: 'FAILED',
        durationMs: Date.now() - t4Start,
        expectedResult: 'Cross-tenant access DENIED',
        actualResult: 'Access unexpectedly ALLOWED across tenant boundary',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_04',
        name: 'Cross-Tenant Access Barrier (DBK-A -> DBK-B)',
        category: 'TENANT_ISOLATION',
        status: 'PASSED',
        durationMs: Date.now() - t4Start,
        expectedResult: 'Cross-tenant access DENIED',
        actualResult: `Cross-tenant access DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 5: Forged tenantId -> DENIED
    // -------------------------------------------------------------
    const t5Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAUserToken}`,
        requestId: 'req_t5',
      });
      tenantIsolation.validateTenantBoundary(
        ctx.principal,
        'tenant_hardware_b', // Forged payload tenantId parameter
        'req_t5'
      );
      results.push({
        testId: 'TEST_05',
        name: 'Forged tenantId Payload Parameter Detection',
        category: 'TENANT_ISOLATION',
        status: 'FAILED',
        durationMs: Date.now() - t5Start,
        expectedResult: 'Forged tenantId DENIED',
        actualResult: 'Forged tenantId accepted',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_05',
        name: 'Forged tenantId Payload Parameter Detection',
        category: 'TENANT_ISOLATION',
        status: 'PASSED',
        durationMs: Date.now() - t5Start,
        expectedResult: 'Forged tenantId DENIED',
        actualResult: `Forged tenantId DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 6: Forged role -> DENIED
    // -------------------------------------------------------------
    const t6Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAUserToken}`, // Token has 'STAFF' role
        requestId: 'req_t6',
      });
      rbacEngine.assertAuthorization(ctx.principal, 'write', 'system:config', {
        tenantId: 'tenant_school_a',
        requiredRole: 'SYSTEM_SUPERVISOR', // Required role not in verified token!
        requestId: 'req_t6',
      });
      results.push({
        testId: 'TEST_06',
        name: 'Forged / Missing Role Requirement',
        category: 'AUTHORIZATION',
        status: 'FAILED',
        durationMs: Date.now() - t6Start,
        expectedResult: 'Forged role assertion DENIED',
        actualResult: 'Forged role accepted',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_06',
        name: 'Forged / Missing Role Requirement',
        category: 'AUTHORIZATION',
        status: 'PASSED',
        durationMs: Date.now() - t6Start,
        expectedResult: 'Forged role assertion DENIED',
        actualResult: `Forged role DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 7: Forged permission -> DENIED
    // -------------------------------------------------------------
    const t7Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantBUserToken}`, // Token permissions: hardware:read, hardware:write
        requestId: 'req_t7',
      });
      rbacEngine.assertAuthorization(ctx.principal, 'execute', 'payroll:disburse', {
        tenantId: 'tenant_hardware_b',
        requiredPermission: 'payroll:admin',
        requestId: 'req_t7',
      });
      results.push({
        testId: 'TEST_07',
        name: 'Forged / Missing Permission Requirement',
        category: 'AUTHORIZATION',
        status: 'FAILED',
        durationMs: Date.now() - t7Start,
        expectedResult: 'Forged permission assertion DENIED',
        actualResult: 'Forged permission accepted',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_07',
        name: 'Forged / Missing Permission Requirement',
        category: 'AUTHORIZATION',
        status: 'PASSED',
        durationMs: Date.now() - t7Start,
        expectedResult: 'Forged permission assertion DENIED',
        actualResult: `Forged permission DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 8: DBK user attempting Master operation -> DENIED
    // -------------------------------------------------------------
    const t8Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAAdminToken}`, // DBK Tenant Admin
        requestId: 'req_t8',
      });
      masterAuthority.assertMasterAuthority(ctx.principal, 'provision:new_tenant', 'req_t8');
      results.push({
        testId: 'TEST_08',
        name: 'DBK Tenant User Attempting Master Platform Action',
        category: 'MASTER',
        status: 'FAILED',
        durationMs: Date.now() - t8Start,
        expectedResult: 'Master platform action DENIED for tenant user',
        actualResult: 'Master platform action ALLOWED for tenant user',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_08',
        name: 'DBK Tenant User Attempting Master Platform Action',
        category: 'MASTER',
        status: 'PASSED',
        durationMs: Date.now() - t8Start,
        expectedResult: 'Master platform action DENIED',
        actualResult: `Master action DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 9: Unauthorized branch access -> DENIED
    // -------------------------------------------------------------
    const t9Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAUserOtherBranchToken}`, // Branch is 'branch_secondary'
        requestId: 'req_t9',
      });
      branchAuthority.assertBranchContext(
        ctx.principal,
        'branch_hq', // Attempting access to HQ branch!
        'read:registers',
        'req_t9'
      );
      results.push({
        testId: 'TEST_09',
        name: 'Unauthorized Cross-Branch Access Attempt',
        category: 'BRANCH',
        status: 'FAILED',
        durationMs: Date.now() - t9Start,
        expectedResult: 'Cross-branch access DENIED',
        actualResult: 'Cross-branch access ALLOWED',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_09',
        name: 'Unauthorized Cross-Branch Access Attempt',
        category: 'BRANCH',
        status: 'PASSED',
        durationMs: Date.now() - t9Start,
        expectedResult: 'Cross-branch access DENIED',
        actualResult: `Branch access DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 10: Authorized branch access -> ALLOWED
    // -------------------------------------------------------------
    const t10Start = Date.now();
    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAUserToken}`, // Token branch is 'branch_hq'
        requestId: 'req_t10',
      });
      const branchCtx = branchAuthority.assertBranchContext(
        ctx.principal,
        'branch_hq', // Matching branch!
        'read:registers',
        'req_t10'
      );
      results.push({
        testId: 'TEST_10',
        name: 'Authorized Branch Context Access',
        category: 'BRANCH',
        status: 'PASSED',
        durationMs: Date.now() - t10Start,
        expectedResult: 'Branch access ALLOWED',
        actualResult: `Branch access ALLOWED for branch '${branchCtx.branchId}'`,
      });
    } catch (err) {
      results.push({
        testId: 'TEST_10',
        name: 'Authorized Branch Context Access',
        category: 'BRANCH',
        status: 'FAILED',
        durationMs: Date.now() - t10Start,
        expectedResult: 'Branch access ALLOWED',
        actualResult: `Unexpected failure: ${(err as Error).message}`,
      });
    }

    // -------------------------------------------------------------
    // TEST 11: Unauthorized direct API access -> DENIED
    // -------------------------------------------------------------
    const t11Start = Date.now();
    try {
      // Simulating direct unauthenticated API request to privileged route
      const ctx = await securityContextFactory.createSecurityContext({ requestId: 'req_t11' });
      rbacEngine.assertAuthorization(ctx.principal, 'admin', 'system:audit_logs', {
        requiredPermission: 'admin:read',
        requestId: 'req_t11',
      });
      results.push({
        testId: 'TEST_11',
        name: 'Direct Unauthenticated API Access Barrier',
        category: 'AUTHENTICATION',
        status: 'FAILED',
        durationMs: Date.now() - t11Start,
        expectedResult: 'Direct API access DENIED',
        actualResult: 'Direct API access ALLOWED',
      });
    } catch (err) {
      results.push({
        testId: 'TEST_11',
        name: 'Direct Unauthenticated API Access Barrier',
        category: 'AUTHENTICATION',
        status: 'PASSED',
        durationMs: Date.now() - t11Start,
        expectedResult: 'Direct API access DENIED',
        actualResult: `Direct API access DENIED (${(err as Error).message})`,
      });
    }

    // -------------------------------------------------------------
    // TEST 12: Security violation creates a traceable security/audit event
    // -------------------------------------------------------------
    const t12Start = Date.now();
    const auditEventsBefore = auditLogger.getEvents({ eventType: 'TENANT_ISOLATION_VIOLATION' });

    try {
      const ctx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${tenantAUserToken}`,
        requestId: 'req_t12_violation',
      });
      tenantIsolation.assertTenantIsolation(ctx.principal, 'tenant_hardware_b', 'READ_UNAUTHORIZED_DATA', 'req_t12_violation');
    } catch {
      // Expected violation
    }

    const auditEventsAfter = auditLogger.getEvents({ eventType: 'TENANT_ISOLATION_VIOLATION' });
    const violationEvent = auditEventsAfter.find((e) => e.requestId === 'req_t12_violation');

    if (violationEvent) {
      results.push({
        testId: 'TEST_12',
        name: 'Traceable Audit Event Recording for Security Violation',
        category: 'AUDIT',
        status: 'PASSED',
        durationMs: Date.now() - t12Start,
        expectedResult: 'Traceable Audit Event recorded',
        actualResult: `Traceable audit event '${violationEvent.id}' recorded with status '${violationEvent.result}'`,
        traceableAuditEventId: violationEvent.id,
      });
    } else {
      results.push({
        testId: 'TEST_12',
        name: 'Traceable Audit Event Recording for Security Violation',
        category: 'AUDIT',
        status: 'FAILED',
        durationMs: Date.now() - t12Start,
        expectedResult: 'Traceable Audit Event recorded',
        actualResult: 'No audit event recorded in buffer for security violation',
      });
    }

    const passedCount = results.filter((r) => r.status === 'PASSED').length;
    const failedCount = results.length - passedCount;

    return {
      executedAt: new Date().toISOString(),
      totalTests: results.length,
      passedCount,
      failedCount,
      overallStatus: failedCount === 0 ? 'PASS' : 'FAIL',
      results,
    };
  }
}

export const phase0TestRunner = new Phase0TestRunner();
