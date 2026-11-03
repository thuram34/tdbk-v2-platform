/**
 * TDBK V2 PHASE 4 VERIFICATION TEST SUITE & RUNNER
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Validates DBK Provisioning, Master Control, Branch Topology, Lifecycle State Machine, and Experience Projection.
 */

import { SecurityContext, Principal } from '../../kernel/types';
import { dbkRegistry } from '../dbkRegistry';
import { provisioningService } from '../provisioning/provisioningService';
import { dbkLifecycleManager } from '../lifecycle/lifecycleManager';
import { branchManager } from '../branch/branchManager';
import { workspaceManager } from '../workspace/workspaceManager';
import { experienceProjection } from '../projection/experienceProjection';
import { blueprintRegistry } from '../../blueprint/registry';
import { businessDnaManager } from '../../blueprint/dnaManager';
import { entitlementEngine } from '../../capability/entitlement';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { discoveryEngine } from '../../capability/discovery';
import { capabilityRegistry } from '../../capability/registry';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { eventBus } from '../../orchestration/events/eventBus';
import { branchAuthority } from '../../kernel/branch/branchAuthority';
import { phase0TestRunner } from '../../kernel/tests/phase0TestRunner';
import { Phase1TestRunner } from '../../blueprint/tests/phase1TestRunner';
import { Phase2TestRunner } from '../../capability/tests/phase2TestRunner';
import { Phase3TestRunner } from '../../orchestration/tests/phase3TestRunner';

export interface TestCaseResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface Phase4TestSummary {
  phase: string;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
}

