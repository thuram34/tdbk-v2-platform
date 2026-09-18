/**
 * TDBK V2 PHASE 2 CAPABILITY & ENTITLEMENT ENGINE TEST SUITE RUNNER
 * Architectural Layer: LEVEL 4 — CAPABILITIES & MODULES
 * Executes 28 mandatory test cases covering Capability Registry, Discovery Engine, Entitlement Engine,
 * Dependency Engine, Activation Evaluator, State Manager, Security/Tenant Boundaries, and Regression.
 */

import { securityContextFactory } from '../../kernel/context/contextFactory';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { TokenVerifier } from '../../kernel/identity/tokenVerifier';
import { businessDnaManager } from '../../blueprint/dnaManager';
import { capabilityRegistry } from '../registry';
import { dependencyEngine } from '../dependencyEngine';
import { entitlementEngine } from '../entitlement';
import { dbkCapabilityManager } from '../dbkCapabilityManager';
import { activationEvaluator } from '../evaluator';
import { discoveryEngine } from '../discovery';
import { CapabilityDefinition } from '../types';
import { phase0TestRunner } from '../../kernel/tests/phase0TestRunner';
import { Phase1TestRunner } from '../../blueprint/tests/phase1TestRunner';

export interface Phase2TestResult {
  id: string;
  name: string;
  category: string;
  expected: string;
  actual: string;
  passed: boolean;
  errorDetails?: string;
}

