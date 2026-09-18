/**
 * TDBK V2 PHASE 5 VERIFICATION TEST SUITE & RUNNER
 * Architectural Layer: LAYER 8 & 9 — EXPERIENCE SERVICES, UI ENGINE & DESIGN SYSTEM
 * Validates Experience Resolver, Dynamic Navigation, Terminology Resolution, Dashboard Composition,
 * Capability Discovery, Stateless Command Model, and Cross-Phase Regressions.
 */

import { SecurityContext, Principal } from '../../kernel/types';
import { dbkRegistry } from '../../platform/dbkRegistry';
import { provisioningService } from '../../platform/provisioning/provisioningService';
import { branchManager } from '../../platform/branch/branchManager';
import { dbkLifecycleManager } from '../../platform/lifecycle/lifecycleManager';
import { experienceResolver } from '../experienceResolver';
import { dynamicNavigationEngine } from '../navigation/navigationEngine';
import { dashboardComposer } from '../dashboard/dashboardComposer';
import { capabilityViewRegistry } from '../registry/viewRegistry';
import { entityEngine } from '../entity/entityEngine';
import { entitlementEngine } from '../../capability/entitlement';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { businessDnaManager } from '../../blueprint/dnaManager';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { eventBus } from '../../orchestration/events/eventBus';
import { phase0TestRunner } from '../../kernel/tests/phase0TestRunner';
import { Phase1TestRunner } from '../../blueprint/tests/phase1TestRunner';
import { Phase2TestRunner } from '../../capability/tests/phase2TestRunner';
import { Phase3TestRunner } from '../../orchestration/tests/phase3TestRunner';
import { runPhase4TestSuite } from '../../platform/tests/phase4TestRunner';

export interface TestCaseResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface Phase5TestSummary {
  phase: string;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
}