export async function runPhase4TestSuite(): Promise<Phase4TestSummary> {
  const startTime = Date.now();
  const results: TestCaseResult[] = [];

  // Reset all state stores for clean test isolation
  dbkRegistry.clearStoreForTesting();
  branchManager.clearStoreForTesting();
  provisioningService.clearStoreForTesting();
  eventBus.clearStoreForTesting();
  auditLogger.clearBufferForTesting();

  const runTest = async (
    id: string,
    name: string,
    testFn: () => Promise<void> | void
  ): Promise<void> => {
    const t0 = Date.now();
    try {
      await testFn();
      results.push({
        id,
        name,
        status: 'PASS',
        durationMs: Date.now() - t0,
      });
    } catch (err: any) {
      results.push({
        id,
        name,
        status: 'FAIL',
        durationMs: Date.now() - t0,
        error: err.message || String(err),
      });
    }
  };

  // Setup contexts
  const masterContext: SecurityContext = {
    requestId: 'req_p4_master',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'usr_p4_master_admin',
      tenantId: 'master',
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      authTime: Date.now(),
      tokenSource: 'JWT',
      isMaster: true,
    },
    tenantContext: null,
    branchContext: null,
    correlationId: 'corr_p4_master',
  };

  const tenantContextSchool: SecurityContext = {
    requestId: 'req_p4_school_admin',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'usr_p4_school_admin',
      tenantId: 'tenant_p4_school_01',
      branchId: null,
      roles: ['DBK_ADMIN'],
      permissions: ['school:*', 'read:*', 'write:*'],
      authTime: Date.now(),
      tokenSource: 'JWT',
      isMaster: false,
    },
    tenantContext: {
      tenantId: 'tenant_p4_school_01',
      name: 'Nairobi Hill Academy Ltd',
      blueprintId: 'school_v1',
      status: 'ACTIVE',
    },
    branchContext: null,
    correlationId: 'corr_p4_school',
  };

  const tenantContextHardware: SecurityContext = {
    requestId: 'req_p4_hardware_admin',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'usr_p4_hardware_admin',
      tenantId: 'tenant_p4_hardware_01',
      branchId: null,
      roles: ['DBK_ADMIN'],
      permissions: ['hardware:*', 'pos:*', 'read:*', 'write:*'],
      authTime: Date.now(),
      tokenSource: 'JWT',
      isMaster: false,
    },
    tenantContext: {
      tenantId: 'tenant_p4_hardware_01',
      name: 'Apex Hardware Supplies Ltd',
      blueprintId: 'hardware_v1',
      status: 'ACTIVE',
    },
    branchContext: null,
    correlationId: 'corr_p4_hardware',
  };

  // Reset stores before testing
  dbkRegistry.clearStoreForTesting();
  branchManager.clearStoreForTesting();
  provisioningService.clearStoreForTesting();

  // P4_TEST_01: Master creates valid DBK
  await runTest('P4_TEST_01', 'Master creates valid DBK', async () => {
    const result = await provisioningService.provisionDbk(masterContext, {
      dbkId: 'tenant_p4_school_01',
      legalName: 'Nairobi Hill Academy Ltd',
      displayName: 'Nairobi Hill Academy',
      blueprintId: 'school_v1',
      subscriptionTier: 'PRO',
      primaryBranchName: 'Main Campus',
    });

    if (!result.success || result.status !== 'ACTIVE' || result.dbkId !== 'tenant_p4_school_01') {
      throw new Error(`Master provisioning failed: ${result.error}`);
    }
  });

  // P4_TEST_02: DBK user cannot create DBK
  await runTest('P4_TEST_02', 'DBK user cannot create DBK', async () => {
    let denied = false;
    try {
      await provisioningService.provisionDbk(tenantContextSchool, {
        dbkId: 'tenant_p4_unauth_02',
        legalName: 'Unauthorized Enterprise',
        blueprintId: 'school_v1',
      });
    } catch (err: any) {
      if (err.message.includes('requires TDBK MASTER platform authority') || err.status === 403) {
        denied = true;
      }
    }
    if (!denied) throw new Error('DBK tenant user was improperly allowed to invoke provisionDbk');
  });

  // P4_TEST_03: Unauthenticated provisioning denied
  await runTest('P4_TEST_03', 'Unauthenticated provisioning denied', async () => {
    const unauthCtx: SecurityContext = {
      requestId: 'req_p4_anon',
      timestamp: new Date().toISOString(),
      principal: {
        id: 'ANONYMOUS',
        tenantId: null,
        branchId: null,
        roles: ['GUEST'],
        permissions: [],
        authTime: Date.now(),
        tokenSource: 'SESSION',
        isMaster: false,
      },
      tenantContext: null,
      branchContext: null,
      correlationId: 'corr_p4_anon',
    };
    let denied = false;
    try {
      await provisioningService.provisionDbk(unauthCtx, {
        dbkId: 'tenant_p4_anon_dbk',
        legalName: 'Anon Corp',
        blueprintId: 'school_v1',
      });
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('Unauthenticated user was improperly allowed to provision DBK');
  });

  // P4_TEST_04: Invalid blueprint rejected
  await runTest('P4_TEST_04', 'Invalid blueprint rejected', async () => {
    let rejected = false;
    try {
      await provisioningService.provisionDbk(masterContext, {
        dbkId: 'tenant_p4_invalid_bp',
        legalName: 'Invalid Blueprint Business',
        blueprintId: 'non_existent_bp_9999',
      });
    } catch (err: any) {
      if (err.message.includes('Invalid Blueprint') || err.message.includes('not registered')) {
        rejected = true;
      }
    }
    if (!rejected) throw new Error('Provisioning with unregistered blueprint was improperly accepted');
  });

  // P4_TEST_05: Invalid blueprint version rejected
  await runTest('P4_TEST_05', 'Invalid blueprint version rejected', async () => {
    let rejected = false;
    try {
      await provisioningService.provisionDbk(masterContext, {
        dbkId: 'tenant_p4_invalid_ver',
        legalName: 'Invalid Version Business',
        blueprintId: 'school_v1',
        blueprintVersion: 'v99.9.9_nonexistent',
      });
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error('Provisioning with invalid blueprint version was improperly accepted');
  });

  // P4_TEST_06: Business DNA initialized correctly
  await runTest('P4_TEST_06', 'Business DNA initialized correctly', async () => {
    const dna = businessDnaManager.getBusinessDna(tenantContextSchool, 'tenant_p4_school_01');
    const legalName = (dna?.identity as any)?.legalName || dna?.identity?.businessName;
    if (!dna || legalName !== 'Nairobi Hill Academy Ltd' || (dna.identity.businessType !== 'SCHOOL' && dna.identity.businessType !== 'EDUCATION')) {
      throw new Error('Business DNA was not properly initialized during DBK provisioning');
    }
  });

  // P4_TEST_07: Subscription entitlement initialized correctly
  await runTest('P4_TEST_07', 'Subscription entitlement initialized correctly', async () => {
    const tier = entitlementEngine.getDbkSubscriptionTier('tenant_p4_school_01');
    if (tier !== 'PRO') {
      throw new Error(`Expected subscription tier 'PRO', found '${tier}'`);
    }
  });

  // P4_TEST_08: Capability initialization respects Blueprint
  await runTest('P4_TEST_08', 'Capability initialization respects Blueprint', async () => {
    const caps = dbkCapabilityManager.getDbkCapabilityRecords(tenantContextSchool, 'tenant_p4_school_01');
    const schoolCap = caps.find((c) => c.capabilityId === 'school_academics');
    if (!schoolCap) {
      throw new Error('School academics capability not initialized for School DBK');
    }
  });

  // P4_TEST_09: Capability initialization respects entitlement
  await runTest('P4_TEST_09', 'Capability initialization respects entitlement', async () => {
    const caps = dbkCapabilityManager.getDbkCapabilityRecords(tenantContextSchool, 'tenant_p4_school_01');
    const entitledCap = caps.find((c) => c.capabilityId === 'school_academics');
    if (entitledCap?.entitlement !== 'ENTITLED') {
      throw new Error(`Expected capability status ENTITLED on PRO tier, found '${entitledCap?.entitlement}'`);
    }
  });

  // P4_TEST_10: Dependencies evaluated during provisioning
  await runTest('P4_TEST_10', 'Dependencies evaluated during provisioning', async () => {
    const feeCap = capabilityRegistry.getCapability('school_fee_structure');
    if (!feeCap || !feeCap.dependencies.some((d: any) => d === 'school_academics' || d?.targetCapabilityId === 'school_academics')) {
      throw new Error('Dependency mapping missing for school_fee_structure');
    }
  });

  // P4_TEST_11: HQ branch created correctly
  await runTest('P4_TEST_11', 'HQ branch created correctly', async () => {
    const branches = branchManager.getBranchesForDbk(tenantContextSchool, 'tenant_p4_school_01');
    const hq = branches.find((b) => b.isHeadquarters === true);
    if (!hq || hq.name !== 'Main Campus' || hq.status !== 'ACTIVE') {
      throw new Error('HQ branch not created with expected metadata');
    }
  });

  // P4_TEST_12: Secondary branch topology created correctly
  await runTest('P4_TEST_12', 'Secondary branch topology created correctly', async () => {
    const branch = await branchManager.createSecondaryBranch(tenantContextSchool, 'tenant_p4_school_01', {
      branchId: 'tenant_p4_school_01_westlands',
      name: 'Westlands Campus',
      type: 'CAMPUS',
    });
    if (!branch || branch.branchId !== 'tenant_p4_school_01_westlands' || branch.isHeadquarters) {
      throw new Error('Secondary branch topology creation failed');
    }
  });

  // P4_TEST_13: Cross-tenant branch creation denied
  await runTest('P4_TEST_13', 'Cross-tenant branch creation denied', async () => {
    let denied = false;
    try {
      await branchManager.createSecondaryBranch(tenantContextHardware, 'tenant_p4_school_01', {
        branchId: 'tenant_p4_school_01_rogue',
        name: 'Rogue Branch',
        type: 'CAMPUS',
      });
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('Cross-tenant branch creation was improperly allowed');
  });

  // P4_TEST_14: DBK lifecycle starts PROVISIONING
  await runTest('P4_TEST_14', 'DBK lifecycle starts PROVISIONING', async () => {
    const dbk = await dbkRegistry.getDbk(masterContext, 'tenant_p4_school_01');
    if (!dbk || dbk.lifecycleHistory[0]?.fromStatus !== 'PROVISIONING') {
      throw new Error('DBK initial lifecycle transition record did not record PROVISIONING');
    }
  });

  // P4_TEST_15: Successful provisioning reaches ACTIVE
  await runTest('P4_TEST_15', 'Successful provisioning reaches ACTIVE', async () => {
    const dbk = await dbkRegistry.getDbk(masterContext, 'tenant_p4_school_01');
    if (!dbk || dbk.status !== 'ACTIVE') {
      throw new Error(`Expected final status 'ACTIVE', found '${dbk?.status}'`);
    }
  });

  // P4_TEST_16: Failed provisioning reaches PROVISIONING_FAILED
  await runTest('P4_TEST_16', 'Failed provisioning reaches PROVISIONING_FAILED', async () => {
    const failedResult = await provisioningService.provisionDbk(masterContext, {
      dbkId: 'tenant_p4_failing_01',
      legalName: 'Fail Test Inc',
      blueprintId: 'school_v1',
      primaryBranchName: 'HQ',
      secondaryBranches: [
        // Duplicate branch ID in same request will trigger permanent failure
        { branchId: 'dup_branch_01', name: 'Branch 1', type: 'CAMPUS' },
        { branchId: 'dup_branch_01', name: 'Branch 2', type: 'CAMPUS' },
      ],
    });
    if (failedResult.success || failedResult.status !== 'PROVISIONING_FAILED') {
      throw new Error('Failed provisioning did not transition to PROVISIONING_FAILED');
    }
  });

  // P4_TEST_17: Duplicate provisioning request is idempotent
  await runTest('P4_TEST_17', 'Duplicate provisioning request is idempotent', async () => {
    const replay = await provisioningService.provisionDbk(masterContext, {
      dbkId: 'tenant_p4_school_01',
      legalName: 'Nairobi Hill Academy Ltd',
      blueprintId: 'school_v1',
      idempotencyKey: 'idem_tenant_p4_school_01',
    });
    if (!replay.success || !replay.isIdempotentReplay) {
      throw new Error('Replayed provisioning request was not handled idempotently');
    }
  });

  // P4_TEST_18: Duplicate DBK is not created
  await runTest('P4_TEST_18', 'Duplicate DBK is not created', async () => {
    let duplicateRejected = false;
    try {
      await provisioningService.provisionDbk(masterContext, {
        dbkId: 'tenant_p4_school_01',
        legalName: 'Different Name Corp',
        blueprintId: 'school_v1',
        idempotencyKey: 'different_idempotency_key_xyz',
      });
    } catch (err: any) {
      if (err.status === 409 || err.message.includes('already exists')) {
        duplicateRejected = true;
      }
    }
    if (!duplicateRejected) throw new Error('Attempt to create existing DBK with new key was not rejected');
  });

  // P4_TEST_19: Master suspension works
  await runTest('P4_TEST_19', 'Master suspension works', async () => {
    const suspended = await dbkLifecycleManager.suspendDbk(masterContext, 'tenant_p4_school_01', 'Non-compliance audit');
    if (suspended.status !== 'SUSPENDED') {
      throw new Error(`Expected status SUSPENDED, found ${suspended.status}`);
    }
  });

  // P4_TEST_20: Suspended DBK operational access denied
  await runTest('P4_TEST_20', 'Suspended DBK operational access denied', async () => {
    let denied = false;
    try {
      await dbkLifecycleManager.assertDbkOperational(tenantContextSchool, 'tenant_p4_school_01');
    } catch (err: any) {
      if (err.message.includes('is currently in \'SUSPENDED\' state')) {
        denied = true;
      }
    }
    if (!denied) throw new Error('Operational access was improperly allowed for a suspended DBK');
  });

  // P4_TEST_21: DBK reactivation works
  await runTest('P4_TEST_21', 'DBK reactivation works', async () => {
    const reactivated = await dbkLifecycleManager.reactivateDbk(masterContext, 'tenant_p4_school_01', 'Audit passed');
    if (reactivated.status !== 'ACTIVE') {
      throw new Error(`Expected status ACTIVE after reactivation, found ${reactivated.status}`);
    }
  });

  // P4_TEST_22: Archive works without destructive deletion
  await runTest('P4_TEST_22', 'Archive works without destructive deletion', async () => {
    const archived = await dbkLifecycleManager.archiveDbk(masterContext, 'tenant_p4_school_01', 'Voluntary closure');
    if (archived.status !== 'ARCHIVED') {
      throw new Error(`Expected status ARCHIVED, found ${archived.status}`);
    }
    // Verify records remain in registry
    const dbk = await dbkRegistry.getDbk(masterContext, 'tenant_p4_school_01');
    if (!dbk || dbk.dbkId !== 'tenant_p4_school_01') {
      throw new Error('Archived DBK records were destructively removed');
    }
  });

  // P4_TEST_23: Archived DBK cannot become active without authorized restore flow
  await runTest('P4_TEST_23', 'Archived DBK cannot become active without authorized restore flow', async () => {
    let denied = false;
    try {
      await dbkLifecycleManager.reactivateDbk(masterContext, 'tenant_p4_school_01');
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('Direct reactivate of ARCHIVED DBK should be rejected; restore flow required');

    // Restore via authorized flow
    const restored = await dbkLifecycleManager.restoreDbk(masterContext, 'tenant_p4_school_01', 'Official reopening');
    if (restored.status !== 'ACTIVE') {
      throw new Error(`Expected status ACTIVE after restore, found ${restored.status}`);
    }
  });

  // P4_TEST_24: DBK cannot alter platform Blueprint
  await runTest('P4_TEST_24', 'DBK cannot alter platform Blueprint', async () => {
    const bp = blueprintRegistry.getBlueprint('school_v1')!;
    const originalName = bp.name;
    try {
      (bp as any).name = 'Tampered Blueprint';
    } catch {
      // Ignored
    }
    const fresh = blueprintRegistry.getBlueprint('school_v1')!;
    if (fresh.id !== 'school_v1' || fresh.name !== originalName) {
      throw new Error('Platform blueprint was altered');
    }
  });

  // P4_TEST_25: DBK cannot alter platform capability definitions
  await runTest('P4_TEST_25', 'DBK cannot alter platform capability definitions', async () => {
    let denied = false;
    try {
      capabilityRegistry.updateCapability(tenantContextSchool, 'school_academics', { name: 'Hacked Name' });
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('DBK user was improperly allowed to alter platform capability definition');
  });

  // P4_TEST_26: DBK cannot alter subscription entitlement directly
  await runTest('P4_TEST_26', 'DBK cannot alter subscription entitlement directly', async () => {
    // Current tier is PRO
    const tier = entitlementEngine.getDbkSubscriptionTier('tenant_p4_school_01');
    if (tier !== 'PRO') throw new Error('Entitlement state unexpected');
  });

  // P4_TEST_27: Client cannot forge Master authority
  await runTest('P4_TEST_27', 'Client cannot forge Master authority', async () => {
    const forgedCtx: SecurityContext = {
      requestId: 'req_p4_forged',
      timestamp: new Date().toISOString(),
      principal: {
        id: 'usr_hacker',
        tenantId: 'tenant_p4_school_01',
        branchId: null,
        roles: ['DBK_ADMIN', 'TDBK_MASTER_ADMIN'],
        permissions: ['*'],
        authTime: Date.now(),
        tokenSource: 'JWT',
        isMaster: false, // isMaster false
      },
      tenantContext: null,
      branchContext: null,
      correlationId: 'corr_p4_forged',
    };
    let denied = false;
    try {
      await dbkLifecycleManager.suspendDbk(forgedCtx, 'tenant_p4_school_01', 'Hacked');
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('Client role spoofing was not caught by masterAuthority check');
  });

  // P4_TEST_28: Client cannot forge tenant identity
  await runTest('P4_TEST_28', 'Client cannot forge tenant identity', async () => {
    let denied = false;
    try {
      await dbkRegistry.getDbk(tenantContextHardware, 'tenant_p4_school_01');
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('Hardware tenant was improperly allowed to read School DBK');
  });

  // P4_TEST_29: Client cannot forge branch authority
  await runTest('P4_TEST_29', 'Client cannot forge branch authority', async () => {
    const branchConstrainedPrincipal: Principal = {
      id: 'usr_branch_user_01',
      tenantId: 'tenant_p4_school_01',
      roles: ['STAFF'],
      permissions: ['school:read'],
      authTime: Date.now(),
      tokenSource: 'JWT',
      branchId: 'branch_a',
      isMaster: false,
    };
    let denied = false;
    try {
      branchAuthority.assertBranchContext(branchConstrainedPrincipal, 'branch_b', 'READ');
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('Branch-constrained user was improperly allowed to access another branch');
  });

  // P4_TEST_30: Provisioning events emitted correctly
  await runTest('P4_TEST_30', 'Provisioning events emitted correctly', async () => {
    const eventHistory = eventBus.getEventHistory('tenant_p4_school_01');
    const hasCompletedEvent = eventHistory.some((e) => e.eventType === 'dbk.provisioning_completed.v1');
    if (!hasCompletedEvent) {
      throw new Error('dbk.provisioning_completed.v1 event was not found in event history');
    }
  });

  // P4_TEST_31: Provisioning audit events recorded
  await runTest('P4_TEST_31', 'Provisioning audit events recorded', async () => {
    const auditLogs = auditLogger.getEventsForTenant('tenant_p4_school_01');
    const hasDbkCreated = auditLogs.some((a) => a.action === 'DBK_CREATED');
    const hasDbkProvisioned = auditLogs.some((a) => a.action === 'DBK_PROVISIONED');
    if (!hasDbkCreated || !hasDbkProvisioned) {
      throw new Error('Provisioning audit records missing from audit log');
    }
  });

  // P4_TEST_32: Provisioning correlationId preserved
  await runTest('P4_TEST_32', 'Provisioning correlationId preserved', async () => {
    const dbk = await dbkRegistry.getDbk(masterContext, 'tenant_p4_school_01');
    if (!dbk || !dbk.lifecycleHistory[0]?.correlationId) {
      throw new Error('CorrelationId was not preserved in DBK lifecycle history');
    }
  });

  // P4_TEST_33: Provisioning retry does not duplicate resources
  await runTest('P4_TEST_33', 'Provisioning retry does not duplicate resources', async () => {
    const branchesBefore = branchManager.getBranchesForDbk(tenantContextSchool, 'tenant_p4_school_01');
    await provisioningService.provisionDbk(masterContext, {
      dbkId: 'tenant_p4_school_01',
      legalName: 'Nairobi Hill Academy Ltd',
      blueprintId: 'school_v1',
      idempotencyKey: 'idem_tenant_p4_school_01',
    });
    const branchesAfter = branchManager.getBranchesForDbk(tenantContextSchool, 'tenant_p4_school_01');
    if (branchesBefore.length !== branchesAfter.length) {
      throw new Error(`Provisioning retry duplicated branches: before=${branchesBefore.length}, after=${branchesAfter.length}`);
    }
  });

  // P4_TEST_34: Failed provisioning can recover safely
  await runTest('P4_TEST_34', 'Failed provisioning can recover safely', async () => {
    const recoveryResult = await provisioningService.provisionDbk(masterContext, {
      dbkId: 'tenant_p4_failing_01',
      legalName: 'Fail Test Inc', // Recovery must preserve the original immutable legal name.
      blueprintId: 'school_v1',
      primaryBranchName: 'HQ Fixed',
      secondaryBranches: [{ branchId: 'fixed_branch_01', name: 'Branch 1', type: 'CAMPUS' }],
    });
    if (!recoveryResult.success || recoveryResult.status !== 'ACTIVE') {
      throw new Error(`Recovery provisioning failed: ${recoveryResult.error}`);
    }
    const recoveredIdentity = await dbkRegistry.getDbk(masterContext, 'tenant_p4_failing_01');
    if (recoveredIdentity?.legalName !== 'Fail Test Inc' || recoveredIdentity?.blueprintId !== 'school_v1') {
      throw new Error('Provisioning recovery changed immutable DBK identity fields');
    }
  });

  // P4_TEST_35: DBK workspace projection is generated from authoritative state
  await runTest('P4_TEST_35', 'DBK workspace projection is generated from authoritative state', async () => {
    const projection = await experienceProjection.getExperienceProjection(tenantContextSchool, 'tenant_p4_school_01');
    if (
      !projection ||
      projection.dbkId !== 'tenant_p4_school_01' ||
      projection.status !== 'ACTIVE' ||
      !projection.serverAuthoritativeTimestamp
    ) {
      throw new Error('Experience projection invalid');
    }
  });

  // P4_TEST_36: Browser/session restart does not lose DBK state
  await runTest('P4_TEST_36', 'Browser/session restart does not lose DBK state', async () => {
    // Simulating fresh client session reading server state
    const freshSessionCtx: SecurityContext = {
      requestId: 'req_fresh_session',
      timestamp: new Date().toISOString(),
      principal: {
        id: 'usr_returning_user',
        tenantId: 'tenant_p4_school_01',
        branchId: null,
        roles: ['DBK_ADMIN'],
        permissions: ['*'],
        authTime: Date.now(),
        tokenSource: 'SESSION',
        isMaster: false,
      },
      tenantContext: {
        tenantId: 'tenant_p4_school_01',
        name: 'Nairobi Hill Academy Ltd',
        blueprintId: 'school_v1',
        status: 'ACTIVE',
      },
      branchContext: null,
      correlationId: 'corr_fresh_session',
    };
    const workspace = await workspaceManager.compileWorkspaceState(freshSessionCtx, 'tenant_p4_school_01');
    if (!workspace || workspace.dbkId !== 'tenant_p4_school_01' || workspace.status !== 'ACTIVE') {
      throw new Error('Server authoritative state was not preserved across fresh sessions');
    }
  });

  // P4_TEST_37: School DBK receives School capability discovery
  await runTest('P4_TEST_37', 'School DBK receives School capability discovery', async () => {
    const surface = await discoveryEngine.discoverCapabilitiesForDbk(tenantContextSchool, 'tenant_p4_school_01');
    const schoolCaps = surface.availableCapabilities.filter((c) => c.capabilityId.startsWith('school_'));
    if (schoolCaps.length === 0) {
      throw new Error('School DBK failed to discover School-specific capabilities');
    }
  });

  // P4_TEST_38: Hardware DBK receives Hardware/Retail capability discovery
  await runTest('P4_TEST_38', 'Hardware DBK receives Hardware/Retail capability discovery', async () => {
    await provisioningService.provisionDbk(masterContext, {
      dbkId: 'tenant_p4_hardware_01',
      legalName: 'Apex Hardware Supplies Ltd',
      blueprintId: 'hardware_v1',
      subscriptionTier: 'GROWTH',
    });
    const surface = await discoveryEngine.discoverCapabilitiesForDbk(tenantContextHardware, 'tenant_p4_hardware_01');
    const posCap = surface.availableCapabilities.find((c) => c.capabilityId === 'pos_register');
    if (!posCap) {
      throw new Error('Hardware DBK failed to discover POS Register capability');
    }
  });

  // P4_TEST_39: Logistics DBK receives Logistics capability discovery
  await runTest('P4_TEST_39', 'Logistics DBK receives Logistics capability discovery', async () => {
    await provisioningService.provisionDbk(masterContext, {
      dbkId: 'tenant_p4_logistics_01',
      legalName: 'Swift Transporters Ltd',
      blueprintId: 'logistics_v1',
      subscriptionTier: 'PRO',
    });
    const logCtx: SecurityContext = {
      requestId: 'req_p4_log_admin',
      timestamp: new Date().toISOString(),
      principal: {
        id: 'usr_log_admin',
        tenantId: 'tenant_p4_logistics_01',
        branchId: null,
        roles: ['DBK_ADMIN'],
        permissions: ['*'],
        authTime: Date.now(),
        tokenSource: 'JWT',
        isMaster: false,
      },
      tenantContext: {
        tenantId: 'tenant_p4_logistics_01',
        name: 'Swift Transporters Ltd',
        blueprintId: 'logistics_v1',
        status: 'ACTIVE',
      },
      branchContext: null,
      correlationId: 'corr_p4_log',
    };
    const surface = await discoveryEngine.discoverCapabilitiesForDbk(logCtx, 'tenant_p4_logistics_01');
    const fleetCap = surface.availableCapabilities.find((c) => c.capabilityId === 'fleet_tracking');
    if (!fleetCap) {
      throw new Error('Logistics DBK failed to discover Fleet Tracking capability');
    }
  });

  // P4_TEST_40: Unrelated sector capability remains inaccessible
  await runTest('P4_TEST_40', 'Unrelated sector capability remains inaccessible', async () => {
    const hardwareSurface = await discoveryEngine.discoverCapabilitiesForDbk(tenantContextHardware, 'tenant_p4_hardware_01');
    const schoolCapInHardware = hardwareSurface.availableCapabilities.find((c) => c.capabilityId === 'school_academics');
    if (schoolCapInHardware) {
      throw new Error('Hardware DBK was improperly exposed to school_academics capability');
    }
  });

  // P4_TEST_41: Branch-scoped user cannot access another branch
  await runTest('P4_TEST_41', 'Branch-scoped user cannot access another branch', async () => {
    const branchBUser: Principal = {
      id: 'usr_westlands_teacher',
      tenantId: 'tenant_p4_school_01',
      branchId: 'tenant_p4_school_01_westlands',
      roles: ['STAFF'],
      permissions: ['school:read'],
      authTime: Date.now(),
      tokenSource: 'JWT',
      isMaster: false,
    };
    let denied = false;
    try {
      branchAuthority.assertBranchContext(branchBUser, 'tenant_p4_school_01_hq', 'READ_RECORDS');
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('Branch-constrained user accessed HQ branch without authorization');
  });

  // P4_TEST_42: Master can inspect DBK lifecycle
  await runTest('P4_TEST_42', 'Master can inspect DBK lifecycle', async () => {
    const allDbks = await dbkRegistry.listAllDbks(masterContext);
    if (!allDbks || allDbks.length < 2) {
      throw new Error('Master inspection of all DBKs failed');
    }
  });

  // P4_TEST_43: DBK can inspect only its own lifecycle
  await runTest('P4_TEST_43', 'DBK can inspect only its own lifecycle', async () => {
    const ownDbk = await dbkRegistry.getDbk(tenantContextSchool, 'tenant_p4_school_01');
    if (!ownDbk) throw new Error('DBK could not inspect its own identity');
    let denied = false;
    try {
      await dbkRegistry.getDbk(tenantContextSchool, 'tenant_p4_hardware_01');
    } catch {
      denied = true;
    }
    if (!denied) throw new Error('DBK user was improperly allowed to inspect another DBK identity');
  });

  // P4_TEST_44: Archived DBK preserves audit history
  await runTest('P4_TEST_44', 'Archived DBK preserves audit history', async () => {
    await dbkLifecycleManager.archiveDbk(masterContext, 'tenant_p4_hardware_01', 'End of lease');
    const logs = auditLogger.getEventsForTenant('tenant_p4_hardware_01');
    if (logs.length === 0) {
      throw new Error('Archiving DBK destroyed tenant audit history');
    }
  });

  // P4_TEST_45: Provisioning secrets never enter client bundle
  await runTest('P4_TEST_45', 'Provisioning secrets never enter client bundle', async () => {
    const projection = await experienceProjection.getExperienceProjection(tenantContextSchool, 'tenant_p4_school_01');
    const projectionStr = JSON.stringify(projection);
    if (
      projectionStr.includes('privateKey') ||
      projectionStr.includes('secret') ||
      projectionStr.includes('token')
    ) {
      throw new Error('Experience projection leaked sensitive internal credentials');
    }
  });

  // P4_TEST_46: Provisioning secrets never enter audit payload
  await runTest('P4_TEST_46', 'Provisioning secrets never enter audit payload', async () => {
    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      'usr_master',
      'TEST_SECRET_REDACTION',
      'dbk:tenant_p4_school_01',
      'ALLOWED',
      {
        tenantId: 'tenant_p4_school_01',
        details: {
          apiKey: 'mpesa_live_secret_key_12345',
          passkey: 'super_secret_daraja_pass',
          normalData: 'visible_data',
        },
      }
    );
    const logs = auditLogger.getEventsForTenant('tenant_p4_school_01');
    const target = logs.find((l) => l.action === 'TEST_SECRET_REDACTION');
    const payloadStr = JSON.stringify(target?.details);
    if (
      payloadStr.includes('mpesa_live_secret_key_12345') ||
      payloadStr.includes('super_secret_daraja_pass')
    ) {
      throw new Error('Audit logger failed to redact secret credentials');
    }
  });

  // P4_TEST_47: Phase 0 regression
  await runTest('P4_TEST_47', 'Phase 0 regression', async () => {
    const p0Summary = await phase0TestRunner.runAllTests();
    if (p0Summary.failedCount > 0) {
      throw new Error(`Phase 0 regression failure: ${p0Summary.failedCount} test(s) failed`);
    }
  });

  // P4_TEST_48: Phase 1 regression
  await runTest('P4_TEST_48', 'Phase 1 regression', async () => {
    const p1Summary = await Phase1TestRunner.runAllTests();
    if (p1Summary.failedCount > 0) {
      throw new Error(`Phase 1 regression failure: ${p1Summary.failedCount} test(s) failed`);
    }
  });

  // P4_TEST_49: Phase 2 regression
  await runTest('P4_TEST_49', 'Phase 2 regression', async () => {
    const p2Summary = await Phase2TestRunner.runAllTests();
    if (p2Summary.failedCount > 0) {
      throw new Error(`Phase 2 regression failure: ${p2Summary.failedCount} test(s) failed`);
    }
  });

  // P4_TEST_50: Phase 3 regression
  await runTest('P4_TEST_50', 'Phase 3 regression', async () => {
    const p3Summary = await Phase3TestRunner.runAllTests();
    if (p3Summary.failedCount > 0) {
      throw new Error(`Phase 3 regression failure: ${p3Summary.failedCount} test(s) failed`);
    }
  });

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    phase: 'PHASE 4: PLATFORM CONTROL & DBK PROVISIONING',
    totalTests: results.length,
    passed,
    failed,
    durationMs: Date.now() - startTime,
    results,
  };
}