export class Phase2TestRunner {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    results: Phase2TestResult[];
  }> {
    const results: Phase2TestResult[] = [];

    // Helper to log test result
    const addResult = (
      id: string,
      name: string,
      category: string,
      expected: string,
      actual: string,
      passed: boolean,
      errorDetails?: string
    ) => {
      results.push({ id, name, category, expected, actual, passed, errorDetails });
    };

    // Helper context setup
    const masterToken = TokenVerifier.mintTestToken({
      uid: 'usr_master_admin',
      tenantId: null,
      isMaster: true,
      roles: ['SYSTEM_ADMIN'],
      permissions: ['master:platform', '*'],
    });
    const masterCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${masterToken}`,
    });

    // Setup Test DBKs in Phase 1 DNA manager
    const schoolToken = TokenVerifier.mintTestToken({
      uid: 'usr_school_admin',
      tenantId: 'tenant_school_01',
      isMaster: false,
      roles: ['DBK_ADMIN', 'SCHOOL_PRINCIPAL'],
      permissions: ['tenant:admin', 'manage:students'],
    });
    const schoolCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${schoolToken}`,
      targetTenantId: 'tenant_school_01',
    });

    const hardwareToken = TokenVerifier.mintTestToken({
      uid: 'usr_hardware_admin',
      tenantId: 'tenant_hardware_01',
      isMaster: false,
      roles: ['DBK_ADMIN', 'STORE_OWNER'],
      permissions: ['tenant:admin', 'manage:inventory'],
    });
    const hardwareCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${hardwareToken}`,
      targetTenantId: 'tenant_hardware_01',
    });

    const logisticsToken = TokenVerifier.mintTestToken({
      uid: 'usr_logistics_admin',
      tenantId: 'tenant_logistics_01',
      isMaster: false,
      roles: ['DBK_ADMIN', 'LOGISTICS_DIRECTOR'],
      permissions: ['tenant:admin', 'manage:dispatch'],
    });
    const logisticsCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${logisticsToken}`,
      targetTenantId: 'tenant_logistics_01',
    });

    const otherTenantToken = TokenVerifier.mintTestToken({
      uid: 'usr_other_admin',
      tenantId: 'tenant_other_99',
      isMaster: false,
      roles: ['DBK_ADMIN'],
      permissions: ['tenant:admin'],
    });
    const otherTenantCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${otherTenantToken}`,
      targetTenantId: 'tenant_other_99',
    });

    // Initialize DNA bindings in Phase 1
    businessDnaManager.clearStoreForTesting();
    capabilityRegistry.resetToDefault();
    dbkCapabilityManager.clearStoreForTesting();
    entitlementEngine.clearStoreForTesting();

    businessDnaManager.bindBlueprintToDbk(schoolCtx, 'tenant_school_01', 'St. Andrew Academy', 'school_v1');
    businessDnaManager.bindBlueprintToDbk(hardwareCtx, 'tenant_hardware_01', 'BuildPro Hardware Nairobi', 'hardware_v1');
    businessDnaManager.bindBlueprintToDbk(logisticsCtx, 'tenant_logistics_01', 'Swift Express Cargo', 'logistics_v1');

    // -----------------------------------------------------------------
    // P2_TEST_01: Register valid capability -> PASS
    // -----------------------------------------------------------------
    try {
      const newCap: CapabilityDefinition = {
        capabilityId: 'test_cap_01',
        name: 'Test Custom Capability',
        description: 'Test capability description',
        category: 'CORE',
        version: '1.0.0',
        supportedBlueprints: ['ALL'],
        dependencies: [],
        requiredPermissions: ['read:test'],
        requiredRoles: ['DBK_ADMIN'],
        entitlementRequirements: { minimumTier: 'FOUNDATION' },
        configurationSchema: { requiresConfiguration: false },
        implementationStatus: 'DEFINED',
        lifecycleStatus: 'AVAILABLE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const reg = capabilityRegistry.registerCapability(masterCtx, newCap);
      const isReg = reg.capabilityId === 'test_cap_01' && reg.version === '1.0.0';
      addResult(
        'P2_TEST_01',
        'Register valid capability',
        'REGISTRY',
        'Registered capability object',
        isReg ? 'SUCCESS' : 'FAILED',
        isReg
      );
    } catch (err: any) {
      addResult('P2_TEST_01', 'Register valid capability', 'REGISTRY', 'Registered capability object', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_02: Duplicate capability rejection -> PASS
    // -----------------------------------------------------------------
    try {
      const dupCap: CapabilityDefinition = {
        capabilityId: 'test_cap_01',
        name: 'Duplicate Capability',
        description: 'Duplicate',
        category: 'CORE',
        version: '1.0.0',
        supportedBlueprints: ['ALL'],
        dependencies: [],
        requiredPermissions: [],
        requiredRoles: [],
        entitlementRequirements: { minimumTier: 'FOUNDATION' },
        configurationSchema: { requiresConfiguration: false },
        implementationStatus: 'DEFINED',
        lifecycleStatus: 'AVAILABLE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      capabilityRegistry.registerCapability(masterCtx, dupCap);
      addResult('P2_TEST_02', 'Duplicate capability rejection', 'REGISTRY', 'VALIDATION_ERROR thrown', 'No error thrown', false);
    } catch (err: any) {
      const passed = err.message.includes('already registered') || err.status === 409;
      addResult(
        'P2_TEST_02',
        'Duplicate capability rejection',
        'REGISTRY',
        'Conflict exception 409 thrown',
        passed ? `Thrown: ${err.message}` : err.message,
        passed
      );
    }

    // -----------------------------------------------------------------
    // P2_TEST_03: Capability version registration -> PASS
    // -----------------------------------------------------------------
    try {
      const v2Cap: CapabilityDefinition = {
        capabilityId: 'test_cap_01',
        name: 'Test Custom Capability V2',
        description: 'Version 2.0.0',
        category: 'CORE',
        version: '2.0.0',
        supportedBlueprints: ['ALL'],
        dependencies: [],
        requiredPermissions: ['read:test'],
        requiredRoles: ['DBK_ADMIN'],
        entitlementRequirements: { minimumTier: 'FOUNDATION' },
        configurationSchema: { requiresConfiguration: false },
        implementationStatus: 'DEFINED',
        lifecycleStatus: 'AVAILABLE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const regV2 = capabilityRegistry.registerCapability(masterCtx, v2Cap);
      const capV1 = capabilityRegistry.getCapability('test_cap_01', '1.0.0');
      const capV2 = capabilityRegistry.getCapability('test_cap_01', '2.0.0');

      const passed = capV1?.version === '1.0.0' && capV2?.version === '2.0.0';
      addResult(
        'P2_TEST_03',
        'Capability version registration',
        'REGISTRY',
        'Both v1.0.0 and v2.0.0 independently accessible',
        passed ? 'Both versions registered' : 'Version conflict',
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_03', 'Capability version registration', 'REGISTRY', 'Independent versions', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_04: Blueprint-compatible capability discovery -> PASS
    // -----------------------------------------------------------------
    try {
      const surface = await discoveryEngine.discoverCapabilitiesForDbk(schoolCtx, 'tenant_school_01');
      const hasAcademics = surface.items.some((i) => i.capability.capabilityId === 'school_academics');
      addResult(
        'P2_TEST_04',
        'Blueprint-compatible capability discovery',
        'DISCOVERY',
        'school_academics present in School DBK surface',
        hasAcademics ? 'Found school_academics' : 'Missing school_academics',
        hasAcademics
      );
    } catch (err: any) {
      addResult('P2_TEST_04', 'Blueprint-compatible capability discovery', 'DISCOVERY', 'school_academics present', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_05: Blueprint-incompatible capability unavailable -> PASS
    // -----------------------------------------------------------------
    try {
      const surface = await discoveryEngine.discoverCapabilitiesForDbk(hardwareCtx, 'tenant_hardware_01');
      const hasAcademics = surface.items.some((i) => i.capability.capabilityId === 'school_academics');
      addResult(
        'P2_TEST_05',
        'Blueprint-incompatible capability unavailable',
        'DISCOVERY',
        'school_academics absent from Hardware DBK surface',
        !hasAcademics ? 'Correctly excluded' : 'Exposed incompatible capability',
        !hasAcademics
      );
    } catch (err: any) {
      addResult('P2_TEST_05', 'Blueprint-incompatible capability unavailable', 'DISCOVERY', 'Excluded', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_06: Discoverable capability is not automatically enabled -> PASS
    // -----------------------------------------------------------------
    try {
      const surface = await discoveryEngine.discoverCapabilitiesForDbk(schoolCtx, 'tenant_school_01');
      const anyEnabled = surface.items.some((i) => i.currentState === 'ENABLED' || i.currentState === 'CONFIGURED');
      addResult(
        'P2_TEST_06',
        'Discoverable capability is not automatically enabled',
        'DISCOVERY',
        'DISCOVERABLE != ENABLED enforced (no default enablement)',
        !anyEnabled ? 'Strict DISCOVERABLE state maintained' : 'Capability auto-enabled prematurely',
        !anyEnabled
      );
    } catch (err: any) {
      addResult('P2_TEST_06', 'Discoverable capability is not automatically enabled', 'DISCOVERY', 'No auto-enable', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_07: Entitled capability becomes activation-eligible -> PASS
    // -----------------------------------------------------------------
    try {
      entitlementEngine.setDbkSubscriptionTier('tenant_school_01', 'FOUNDATION');
      // Enable core_identity prerequisite
      dbkCapabilityManager.enableCapability(schoolCtx, 'tenant_school_01', 'core_identity', 'ENTITLED', false);

      const decision = await activationEvaluator.evaluateActivation(schoolCtx, 'tenant_school_01', 'school_academics');
      const passed = decision.allowed === true && decision.outcome === 'ALLOWED';
      addResult(
        'P2_TEST_07',
        'Entitled capability becomes activation-eligible',
        'EVALUATOR',
        'allowed = true, outcome = ALLOWED',
        `allowed = ${decision.allowed}, outcome = ${decision.outcome}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_07', 'Entitled capability becomes activation-eligible', 'EVALUATOR', 'ALLOWED', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_08: Unentitled capability cannot activate -> DENIED
    // -----------------------------------------------------------------
    try {
      entitlementEngine.setDbkSubscriptionTier('tenant_school_01', 'FOUNDATION');
      const decision = await activationEvaluator.evaluateActivation(schoolCtx, 'tenant_school_01', 'payroll_pro');
      const passed = decision.allowed === false && decision.outcome === 'UPGRADE_REQUIRED';
      addResult(
        'P2_TEST_08',
        'Unentitled capability cannot activate',
        'ENTITLEMENT',
        'allowed = false, outcome = UPGRADE_REQUIRED',
        `allowed = ${decision.allowed}, outcome = ${decision.outcome}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_08', 'Unentitled capability cannot activate', 'ENTITLEMENT', 'UPGRADE_REQUIRED', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_09: Missing dependency blocks activation -> DENIED
    // -----------------------------------------------------------------
    try {
      const decision = activationEvaluator.evaluateActivation(schoolCtx, 'tenant_school_01', 'school_fee_structure');
      const passed = decision.allowed === false && decision.outcome === 'DEPENDENCY_REQUIRED';
      addResult(
        'P2_TEST_09',
        'Missing dependency blocks activation',
        'DEPENDENCY',
        'allowed = false, outcome = DEPENDENCY_REQUIRED',
        `allowed = ${decision.allowed}, outcome = ${decision.outcome}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_09', 'Missing dependency blocks activation', 'DEPENDENCY', 'DEPENDENCY_REQUIRED', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_10: Valid dependency chain permits activation -> PASS
    // -----------------------------------------------------------------
    try {
      // Step 1: Enable prerequisites 'school_academics' & 'finance_ledger_core'
      dbkCapabilityManager.enableCapability(schoolCtx, 'tenant_school_01', 'school_academics', 'ENTITLED', false);
      dbkCapabilityManager.enableCapability(schoolCtx, 'tenant_school_01', 'finance_ledger_core', 'ENTITLED', false);

      // Step 2: Now evaluate dependent 'school_fee_structure'
      const decision = activationEvaluator.evaluateActivation(schoolCtx, 'tenant_school_01', 'school_fee_structure');
      const passed = decision.allowed === true && decision.outcome === 'ALLOWED';
      addResult(
        'P2_TEST_10',
        'Valid dependency chain permits activation',
        'DEPENDENCY',
        'allowed = true after enabling dependency',
        `allowed = ${decision.allowed}, outcome = ${decision.outcome}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_10', 'Valid dependency chain permits activation', 'DEPENDENCY', 'ALLOWED', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_11: Circular dependency rejected -> PASS
    // -----------------------------------------------------------------
    try {
      const capA: CapabilityDefinition = {
        capabilityId: 'circ_a',
        name: 'Circ A',
        description: 'Circular A',
        category: 'CORE',
        version: '1.0.0',
        supportedBlueprints: ['ALL'],
        dependencies: ['circ_b'],
        requiredPermissions: [],
        requiredRoles: [],
        entitlementRequirements: { minimumTier: 'FOUNDATION' },
        configurationSchema: { requiresConfiguration: false },
        implementationStatus: 'DEFINED',
        lifecycleStatus: 'AVAILABLE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const capB: CapabilityDefinition = {
        capabilityId: 'circ_b',
        name: 'Circ B',
        description: 'Circular B',
        category: 'CORE',
        version: '1.0.0',
        supportedBlueprints: ['ALL'],
        dependencies: ['circ_a'],
        requiredPermissions: [],
        requiredRoles: [],
        entitlementRequirements: { minimumTier: 'FOUNDATION' },
        configurationSchema: { requiresConfiguration: false },
        implementationStatus: 'DEFINED',
        lifecycleStatus: 'AVAILABLE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const circEval = dependencyEngine.detectCircularDependencies(capA, [capA, capB]);
      const passed = circEval.hasCircular === true;
      addResult(
        'P2_TEST_11',
        'Circular dependency rejected',
        'DEPENDENCY',
        'hasCircular = true',
        `hasCircular = ${circEval.hasCircular}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_11', 'Circular dependency rejected', 'DEPENDENCY', 'hasCircular = true', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_12: DBK cannot modify platform capability definition -> DENIED
    // -----------------------------------------------------------------
    try {
      capabilityRegistry.updateCapability(schoolCtx, 'school_academics', { name: 'Unauthorized Modify' });
      addResult('P2_TEST_12', 'DBK cannot modify platform capability definition', 'SECURITY', 'AUTHORIZATION_ERROR thrown', 'Mutation succeeded', false);
    } catch (err: any) {
      const passed = err.message.includes('Master Authority Required') || err.status === 403 || err.statusCode === 403;
      addResult(
        'P2_TEST_12',
        'DBK cannot modify platform capability definition',
        'SECURITY',
        'AUTHORIZATION_ERROR 403 thrown',
        passed ? `Blocked: ${err.message}` : err.message,
        passed
      );
    }

    // -----------------------------------------------------------------
    // P2_TEST_13: Cross-tenant capability state read -> DENIED
    // -----------------------------------------------------------------
    try {
      dbkCapabilityManager.getDbkCapabilityRecords(schoolCtx, 'tenant_hardware_01');
      addResult('P2_TEST_13', 'Cross-tenant capability state read', 'ISOLATION', 'TENANT_ISOLATION_ERROR thrown', 'Read succeeded', false);
    } catch (err: any) {
      const passed = err.message.includes('Tenant Isolation Violation') || err.message.includes('Cross-Tenant Access Violation') || err.code === 'TENANT_ISOLATION_ERROR' || err.statusCode === 403;
      addResult(
        'P2_TEST_13',
        'Cross-tenant capability state read',
        'ISOLATION',
        'TENANT_ISOLATION_ERROR thrown',
        passed ? `Blocked: ${err.message}` : err.message,
        passed
      );
    }

    // -----------------------------------------------------------------
    // P2_TEST_14: Cross-tenant capability state mutation -> DENIED
    // -----------------------------------------------------------------
    try {
      dbkCapabilityManager.disableCapability(schoolCtx, 'tenant_hardware_01', 'inventory_foundation');
      addResult('P2_TEST_14', 'Cross-tenant capability state mutation', 'ISOLATION', 'TENANT_ISOLATION_ERROR thrown', 'Mutation succeeded', false);
    } catch (err: any) {
      const passed = err.message.includes('Tenant Isolation Violation') || err.message.includes('Cross-Tenant Access Violation') || err.code === 'TENANT_ISOLATION_ERROR' || err.statusCode === 403;
      addResult(
        'P2_TEST_14',
        'Cross-tenant capability state mutation',
        'ISOLATION',
        'TENANT_ISOLATION_ERROR thrown',
        passed ? `Blocked: ${err.message}` : err.message,
        passed
      );
    }

    // -----------------------------------------------------------------
    // P2_TEST_15: Master capability administration -> PASS
    // -----------------------------------------------------------------
    try {
      const updated = capabilityRegistry.updateCapability(masterCtx, 'school_academics', { description: 'Updated by Master' });
      const passed = updated.description === 'Updated by Master';
      addResult(
        'P2_TEST_15',
        'Master capability administration',
        'MASTER',
        'Description updated successfully by Master',
        passed ? 'Updated by Master' : 'Failed to update',
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_15', 'Master capability administration', 'MASTER', 'Updated', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_16: DBK admin attempting Master capability administration -> DENIED
    // -----------------------------------------------------------------
    try {
      capabilityRegistry.suspendCapabilityPlatformWide(schoolCtx, 'school_academics', 'Malicious request');
      addResult('P2_TEST_16', 'DBK admin attempting Master capability administration', 'MASTER', 'AUTHORIZATION_ERROR 403 thrown', 'Operation succeeded', false);
    } catch (err: any) {
      const passed = err.message.includes('Master Authority Required') || err.status === 403;
      addResult(
        'P2_TEST_16',
        'DBK admin attempting Master capability administration',
        'MASTER',
        'AUTHORIZATION_ERROR 403 thrown',
        passed ? `Blocked: ${err.message}` : err.message,
        passed
      );
    }

    // -----------------------------------------------------------------
    // P2_TEST_17: Disabled capability cannot activate/use -> DENIED
    // -----------------------------------------------------------------
    try {
      dbkCapabilityManager.disableCapability(schoolCtx, 'tenant_school_01', 'school_academics');
      const decision = activationEvaluator.evaluateActivation(schoolCtx, 'tenant_school_01', 'school_fee_structure');
      const passed = decision.allowed === false && decision.outcome === 'DEPENDENCY_REQUIRED';
      addResult(
        'P2_TEST_17',
        'Disabled capability cannot activate/use',
        'LIFECYCLE',
        'Dependent capability blocked when prerequisite is DISABLED',
        `allowed = ${decision.allowed}, outcome = ${decision.outcome}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_17', 'Disabled capability cannot activate/use', 'LIFECYCLE', 'Blocked', 'ERROR', false, err.message);
    }

    // Re-enable school_academics for remaining tests
    dbkCapabilityManager.enableCapability(schoolCtx, 'tenant_school_01', 'school_academics', 'ENTITLED', false);

    // -----------------------------------------------------------------
    // P2_TEST_18: Suspended capability cannot activate/use -> DENIED
    // -----------------------------------------------------------------
    try {
      capabilityRegistry.suspendCapabilityPlatformWide(masterCtx, 'mpesa_bridge', 'Security audit in progress');
      const decision = activationEvaluator.evaluateActivation(schoolCtx, 'tenant_school_01', 'mpesa_bridge');
      const passed = decision.allowed === false && decision.outcome === 'SUSPENDED';
      addResult(
        'P2_TEST_18',
        'Suspended capability cannot activate/use',
        'LIFECYCLE',
        'allowed = false, outcome = SUSPENDED',
        `allowed = ${decision.allowed}, outcome = ${decision.outcome}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_18', 'Suspended capability cannot activate/use', 'LIFECYCLE', 'SUSPENDED', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_19: Configuration-required state enforced -> PASS
    // -----------------------------------------------------------------
    try {
      // Step 1: Enable pos_register (requires config)
      const enabledRec = dbkCapabilityManager.enableCapability(hardwareCtx, 'tenant_hardware_01', 'pos_register', 'ENTITLED', true);
      const isEnabledUnconfigured = enabledRec.state === 'ENABLED' && enabledRec.configurationState.isConfigured === false;

      // Step 2: Configure pos_register
      const configuredRec = dbkCapabilityManager.configureCapability(hardwareCtx, 'tenant_hardware_01', 'pos_register', {
        registerCode: 'REG-001',
      });
      const isConfigured = configuredRec.state === 'CONFIGURED' && configuredRec.configurationState.isConfigured === true;

      const passed = isEnabledUnconfigured && isConfigured;
      addResult(
        'P2_TEST_19',
        'Configuration-required state enforced',
        'CONFIGURATION',
        'Transitions ENABLED (unconfigured) -> CONFIGURED (configured)',
        passed ? 'Strict configuration lifecycle verified' : 'Configuration cycle failed',
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_19', 'Configuration-required state enforced', 'CONFIGURATION', 'Configured', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_20: Capability state survives browser refresh -> PASS
    // -----------------------------------------------------------------
    try {
      // Query capability records with a fresh context for the same tenant
      const freshToken = TokenVerifier.mintTestToken({
        uid: 'usr_school_admin_fresh',
        email: 'admin_fresh@schoolA.ac.ke',
        tenantId: 'tenant_school_01',
        isMaster: false,
        roles: ['DBK_ADMIN'],
        permissions: ['tenant:admin'],
      });
      const freshCtx = await securityContextFactory.createSecurityContext({
        authHeader: `Bearer ${freshToken}`,
        targetTenantId: 'tenant_school_01',
      });

      const records = dbkCapabilityManager.getDbkCapabilityRecords(freshCtx, 'tenant_school_01');
      const academicsRec = records.find((r) => r.capabilityId === 'school_academics');
      const passed = academicsRec !== undefined && (academicsRec.state === 'ENABLED' || academicsRec.state === 'CONFIGURED');

      addResult(
        'P2_TEST_20',
        'Capability state survives browser refresh',
        'PERSISTENCE',
        'Server-authoritative state preserved across requests',
        passed ? 'State successfully retrieved' : 'State lost',
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_20', 'Capability state survives browser refresh', 'PERSISTENCE', 'Preserved', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_21: Capability version remains correctly bound -> PASS
    // -----------------------------------------------------------------
    try {
      const rec = dbkCapabilityManager.getDbkCapabilityRecord(schoolCtx, 'tenant_school_01', 'school_academics');
      const passed = rec?.capabilityVersion === '1.0.0';
      addResult(
        'P2_TEST_21',
        'Capability version remains correctly bound',
        'VERSIONING',
        'capabilityVersion = 1.0.0 bound to tenant record',
        `Bound version: ${rec?.capabilityVersion}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_21', 'Capability version remains correctly bound', 'VERSIONING', 'Bound version', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_22: School capability surface -> PASS
    // -----------------------------------------------------------------
    try {
      const surface = await discoveryEngine.discoverCapabilitiesForDbk(schoolCtx, 'tenant_school_01');
      const ids = surface.items.map((i) => i.capability.capabilityId);
      const hasAcademics = ids.includes('school_academics');
      const hasFee = ids.includes('school_fee_structure');
      const hasHostel = ids.includes('school_hostel');
      const passed = hasAcademics && hasFee && hasHostel;
      addResult(
        'P2_TEST_22',
        'School capability surface',
        'SURFACE',
        'Includes school_academics, school_fee_structure, school_hostel',
        passed ? 'Valid School surface generated' : `Incomplete surface: ${ids.join(', ')}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_22', 'School capability surface', 'SURFACE', 'School surface', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_23: Hardware capability surface -> PASS
    // -----------------------------------------------------------------
    try {
      const surface = await discoveryEngine.discoverCapabilitiesForDbk(hardwareCtx, 'tenant_hardware_01');
      const ids = surface.items.map((i) => i.capability.capabilityId);
      const hasInventory = ids.includes('inventory_foundation');
      const hasSales = ids.includes('sales_counter');
      const hasPos = ids.includes('pos_register');
      const passed = hasInventory && hasSales && hasPos;
      addResult(
        'P2_TEST_23',
        'Hardware capability surface',
        'SURFACE',
        'Includes inventory_foundation, sales_counter, pos_register',
        passed ? 'Valid Hardware surface generated' : `Incomplete surface: ${ids.join(', ')}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_23', 'Hardware capability surface', 'SURFACE', 'Hardware surface', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_24: Logistics capability surface -> PASS
    // -----------------------------------------------------------------
    try {
      const surface = await discoveryEngine.discoverCapabilitiesForDbk(logisticsCtx, 'tenant_logistics_01');
      const ids = surface.items.map((i) => i.capability.capabilityId);
      const hasDispatch = ids.includes('logistics_dispatch');
      const hasFleet = ids.includes('fleet_tracking');
      const passed = hasDispatch && hasFleet;
      addResult(
        'P2_TEST_24',
        'Logistics capability surface',
        'SURFACE',
        'Includes logistics_dispatch, fleet_tracking',
        passed ? 'Valid Logistics surface generated' : `Incomplete surface: ${ids.join(', ')}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_24', 'Logistics capability surface', 'SURFACE', 'Logistics surface', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_25: Unrelated capability is not operational -> PASS
    // -----------------------------------------------------------------
    try {
      const decision = activationEvaluator.evaluateActivation(hardwareCtx, 'tenant_hardware_01', 'school_academics');
      const passed = decision.allowed === false && decision.outcome === 'BLUEPRINT_UNSUPPORTED';
      addResult(
        'P2_TEST_25',
        'Unrelated capability is not operational',
        'BLUEPRINT_BOUND',
        'allowed = false, outcome = BLUEPRINT_UNSUPPORTED',
        `allowed = ${decision.allowed}, outcome = ${decision.outcome}`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_25', 'Unrelated capability is not operational', 'BLUEPRINT_BOUND', 'BLUEPRINT_UNSUPPORTED', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_26: Capability lifecycle produces audit event -> PASS
    // -----------------------------------------------------------------
    try {
      const events = auditLogger.getEvents({ tenantId: 'tenant_school_01' });
      const hasLifecycleEvents = events.some(
        (e) =>
          e.action === 'CAPABILITY_ENABLED' ||
          e.action === 'CAPABILITY_DISABLED' ||
          e.action === 'CAPABILITY_DISCOVERED' ||
          e.action === 'CAPABILITY_ENTITLEMENT_EVALUATED'
      );
      addResult(
        'P2_TEST_26',
        'Capability lifecycle produces audit event',
        'AUDIT',
        'Audit trail contains recorded capability lifecycle events',
        hasLifecycleEvents ? 'Audit events recorded' : 'No audit events found',
        hasLifecycleEvents
      );
    } catch (err: any) {
      addResult('P2_TEST_26', 'Capability lifecycle produces audit event', 'AUDIT', 'Events recorded', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_27: Phase 0 regression suite -> PASS
    // -----------------------------------------------------------------
    try {
      const p0Summary = await phase0TestRunner.runAllTests();
      const passed = p0Summary.passedCount === 12 && p0Summary.failedCount === 0;
      addResult(
        'P2_TEST_27',
        'Phase 0 regression suite',
        'REGRESSION',
        '12/12 Kernel security test cases passing',
        `${p0Summary.passedCount}/12 passing`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_27', 'Phase 0 regression suite', 'REGRESSION', '12/12 passing', 'ERROR', false, err.message);
    }

    // -----------------------------------------------------------------
    // P2_TEST_28: Phase 1 regression suite -> PASS
    // -----------------------------------------------------------------
    try {
      const p1Summary = await Phase1TestRunner.runAllTests();
      const passed = p1Summary.passedCount === 17 && p1Summary.failedCount === 0;
      addResult(
        'P2_TEST_28',
        'Phase 1 regression suite',
        'REGRESSION',
        '17/17 Blueprint & DNA test cases passing',
        `${p1Summary.passedCount}/17 passing`,
        passed
      );
    } catch (err: any) {
      addResult('P2_TEST_28', 'Phase 1 regression suite', 'REGRESSION', '17/17 passing', 'ERROR', false, err.message);
    }

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;

    return {
      passedCount,
      failedCount,
      totalCount: results.length,
      results,
    };
  }
}