export async function runPhase5TestSuite(): Promise<Phase5TestSummary> {
  const startTime = Date.now();
  const results: TestCaseResult[] = [];

  // Reset stores for clean test isolation
  dbkRegistry.clearStoreForTesting();
  branchManager.clearStoreForTesting();
  provisioningService.clearStoreForTesting();
  eventBus.clearStoreForTesting();
  auditLogger.clearBufferForTesting();
  entityEngine.clearStoreForTesting();

  const runTest = async (
    id: string,
    name: string,
    testFn: () => Promise<void> | void
  ) => {
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
        error: err?.message || String(err),
      });
    }
  };

  // Helper security contexts
  const masterPrincipal: Principal = {
    id: 'usr_master_super',
    tenantId: 'master',
    roles: ['TDBK_MASTER_ADMIN'],
    permissions: ['*'],
    isMaster: true,
    authTime: Date.now(),
    tokenSource: 'JWT',
    branchId: null,
  };
  const masterCtx: SecurityContext = {
    principal: masterPrincipal,
    requestId: 'req_p5_master',
    timestamp: new Date().toISOString(),
    tenantContext: null,
    branchContext: null,
    correlationId: 'corr_p5_master',
  };

  const createTenantContext = (
    userId: string,
    tenantId: string,
    roles: string[],
    permissions: string[] = ['*'],
    branchId: string | null = null
  ): SecurityContext => ({
    requestId: `req_${Date.now()}_${Math.random()}`,
    timestamp: new Date().toISOString(),
    principal: {
      id: userId,
      tenantId,
      branchId,
      roles,
      permissions,
      authTime: Date.now(),
      tokenSource: 'JWT',
      isMaster: false,
    },
    tenantContext: {
      tenantId,
      name: 'Tenant Org',
      blueprintId: 'school_v1',
      status: 'ACTIVE',
    },
    branchContext: null,
    correlationId: `corr_${userId}`,
  });

  let schoolDbkId = '';
  let hardwareDbkId = '';
  let clinicDbkId = '';

  // -------------------------------------------------------------
  // SETUP: Provision Test DBKs
  // -------------------------------------------------------------
  await runTest('P5_SETUP_01', 'Provision Education DBK (Premier Academy)', async () => {
    const res = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_premier_school',
      legalName: 'Premier Academy Nairobi Ltd',
      displayName: 'Premier Academy',
      blueprintId: 'school_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Main Campus',
    });
    schoolDbkId = res.dbkId;
    await businessDnaManager.bindBlueprintToDbkPersistent(masterCtx, schoolDbkId, 'Premier Academy');
    if (!schoolDbkId || res.status !== 'ACTIVE') {
      throw new Error(`Failed to provision school DBK: ${JSON.stringify(res)}`);
    }
  });

  await runTest('P5_SETUP_02', 'Provision Hardware DBK (Apex Hardware Yard)', async () => {
    const res = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_apex_hardware',
      legalName: 'Apex Building Materials Ltd',
      displayName: 'Apex Hardware & Timber',
      blueprintId: 'hardware_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'FOUNDATION',
      primaryBranchName: 'Industrial Area Yard',
    });
    hardwareDbkId = res.dbkId;
    await businessDnaManager.bindBlueprintToDbkPersistent(masterCtx, hardwareDbkId, 'Apex Hardware & Timber');
    if (!hardwareDbkId || res.status !== 'ACTIVE') {
      throw new Error(`Failed to provision hardware DBK: ${JSON.stringify(res)}`);
    }
  });

  await runTest('P5_SETUP_03', 'Provision Healthcare DBK (Afyangu Outpatient Clinic)', async () => {
    const res = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_afyangu_clinic',
      legalName: 'Afyangu Medical Centre Ltd',
      displayName: 'Afyangu Clinic',
      blueprintId: 'clinic_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Westlands Hub',
    });
    clinicDbkId = res.dbkId;
    await businessDnaManager.bindBlueprintToDbkPersistent(masterCtx, clinicDbkId, 'Afyangu Clinic');
    if (!clinicDbkId || res.status !== 'ACTIVE') {
      throw new Error(`Failed to provision clinic DBK: ${JSON.stringify(res)}`);
    }
  });

  // -------------------------------------------------------------
  // SECTION 1: RESOLVER & WORKSPACE PROJECTION
  // -------------------------------------------------------------
  await runTest('P5_TEST_01', 'Experience Resolver returns valid DbkExperienceResolved for School DBK', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    if (!resolved || resolved.dbkId !== schoolDbkId) {
      throw new Error(`Invalid resolved experience for ${schoolDbkId}`);
    }
    if (resolved.sector !== 'EDUCATION') {
      throw new Error(`Expected sector EDUCATION, got ${resolved.sector}`);
    }
    if (resolved.subscriptionTier !== 'GROWTH') {
      throw new Error(`Expected tier GROWTH, got ${resolved.subscriptionTier}`);
    }
  });

  await runTest('P5_TEST_02', 'Experience Resolver returns valid DbkExperienceResolved for Hardware DBK', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, hardwareDbkId);
    if (resolved.sector !== 'HARDWARE') {
      throw new Error(`Expected sector HARDWARE, got ${resolved.sector}`);
    }
    if (resolved.subscriptionTier !== 'FOUNDATION') {
      throw new Error(`Expected tier FOUNDATION, got ${resolved.subscriptionTier}`);
    }
  });

  await runTest('P5_TEST_03', 'Experience Resolver returns valid DbkExperienceResolved for Clinic DBK', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, clinicDbkId);
    if (resolved.sector !== 'HEALTHCARE') {
      throw new Error(`Expected sector HEALTHCARE, got ${resolved.sector}`);
    }
    if (resolved.subscriptionTier !== 'GROWTH') {
      throw new Error(`Expected tier GROWTH, got ${resolved.subscriptionTier}`);
    }
  });

  await runTest('P5_TEST_04', 'Experience Resolver strictly enforces cross-tenant boundary for foreign user', async () => {
    const foreignCtx = createTenantContext('usr_foreign_hacker', 'unrelated_tenant_99', ['CASHIER'], ['read:pos']);

    let failed = false;
    try {
      await experienceResolver.resolveExperience(foreignCtx, schoolDbkId);
    } catch {
      failed = true;
    }

    if (!failed) {
      throw new Error('Expected cross-tenant access to be blocked by SecurityViolationError');
    }
  });

  // -------------------------------------------------------------
  // SECTION 2: DYNAMIC TERMINOLOGY RESOLUTION
  // -------------------------------------------------------------
  await runTest('P5_TEST_05', 'School DBK resolves customer terminology to Student / Students', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    const term = resolved.terminology as any;
    if (term.customer.singular !== 'Student' || term.customer.plural !== 'Students') {
      throw new Error(`Expected Student/Students, got: ${JSON.stringify(term.customer)}`);
    }
  });

  await runTest('P5_TEST_06', 'Hardware DBK resolves customer terminology to Buyer / Customer', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, hardwareDbkId);
    const term = resolved.terminology as any;
    if (!term.customer.singular.includes('Buyer') && !term.customer.singular.includes('Customer')) {
      throw new Error(`Expected Buyer/Customer, got: ${JSON.stringify(term.customer)}`);
    }
  });

  await runTest('P5_TEST_07', 'Clinic DBK resolves customer terminology to Patient / Patients', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, clinicDbkId);
    const term = resolved.terminology as any;
    if (term.customer.singular !== 'Patient' || term.customer.plural !== 'Patients') {
      throw new Error(`Expected Patient/Patients, got: ${JSON.stringify(term.customer)}`);
    }
  });

  await runTest('P5_TEST_08', 'Dynamic navigation labels adopt Blueprint terminology (Student Directory)', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    const studentNav = resolved.navigation.find((n) => n.capabilityId === 'student_records');
    if (!studentNav) {
      throw new Error('student_records navigation item missing');
    }
    if (!studentNav.label.includes('Student')) {
      throw new Error(`Expected label containing 'Student', got '${studentNav.label}'`);
    }
  });

  await runTest('P5_TEST_09', 'Hardware navigation labels adopt Blueprint terminology (Yard Inventory)', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, hardwareDbkId);
    const stockNav = resolved.navigation.find((n) => n.capabilityId === 'stock_control');
    if (!stockNav) {
      throw new Error('stock_control navigation item missing');
    }
    if (!stockNav.label.includes('Inventory') && !stockNav.label.includes('Stock')) {
      throw new Error(`Expected stock label, got '${stockNav.label}'`);
    }
  });

  // -------------------------------------------------------------
  // SECTION 3: ROLE-GATED DYNAMIC NAVIGATION
  // -------------------------------------------------------------
  await runTest('P5_TEST_10', 'Teacher role in School DBK only sees academic and student navigation', async () => {
    const teacherCtx = createTenantContext('usr_teacher_01', schoolDbkId, ['TEACHER'], ['read:students', 'write:grades']);

    const resolved = await experienceResolver.resolveExperience(teacherCtx, schoolDbkId);
    const feeNav = resolved.navigation.find((n) => n.capabilityId === 'fee_management');
    const settingsNav = resolved.navigation.find((n) => n.id === 'nav_settings');

    if (feeNav) {
      throw new Error('Teacher should not have access to fee_management navigation');
    }
    if (settingsNav) {
      throw new Error('Teacher should not have access to system settings navigation');
    }
  });

  await runTest('P5_TEST_11', 'Principal role in School DBK sees executive overview, fees, and settings', async () => {
    const principalCtx = createTenantContext('usr_principal_01', schoolDbkId, ['SCHOOL_PRINCIPAL', 'TENANT_ADMIN'], ['*']);

    const resolved = await experienceResolver.resolveExperience(principalCtx, schoolDbkId);
    const feeNav = resolved.navigation.find((n) => n.capabilityId === 'fee_management');
    const settingsNav = resolved.navigation.find((n) => n.id === 'nav_settings');

    if (!feeNav) {
      throw new Error('Principal must have access to fee_management navigation');
    }
    if (!settingsNav) {
      throw new Error('Principal must have access to settings navigation');
    }
  });

  await runTest('P5_TEST_12', 'Cashier in Hardware DBK sees POS navigation but not Settings', async () => {
    const cashierCtx = createTenantContext('usr_cashier_01', hardwareDbkId, ['CASHIER'], ['read:pos', 'write:receipt']);

    const resolved = await experienceResolver.resolveExperience(cashierCtx, hardwareDbkId);
    const posNav = resolved.navigation.find((n) => n.capabilityId === 'counter_pos');
    const settingsNav = resolved.navigation.find((n) => n.id === 'nav_settings');

    if (!posNav) {
      throw new Error('Cashier must have access to counter_pos');
    }
    if (settingsNav) {
      throw new Error('Cashier must NOT have access to settings');
    }
  });

  await runTest('P5_TEST_13', 'Overview & Dashboard is always present as first navigation item', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    if (resolved.navigation[0].id !== 'nav_overview') {
      throw new Error(`Expected first item to be nav_overview, got ${resolved.navigation[0].id}`);
    }
  });

  // -------------------------------------------------------------
  // SECTION 4: DYNAMIC DASHBOARD COMPOSITION
  // -------------------------------------------------------------
  await runTest('P5_TEST_14', 'School DBK dashboard composes student enrollment and fee metrics', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    const enrollmentWidget = resolved.dashboardWidgets.find((w) => w.id === 'widget_school_enrollment');
    const feeWidget = resolved.dashboardWidgets.find((w) => w.id === 'widget_school_fees');

    if (!enrollmentWidget) {
      throw new Error('widget_school_enrollment missing from School DBK dashboard');
    }
    if (!feeWidget) {
      throw new Error('widget_school_fees missing from School DBK dashboard');
    }
  });

  await runTest('P5_TEST_15', 'Hardware DBK dashboard composes yard turnover and low stock alerts', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, hardwareDbkId);
    const salesWidget = resolved.dashboardWidgets.find((w) => w.id === 'widget_hardware_sales');
    const alertWidget = resolved.dashboardWidgets.find((w) => w.id === 'widget_hardware_low_stock');

    if (!salesWidget) {
      throw new Error('widget_hardware_sales missing from Hardware DBK dashboard');
    }
    if (!alertWidget) {
      throw new Error('widget_hardware_low_stock missing from Hardware DBK dashboard');
    }
  });

  await runTest('P5_TEST_16', 'Clinic DBK dashboard composes triage queue and pharmacy metrics', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, clinicDbkId);
    const queueWidget = resolved.dashboardWidgets.find((w) => w.id === 'widget_clinic_queue');
    const rxWidget = resolved.dashboardWidgets.find((w) => w.id === 'widget_pharmacy_metrics');

    if (!queueWidget) {
      throw new Error('widget_clinic_queue missing from Clinic DBK dashboard');
    }
    if (!rxWidget) {
      throw new Error('widget_pharmacy_metrics missing from Clinic DBK dashboard');
    }
  });

  // -------------------------------------------------------------
  // SECTION 5: CAPABILITY DISCOVERY SURFACE
  // -------------------------------------------------------------
  await runTest('P5_TEST_17', 'Discovery items include all catalog capabilities with accurate entitlement state', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    if (!resolved.discoveryItems || resolved.discoveryItems.length === 0) {
      throw new Error('Discovery items empty');
    }

    const mpesaItem = resolved.discoveryItems.find((d) => d.capabilityId === 'mpesa_reconciliation');
    if (!mpesaItem) {
      throw new Error('mpesa_reconciliation missing from discovery items');
    }
    if (mpesaItem.status !== 'OPERATIONAL') {
      throw new Error(`Expected OPERATIONAL for enabled mpesa_reconciliation, got ${mpesaItem.status}`);
    }
  });

  await runTest('P5_TEST_18', 'Discovery flags higher tier capabilities as UPGRADE_REQUIRED for lower tier DBKs', async () => {
    const resolved = await experienceResolver.resolveExperience(masterCtx, hardwareDbkId); // FOUNDATION tier
    const multiBranchCap = resolved.discoveryItems.find((d) => d.minimumTier === 'ENTERPRISE' || d.minimumTier === 'PRO');

    if (multiBranchCap && !multiBranchCap.isEntitled) {
      if (multiBranchCap.status !== 'UPGRADE_REQUIRED') {
        throw new Error(`Expected UPGRADE_REQUIRED for ${multiBranchCap.capabilityId}, got ${multiBranchCap.status}`);
      }
    }
  });

  // -------------------------------------------------------------
  // SECTION 6: BRANCH TOPOLOGY & SWITCHING
  // -------------------------------------------------------------
  await runTest('P5_TEST_19', 'Multi-branch Hardware DBK reports all available branches in resolved experience', async () => {
    // Add a second branch to hardware DBK
    branchManager.createSecondaryBranch(masterCtx, hardwareDbkId, {
      branchId: 'br_apex_mombasa',
      name: 'Mombasa Road Branch',
      type: 'RETAIL_OUTLET',
    });

    const resolved = await experienceResolver.resolveExperience(masterCtx, hardwareDbkId);
    if (resolved.availableBranches.length < 2) {
      throw new Error(`Expected at least 2 branches, got ${resolved.availableBranches.length}`);
    }
  });

  await runTest('P5_TEST_20', 'Client command SWITCH_BRANCH validates target branch exists', async () => {
    const cmdRes = await experienceResolver.dispatchCommand(masterCtx, {
      commandType: 'SWITCH_BRANCH',
      targetDbkId: hardwareDbkId,
      payload: { branchId: 'br_apex_mombasa' },
    });

    if (!cmdRes.success) {
      throw new Error(`SWITCH_BRANCH command failed: ${JSON.stringify(cmdRes.error)}`);
    }
  });

  await runTest('P5_TEST_21', 'Client command SWITCH_BRANCH rejects non-existent branch ID', async () => {
    const cmdRes = await experienceResolver.dispatchCommand(masterCtx, {
      commandType: 'SWITCH_BRANCH',
      targetDbkId: hardwareDbkId,
      payload: { branchId: 'non_existent_branch_999' },
    });

    if (cmdRes.success) {
      throw new Error('Expected SWITCH_BRANCH to fail for non-existent branch');
    }
  });

  // -------------------------------------------------------------
  // SECTION 7: ENTITY INTERACTION & COMMAND MODEL
  // -------------------------------------------------------------
  await runTest('P5_TEST_22', 'Entity Engine resolves dynamic entity schema for student_records', async () => {
    const projection = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    const workspace = (experienceResolver as any).experienceProjection?.getExperienceProjection(masterCtx, schoolDbkId)?.workspace || {
      sector: 'EDUCATION',
      terminology: projection.terminology,
      enabledCapabilities: ['student_records'],
    };

    const schema = entityEngine.resolveEntitySchema('student_records', workspace as any);
    if (!schema) {
      throw new Error('Failed to resolve schema for student_records');
    }
    if (!schema.singularName.includes('Student')) {
      throw new Error(`Expected singularName containing Student, got ${schema.singularName}`);
    }
  });

  await runTest('P5_TEST_23', 'Entity Engine saves and returns interactive records', async () => {
    const saved = entityEngine.saveRecord(schoolDbkId, 'student_records', {
      id: 'std_test_99',
      entityType: 'student_records',
      primaryIdentifier: 'ADM-2026-999',
      secondaryIdentifier: 'Test Student',
      status: 'ACTIVE',
      attributes: { admissionNo: 'ADM-2026-999', fullName: 'Test Student', classStream: 'Grade 1A', feeBalance: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (!saved || saved.id !== 'std_test_99') {
      throw new Error('Failed to save entity record');
    }

    const records = entityEngine.getRecords(schoolDbkId, 'student_records');
    const found = records.find((r) => r.id === 'std_test_99');
    if (!found) {
      throw new Error('Saved entity record not found in getRecords');
    }
  });

  await runTest('P5_TEST_24', 'Command SUBMIT_ENTITY dispatches, saves entity, and returns updated experience', async () => {
    const cmdRes = await experienceResolver.dispatchCommand(masterCtx, {
      commandType: 'SUBMIT_ENTITY',
      targetDbkId: schoolDbkId,
      payload: {
        capabilityId: 'student_records',
        record: {
          id: 'std_dispatch_01',
          entityType: 'student_records',
          primaryIdentifier: 'ADM-2026-777',
          secondaryIdentifier: 'Alice Wambui',
          status: 'ACTIVE',
          attributes: { admissionNo: 'ADM-2026-777', fullName: 'Alice Wambui', classStream: 'Grade 6', feeBalance: 1500 },
        },
      },
    });

    if (!cmdRes.success) {
      throw new Error(`SUBMIT_ENTITY command failed: ${JSON.stringify(cmdRes.error)}`);
    }
    if (!cmdRes.updatedResolvedExperience) {
      throw new Error('SUBMIT_ENTITY must return updatedResolvedExperience');
    }
  });

  // -------------------------------------------------------------
  // SECTION 8: CAPABILITY ENABLEMENT VIA COMMAND
  // -------------------------------------------------------------
  await runTest('P5_TEST_25', 'Command ENABLE_CAPABILITY enables entitled capability and re-renders experience', async () => {
    const cmdRes = await experienceResolver.dispatchCommand(masterCtx, {
      commandType: 'ENABLE_CAPABILITY',
      targetDbkId: schoolDbkId,
      payload: { capabilityId: 'cbc_grading' },
    });

    if (!cmdRes.success) {
      throw new Error(`ENABLE_CAPABILITY failed: ${JSON.stringify(cmdRes.error)}`);
    }

    const updatedExp = cmdRes.updatedResolvedExperience;
    const cbcNav = updatedExp?.navigation.find((n) => n.capabilityId === 'cbc_grading');
    if (!cbcNav) {
      throw new Error('Newly enabled capability cbc_grading should appear in navigation');
    }
  });

  await runTest('P5_TEST_26', 'Command ENABLE_CAPABILITY rejects unentitled capability', async () => {
    // Hardware is FOUNDATION tier. Trying to enable an ENTERPRISE capability should fail.
    const cmdRes = await experienceResolver.dispatchCommand(masterCtx, {
      commandType: 'ENABLE_CAPABILITY',
      targetDbkId: hardwareDbkId,
      payload: { capabilityId: 'enterprise_sap_bridge' },
    });

    if (cmdRes.success) {
      throw new Error('Expected ENABLE_CAPABILITY to fail for unentitled capability');
    }
  });

  // -------------------------------------------------------------
  // SECTION 9: LIFECYCLE STATE BOUNDARIES
  // -------------------------------------------------------------
  await runTest('P5_TEST_27', 'Suspended DBK reports operationalState = SUSPENDED in Experience Projection', async () => {
    await dbkLifecycleManager.suspendDbk(masterCtx, schoolDbkId, 'Billing overdue verification');
    const resolved = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);

    if (resolved.operationalState !== 'SUSPENDED') {
      throw new Error(`Expected operationalState SUSPENDED, got ${resolved.operationalState}`);
    }

    // Re-activate for subsequent tests
    await dbkLifecycleManager.reactivateDbk(masterCtx, schoolDbkId, 'Billing settled');
    const reactivated = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    if (reactivated.operationalState !== 'ACTIVE') {
      throw new Error(`Expected operationalState ACTIVE after reactivation, got ${reactivated.operationalState}`);
    }
  });

  await runTest('P5_TEST_28', 'Archived DBK reports operationalState = ARCHIVED', async () => {
    // Provision temporary DBK to archive
    const temp = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_temp_archive_test',
      legalName: 'Temp DBK For Archive Ltd',
      displayName: 'Temp DBK',
      blueprintId: 'school_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'FOUNDATION',
      primaryBranchName: 'HQ',
    });

    await dbkLifecycleManager.suspendDbk(masterCtx, temp.dbkId, 'Preparation for archive');
    await dbkLifecycleManager.archiveDbk(masterCtx, temp.dbkId, 'Decommissioned');

    const resolved = await experienceResolver.resolveExperience(masterCtx, temp.dbkId);
    if (resolved.operationalState !== 'ARCHIVED') {
      throw new Error(`Expected operationalState ARCHIVED, got ${resolved.operationalState}`);
    }
  });

  // -------------------------------------------------------------
  // SECTION 10: AUDIT LOGGING & OBSERVABILITY
  // -------------------------------------------------------------
  await runTest('P5_TEST_29', 'Experience resolution generates traceable EXPERIENCE_RESOLVED audit event', async () => {
    await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    const events = auditLogger.getEvents({ tenantId: schoolDbkId });
    const resolvedEvent = events.find((e) => e.action === 'EXPERIENCE_RESOLVED');
    if (!resolvedEvent) {
      throw new Error('EXPERIENCE_RESOLVED audit event not logged');
    }
  });

  await runTest('P5_TEST_30', 'Failed command dispatches log COMMAND_FAILED audit events with denial status', async () => {
    await experienceResolver.dispatchCommand(masterCtx, {
      commandType: 'ENABLE_CAPABILITY',
      targetDbkId: hardwareDbkId,
      payload: { capabilityId: 'invalid_cap_xxx' },
    });

    const events = auditLogger.getEvents({ tenantId: hardwareDbkId });
    const failedEvent = events.find((e) => e.action.startsWith('COMMAND_FAILED'));
    if (!failedEvent) {
      throw new Error('COMMAND_FAILED audit event not logged');
    }
  });

  // -------------------------------------------------------------
  // SECTION 11: FULL SECTOR PARITY TESTS (All 9 SME Blueprints)
  // -------------------------------------------------------------
  await runTest('P5_TEST_31', 'Sector Parity: Retail & FMCG Resolves Barcode POS and SKU Inventory', async () => {
    const res = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_p5_retail',
      legalName: 'Chandarana Supermarket Ltd',
      displayName: 'Chandarana Retail',
      blueprintId: 'retail_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Outlet 1',
    });

    const exp = await experienceResolver.resolveExperience(masterCtx, res.dbkId);
    if (exp.sector !== 'RETAIL') {
      throw new Error(`Expected RETAIL, got ${exp.sector}`);
    }
    const posNav = exp.navigation.find((n) => n.capabilityId === 'barcode_pos');
    if (!posNav) {
      throw new Error('barcode_pos navigation missing for Retail DBK');
    }
  });

  await runTest('P5_TEST_32', 'Sector Parity: Logistics & Fleet Resolves Waybill & Dispatch', async () => {
    const res = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_p5_logistics',
      legalName: 'TransEast Cargo Hauliers Ltd',
      displayName: 'TransEast Logistics',
      blueprintId: 'logistics_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Nairobi Hub',
    });

    const exp = await experienceResolver.resolveExperience(masterCtx, res.dbkId);
    if (exp.sector !== 'LOGISTICS') {
      throw new Error(`Expected LOGISTICS, got ${exp.sector}`);
    }
    const wbNav = exp.navigation.find((n) => n.capabilityId === 'waybill_booking');
    if (!wbNav) {
      throw new Error('waybill_booking navigation missing for Logistics DBK');
    }
  });

  await runTest('P5_TEST_33', 'Sector Parity: Hotel & Resort Resolves Room Reservations & Occupancy', async () => {
    const res = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_p5_hotel',
      legalName: 'Mara Serena Safari Lodge Ltd',
      displayName: 'Mara Serena Lodge',
      blueprintId: 'hotel_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'ENTERPRISE',
      primaryBranchName: 'Lodge Main',
    });

    const exp = await experienceResolver.resolveExperience(masterCtx, res.dbkId);
    if (exp.sector !== 'HOSPITALITY') {
      throw new Error(`Expected HOSPITALITY, got ${exp.sector}`);
    }
    const resNav = exp.navigation.find((n) => n.capabilityId === 'room_reservations');
    if (!resNav) {
      throw new Error('room_reservations navigation missing for Hotel DBK');
    }
  });

  await runTest('P5_TEST_34', 'Sector Parity: Salon & Spa Resolves Beauty Checkout & Stylist Commissions', async () => {
    const res = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_p5_salon',
      legalName: 'Glamour Hair & Beauty Lounge Ltd',
      displayName: 'Glamour Salon',
      blueprintId: 'salon_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'FOUNDATION',
      primaryBranchName: 'Kilimani Studio',
    });

    const exp = await experienceResolver.resolveExperience(masterCtx, res.dbkId);
    if (exp.sector !== 'BEAUTY') {
      throw new Error(`Expected BEAUTY, got ${exp.sector}`);
    }
    const posNav = exp.navigation.find((n) => n.capabilityId === 'salon_pos');
    if (!posNav) {
      throw new Error('salon_pos navigation missing for Salon DBK');
    }
  });

  await runTest('P5_TEST_35', 'Sector Parity: Professional Services Resolves Cases & Fee Notes', async () => {
    const res = await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'dbk_p5_prof_services',
      legalName: 'Hamilton Advocates LLP',
      displayName: 'Hamilton Legal',
      blueprintId: 'prof_services_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Upper Hill Chambers',
    });

    const exp = await experienceResolver.resolveExperience(masterCtx, res.dbkId);
    if (exp.sector !== 'PROFESSIONAL_SERVICES') {
      throw new Error(`Expected PROFESSIONAL_SERVICES, got ${exp.sector}`);
    }
  });

  // -------------------------------------------------------------
  // SECTION 12: STATELESS UI & INTEGRITY CHECKS
  // -------------------------------------------------------------
  await runTest('P5_TEST_36', 'Resolved Experience contains server timestamp for cache invalidation', async () => {
    const exp = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    if (!exp.serverTimestamp) {
      throw new Error('Missing serverTimestamp in resolved experience');
    }
  });

  await runTest('P5_TEST_37', 'Workspace configurationVersion increments when capabilities are enabled', async () => {
    const expBefore = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    const vBefore = expBefore.configurationVersion;

    await experienceResolver.dispatchCommand(masterCtx, {
      commandType: 'CONFIGURE_CAPABILITY',
      targetDbkId: schoolDbkId,
      payload: { capabilityId: 'fee_management', configData: { termStructure: 'THREE_TERMS' } },
    });

    const expAfter = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    if (expAfter.configurationVersion <= vBefore) {
      throw new Error(`Expected configurationVersion to increment from ${vBefore}, got ${expAfter.configurationVersion}`);
    }
  });

  await runTest('P5_TEST_38', 'Command dispatch with unknown commandType returns error object gracefully', async () => {
    const res = await experienceResolver.dispatchCommand(masterCtx, {
      commandType: 'UNKNOWN_COMMAND_FOO' as any,
      targetDbkId: schoolDbkId,
      payload: {},
    });

    if (res.success || !res.error) {
      throw new Error('Expected unknown command to return failure response with error');
    }
  });

  await runTest('P5_TEST_39', 'Active branch indicator matches security context branchId when specified', async () => {
    const customBranchCtx: SecurityContext = {
      ...masterCtx,
      branchContext: {
        branchId: 'br_apex_mombasa',
        name: 'Mombasa Road Branch',
        isHeadquarters: false,
        status: 'ACTIVE',
      },
    };

    const exp = await experienceResolver.resolveExperience(customBranchCtx, hardwareDbkId);
    if (exp.activeBranch.branchId !== 'br_apex_mombasa') {
      throw new Error(`Expected active branch br_apex_mombasa, got ${exp.activeBranch.branchId}`);
    }
  });

  await runTest('P5_TEST_40', 'Master Authority is reflected in currentPrincipal.isMaster in Resolved Experience', async () => {
    const masterExp = await experienceResolver.resolveExperience(masterCtx, schoolDbkId);
    if (!masterExp.currentPrincipal.isMaster) {
      throw new Error('Expected currentPrincipal.isMaster to be true for masterCtx');
    }

    const tenantUserCtx = createTenantContext('usr_local', schoolDbkId, ['TEACHER'], ['read']);
    const tenantExp = await experienceResolver.resolveExperience(tenantUserCtx, schoolDbkId);
    if (tenantExp.currentPrincipal.isMaster) {
      throw new Error('Expected currentPrincipal.isMaster to be false for tenant user');
    }
  });

  await runTest('P5_TEST_41', 'Capability View Registry allows registration of custom extension view definitions', async () => {
    capabilityViewRegistry.registerViewDefinition({
      capabilityId: 'custom_extension_cap',
      defaultNavLabel: 'Custom Extension',
      category: 'OPERATIONS',
      iconName: 'Sparkles',
      viewType: 'OPERATIONAL_FLOW',
      displayOrder: 99,
    });

    const def = capabilityViewRegistry.getViewDefinition('custom_extension_cap');
    if (!def || def.defaultNavLabel !== 'Custom Extension') {
      throw new Error('Failed to retrieve custom registered view definition');
    }
  });

  // -------------------------------------------------------------
  // SECTION 13: REGRESSION VERIFICATION (Phases 0 - 4)
  // -------------------------------------------------------------
  await runTest('P5_REGRESSION_PHASE0', 'Phase 0 Security & Tenant Isolation Suite Regression (12 Tests)', async () => {
    const summary = await phase0TestRunner.runAllTests();
    if (summary.overallStatus !== 'PASS' || summary.failedCount > 0) {
      throw new Error(`Phase 0 regression failed: ${summary.failedCount} failed`);
    }
  });

  await runTest('P5_REGRESSION_PHASE1', 'Phase 1 Blueprint & Business DNA Suite Regression (34 Tests)', async () => {
    const summary = await Phase1TestRunner.runAllTests();
    if (summary.failedCount > 0) {
      throw new Error(`Phase 1 regression failed: ${summary.failedCount} failed`);
    }
  });

  await runTest('P5_REGRESSION_PHASE2', 'Phase 2 Capability & Entitlement Suite Regression (35 Tests)', async () => {
    const summary = await Phase2TestRunner.runAllTests();
    if (summary.failedCount > 0) {
      throw new Error(`Phase 2 regression failed: ${summary.failedCount} failed`);
    }
  });

  await runTest('P5_REGRESSION_PHASE3', 'Phase 3 Workflow Engine & Event Bus Suite Regression (42 Tests)', async () => {
    const summary = await Phase3TestRunner.runAllTests();
    if (summary.failedCount > 0) {
      throw new Error(`Phase 3 regression failed: ${summary.failedCount} failed`);
    }
  });

  await runTest('P5_REGRESSION_PHASE4', 'Phase 4 Platform Control & Provisioning Suite Regression (44 Tests)', async () => {
    const summary = await runPhase4TestSuite();
    if (summary.failed > 0) {
      throw new Error(`Phase 4 regression failed: ${summary.failed} failed`);
    }
  });

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    phase: 'PHASE_5_EXPERIENCE_LAYER',
    totalTests: results.length,
    passed,
    failed,
    durationMs: Date.now() - startTime,
    results,
  };
}
