/**
 * PHASE 1 TEST SUITE RUNNER
 * Architectural Layer: LEVEL 3 — BLUEPRINT / BUSINESS DNA
 * Executes 17 mandatory automated security, compilation, and isolation test cases for Phase 1.
 */

import { securityContextFactory } from '../../kernel/context/contextFactory';
import { TokenVerifier } from '../../kernel/identity/tokenVerifier';
import { blueprintRegistry } from '../registry';
import { businessDnaManager } from '../dnaManager';
import { blueprintCompiler } from '../compiler';
import { BlueprintValidator } from '../validator';
import { auditLogger } from '../../kernel/audit/auditLogger';

export interface Phase1TestResult {
  id: string;
  name: string;
  category: string;
  expected: string;
  actual: string;
  passed: boolean;
  errorDetails?: string;
}

export class Phase1TestRunner {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    results: Phase1TestResult[];
  }> {
    businessDnaManager.clearStoreForTesting();
    blueprintRegistry.resetToDefault();
    auditLogger.clearBufferForTesting();

    const results: Phase1TestResult[] = [];

    // Mint tokens for test tenant admins
    const schoolToken = TokenVerifier.mintTestToken({
      uid: 'user_schoolA_admin',
      email: 'admin@schoolA.ac.ke',
      isMaster: false,
      tenantId: 'tenant_school_a',
      branchId: 'tenant_school_a_hq',
      roles: ['SCHOOL_PRINCIPAL'],
      permissions: ['*'],
    });

    const hardwareToken = TokenVerifier.mintTestToken({
      uid: 'user_hardwareB_admin',
      email: 'admin@hardwareB.co.ke',
      isMaster: false,
      tenantId: 'tenant_hardware_b',
      branchId: 'tenant_hardware_b_hq',
      roles: ['STORE_OWNER'],
      permissions: ['*'],
    });

    const retailToken = TokenVerifier.mintTestToken({
      uid: 'user_retailC_admin',
      email: 'admin@retailC.co.ke',
      isMaster: false,
      tenantId: 'tenant_retail_c',
      branchId: 'tenant_retail_c_hq',
      roles: ['SHOP_MANAGER'],
      permissions: ['*'],
    });

    const logisticsToken = TokenVerifier.mintTestToken({
      uid: 'user_logisticsD_admin',
      email: 'admin@logisticsD.co.ke',
      isMaster: false,
      tenantId: 'tenant_logistics_d',
      branchId: 'tenant_logistics_d_hq',
      roles: ['LOGISTICS_DIRECTOR'],
      permissions: ['*'],
    });

    // Helper context generators
    const schoolAdminCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${schoolToken}`,
      targetTenantId: 'tenant_school_a',
    });
    const hardwareAdminCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${hardwareToken}`,
      targetTenantId: 'tenant_hardware_b',
    });
    const retailAdminCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${retailToken}`,
      targetTenantId: 'tenant_retail_c',
    });
    const logisticsAdminCtx = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${logisticsToken}`,
      targetTenantId: 'tenant_logistics_d',
    });

    // 1. Create valid School Blueprint binding -> PASS
    try {
      const dna = businessDnaManager.bindBlueprintToDbk(
        schoolAdminCtx,
        'tenant_school_a',
        'St. Andrew Academy',
        'school_v1',
        '1.0.0'
      );
      results.push({
        id: 'P1_TEST_01',
        name: 'Create Valid School Blueprint Binding',
        category: 'BINDING',
        expected: 'Binding created with sector EDUCATION',
        actual: `Created DBK binding for ${dna.identity.businessName} (Blueprint: ${dna.identity.blueprintId})`,
        passed: dna.identity.blueprintId === 'school_v1' && dna.identity.businessType === 'EDUCATION',
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_01',
        name: 'Create Valid School Blueprint Binding',
        category: 'BINDING',
        expected: 'Binding created with sector EDUCATION',
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 2. Create valid Hardware Blueprint binding -> PASS
    try {
      const dna = businessDnaManager.bindBlueprintToDbk(
        hardwareAdminCtx,
        'tenant_hardware_b',
        'Simba Hardware & Supplies',
        'hardware_v1',
        '1.0.0'
      );
      results.push({
        id: 'P1_TEST_02',
        name: 'Create Valid Hardware Blueprint Binding',
        category: 'BINDING',
        expected: 'Binding created with sector HARDWARE',
        actual: `Created DBK binding for ${dna.identity.businessName} (Blueprint: ${dna.identity.blueprintId})`,
        passed: dna.identity.blueprintId === 'hardware_v1' && dna.identity.businessType === 'HARDWARE',
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_02',
        name: 'Create Valid Hardware Blueprint Binding',
        category: 'BINDING',
        expected: 'Binding created with sector HARDWARE',
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 3. Create valid Retail Blueprint binding -> PASS
    try {
      const dna = businessDnaManager.bindBlueprintToDbk(
        retailAdminCtx,
        'tenant_retail_c',
        'Nairobi Supermarket Outlet',
        'retail_v1',
        '1.0.0'
      );
      results.push({
        id: 'P1_TEST_03',
        name: 'Create Valid Retail Blueprint Binding',
        category: 'BINDING',
        expected: 'Binding created with sector RETAIL',
        actual: `Created DBK binding for ${dna.identity.businessName} (Blueprint: ${dna.identity.blueprintId})`,
        passed: dna.identity.blueprintId === 'retail_v1' && dna.identity.businessType === 'RETAIL',
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_03',
        name: 'Create Valid Retail Blueprint Binding',
        category: 'BINDING',
        expected: 'Binding created with sector RETAIL',
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 4. Create valid Logistics Blueprint binding -> PASS
    try {
      const dna = businessDnaManager.bindBlueprintToDbk(
        logisticsAdminCtx,
        'tenant_logistics_d',
        'Express Cargo & Courier Ltd',
        'logistics_v1',
        '1.0.0'
      );
      results.push({
        id: 'P1_TEST_04',
        name: 'Create Valid Logistics Blueprint Binding',
        category: 'BINDING',
        expected: 'Binding created with sector LOGISTICS',
        actual: `Created DBK binding for ${dna.identity.businessName} (Blueprint: ${dna.identity.blueprintId})`,
        passed: dna.identity.blueprintId === 'logistics_v1' && dna.identity.businessType === 'LOGISTICS',
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_04',
        name: 'Create Valid Logistics Blueprint Binding',
        category: 'BINDING',
        expected: 'Binding created with sector LOGISTICS',
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 5. Unknown Blueprint binding -> DENIED
    try {
      businessDnaManager.bindBlueprintToDbk(
        schoolAdminCtx,
        'tenant_school_a',
        'Invalid School',
        'non_existent_blueprint_xyz',
        '1.0.0'
      );
      results.push({
        id: 'P1_TEST_05',
        name: 'Unknown Blueprint Binding Rejection',
        category: 'VALIDATION',
        expected: 'Binding REJECTED due to unknown blueprint',
        actual: 'Binding ALLOWED unexpectedly',
        passed: false,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_05',
        name: 'Unknown Blueprint Binding Rejection',
        category: 'VALIDATION',
        expected: 'Binding REJECTED due to unknown blueprint',
        actual: `Binding DENIED: ${(err as Error).message}`,
        passed: true,
      });
    }

    // 6. Invalid Blueprint version -> DENIED
    try {
      businessDnaManager.bindBlueprintToDbk(
        schoolAdminCtx,
        'tenant_school_a',
        'Invalid Version School',
        'school_v1',
        '99.99.99'
      );
      results.push({
        id: 'P1_TEST_06',
        name: 'Invalid Blueprint Version Rejection',
        category: 'VALIDATION',
        expected: 'Binding REJECTED due to unregistered version',
        actual: 'Binding ALLOWED unexpectedly',
        passed: false,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_06',
        name: 'Invalid Blueprint Version Rejection',
        category: 'VALIDATION',
        expected: 'Binding REJECTED due to unregistered version',
        actual: `Binding DENIED: ${(err as Error).message}`,
        passed: true,
      });
    }

    // 7. Business DNA missing required identity -> DENIED
    try {
      const invalidValidation = BlueprintValidator.validateBusinessDna({
        dbkId: 'tenant_incomplete',
        identity: undefined,
      });
      results.push({
        id: 'P1_TEST_07',
        name: 'Business DNA Missing Required Identity',
        category: 'VALIDATION',
        expected: 'Validation FAIL with missing identity error',
        actual: invalidValidation.valid ? 'Validation PASSED unexpectedly' : `Validation FAILED as expected: ${invalidValidation.errors.join('; ')}`,
        passed: !invalidValidation.valid,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_07',
        name: 'Business DNA Missing Required Identity',
        category: 'VALIDATION',
        expected: 'Validation FAIL with missing identity error',
        actual: `Error: ${(err as Error).message}`,
        passed: true,
      });
    }

    // 8. DBK-A cannot read DBK-B Business DNA -> DENIED
    try {
      businessDnaManager.getBusinessDna(schoolAdminCtx, 'tenant_hardware_b');
      results.push({
        id: 'P1_TEST_08',
        name: 'Cross-Tenant Read Isolation (DBK-A -> DBK-B)',
        category: 'TENANT_ISOLATION',
        expected: 'Cross-tenant read DENIED',
        actual: 'Cross-tenant read ALLOWED unexpectedly',
        passed: false,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_08',
        name: 'Cross-Tenant Read Isolation (DBK-A -> DBK-B)',
        category: 'TENANT_ISOLATION',
        expected: 'Cross-tenant read DENIED',
        actual: `Cross-tenant read DENIED: ${(err as Error).message}`,
        passed: true,
      });
    }

    // 9. DBK-A cannot modify DBK-B Business DNA -> DENIED
    try {
      const hardwareDna = businessDnaManager.getBusinessDna(hardwareAdminCtx, 'tenant_hardware_b');
      hardwareDna.scale = 'ENTERPRISE';
      businessDnaManager.saveBusinessDna(schoolAdminCtx, hardwareDna);
      results.push({
        id: 'P1_TEST_09',
        name: 'Cross-Tenant Modification Isolation (DBK-A -> DBK-B)',
        category: 'TENANT_ISOLATION',
        expected: 'Cross-tenant modification DENIED',
        actual: 'Cross-tenant modification ALLOWED unexpectedly',
        passed: false,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_09',
        name: 'Cross-Tenant Modification Isolation (DBK-A -> DBK-B)',
        category: 'TENANT_ISOLATION',
        expected: 'Cross-tenant modification DENIED',
        actual: `Cross-tenant modification DENIED: ${(err as Error).message}`,
        passed: true,
      });
    }

    // 10. Blueprint compilation produces deterministic output
    try {
      const compilation1 = await blueprintCompiler.compileWorkspace(schoolAdminCtx, 'tenant_school_a');
      const compilation2 = await blueprintCompiler.compileWorkspace(schoolAdminCtx, 'tenant_school_a');
      const isHashIdentical = compilation1.hash === compilation2.hash;
      results.push({
        id: 'P1_TEST_10',
        name: 'Deterministic Blueprint Workspace Compilation',
        category: 'COMPILER',
        expected: 'Identical hash produced for consecutive compilations',
        actual: `Hash 1: ${compilation1.hash} | Hash 2: ${compilation2.hash}`,
        passed: isHashIdentical,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_10',
        name: 'Deterministic Blueprint Workspace Compilation',
        category: 'COMPILER',
        expected: 'Identical hash produced for consecutive compilations',
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 11. School Blueprint produces school-specific terminology
    try {
      const schoolWorkspace = await blueprintCompiler.compileWorkspace(schoolAdminCtx, 'tenant_school_a');
      const studentTerm = schoolWorkspace.terminology['customer'];
      const isSchoolTerm = studentTerm?.singular === 'Student' && studentTerm?.plural === 'Students';
      results.push({
        id: 'P1_TEST_11',
        name: 'School Blueprint Specific Terminology',
        category: 'TERMINOLOGY',
        expected: "Customer mapped to 'Student / Students'",
        actual: `Customer term: ${JSON.stringify(studentTerm)}`,
        passed: isSchoolTerm,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_11',
        name: 'School Blueprint Specific Terminology',
        category: 'TERMINOLOGY',
        expected: "Customer mapped to 'Student / Students'",
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 12. Hardware Blueprint produces hardware-specific terminology
    try {
      const hardwareWorkspace = await blueprintCompiler.compileWorkspace(hardwareAdminCtx, 'tenant_hardware_b');
      const contractorTerm = hardwareWorkspace.terminology['customer'];
      const isHardwareTerm = contractorTerm?.singular?.includes('Contractor') && contractorTerm?.plural?.includes('Contractors');
      results.push({
        id: 'P1_TEST_12',
        name: 'Hardware Blueprint Specific Terminology',
        category: 'TERMINOLOGY',
        expected: "Customer mapped to 'Customer / Contractor'",
        actual: `Customer term: ${JSON.stringify(contractorTerm)}`,
        passed: isHardwareTerm,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_12',
        name: 'Hardware Blueprint Specific Terminology',
        category: 'TERMINOLOGY',
        expected: "Customer mapped to 'Customer / Contractor'",
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 13. Logistics Blueprint produces logistics-specific terminology
    try {
      const logisticsWorkspace = await blueprintCompiler.compileWorkspace(logisticsAdminCtx, 'tenant_logistics_d');
      const waybillTerm = logisticsWorkspace.terminology['contract'];
      const isWaybill = waybillTerm?.singular?.includes('Waybill') || waybillTerm?.singular?.includes('Consignment');
      results.push({
        id: 'P1_TEST_13',
        name: 'Logistics Blueprint Specific Terminology',
        category: 'TERMINOLOGY',
        expected: "Contract mapped to 'Consignment Note / Waybill'",
        actual: `Contract term: ${JSON.stringify(waybillTerm)}`,
        passed: isWaybill,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_13',
        name: 'Logistics Blueprint Specific Terminology',
        category: 'TERMINOLOGY',
        expected: "Contract mapped to 'Consignment Note / Waybill'",
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 14. Disabled capability is not compiled as enabled
    try {
      const schoolDna = businessDnaManager.getBusinessDna(schoolAdminCtx, 'tenant_school_a');
      // Ensure 'library_sys' is NOT in enabled capabilities
      schoolDna.enabledCapabilityIds = schoolDna.enabledCapabilityIds.filter((id) => id !== 'library_sys');
      businessDnaManager.saveBusinessDna(schoolAdminCtx, schoolDna);

      const schoolWorkspace = await blueprintCompiler.compileWorkspace(schoolAdminCtx, 'tenant_school_a');
      const libraryCap = schoolWorkspace.enabledCapabilities.find((c) => c.id === 'library_sys');
      
      results.push({
        id: 'P1_TEST_14',
        name: 'Disabled Capability Excluded From Operational Capabilities',
        category: 'DISCOVERY_PRINCIPLE',
        expected: 'library_sys capability absent from enabledCapabilities',
        actual: libraryCap ? 'library_sys found in enabledCapabilities unexpectedly' : 'library_sys absent from enabledCapabilities as expected',
        passed: !libraryCap,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_14',
        name: 'Disabled Capability Excluded From Operational Capabilities',
        category: 'DISCOVERY_PRINCIPLE',
        expected: 'library_sys capability absent from enabledCapabilities',
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 15. Discoverable capability is visible as available/discoverable but not operational
    try {
      const schoolWorkspace = await blueprintCompiler.compileWorkspace(schoolAdminCtx, 'tenant_school_a');
      const libraryDiscoverable = schoolWorkspace.discoverableCapabilities.find((c) => c.id === 'library_sys');
      const isDiscoverableNotEnabled = libraryDiscoverable && libraryDiscoverable.status === 'DISCOVERABLE';
      results.push({
        id: 'P1_TEST_15',
        name: 'Enforce DISCOVERABLE != ENABLED Principle',
        category: 'DISCOVERY_PRINCIPLE',
        expected: 'library_sys present in discoverableCapabilities with status DISCOVERABLE',
        actual: libraryDiscoverable ? `Found in discoverableCapabilities (Status: ${libraryDiscoverable.status})` : 'Not found in discoverableCapabilities',
        passed: !!isDiscoverableNotEnabled,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_15',
        name: 'Enforce DISCOVERABLE != ENABLED Principle',
        category: 'DISCOVERY_PRINCIPLE',
        expected: 'library_sys present in discoverableCapabilities with status DISCOVERABLE',
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 16. Branch topology compiles correctly
    try {
      const hardwareDna = businessDnaManager.getBusinessDna(hardwareAdminCtx, 'tenant_hardware_b');
      hardwareDna.branchTopology = {
        type: 'MULTI_BRANCH',
        branches: [
          { branchId: 'tenant_hardware_b_hq', name: 'Mombasa Road Main Yard', isHeadquarters: true, code: 'HQ', status: 'ACTIVE' },
          { branchId: 'tenant_hardware_b_branch2', name: 'Industrial Area Branch', isHeadquarters: false, code: 'BR2', status: 'ACTIVE' },
        ],
      };
      businessDnaManager.saveBusinessDna(hardwareAdminCtx, hardwareDna);

      const hardwareWorkspace = await blueprintCompiler.compileWorkspace(hardwareAdminCtx, 'tenant_hardware_b');
      const isMultiBranchCorrect =
        hardwareWorkspace.branchSummary.totalBranches === 2 &&
        hardwareWorkspace.branchSummary.type === 'MULTI_BRANCH' &&
        hardwareWorkspace.branchSummary.hqBranchId === 'tenant_hardware_b_hq';

      results.push({
        id: 'P1_TEST_16',
        name: 'Multi-Branch Topology Compilation',
        category: 'TOPOLOGY',
        expected: 'Total branches: 2, Type: MULTI_BRANCH, HQ: tenant_hardware_b_hq',
        actual: `Branches: ${hardwareWorkspace.branchSummary.totalBranches}, Type: ${hardwareWorkspace.branchSummary.type}, HQ: ${hardwareWorkspace.branchSummary.hqBranchId}`,
        passed: isMultiBranchCorrect,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_16',
        name: 'Multi-Branch Topology Compilation',
        category: 'TOPOLOGY',
        expected: 'Total branches: 2, Type: MULTI_BRANCH, HQ: tenant_hardware_b_hq',
        actual: `Error: ${(err as Error).message}`,
        passed: false,
      });
    }

    // 17. Blueprint update does not silently mutate an existing DBK binding
    try {
      businessDnaManager.bindBlueprintToDbk(
        schoolAdminCtx,
        'tenant_school_a',
        'St. Andrew Academy',
        'hardware_v1', // Attempting silent switch to hardware blueprint
        '1.0.0'
      );
      results.push({
        id: 'P1_TEST_17',
        name: 'Silent Blueprint Mutation Restriction',
        category: 'VERSIONING_MUTATION',
        expected: 'Silent blueprint switch DENIED',
        actual: 'Silent blueprint switch ALLOWED unexpectedly',
        passed: false,
      });
    } catch (err: unknown) {
      results.push({
        id: 'P1_TEST_17',
        name: 'Silent Blueprint Mutation Restriction',
        category: 'VERSIONING_MUTATION',
        expected: 'Silent blueprint switch DENIED',
        actual: `Mutation DENIED: ${(err as Error).message}`,
        passed: true,
      });
    }

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      passedCount,
      failedCount,
      totalCount: results.length,
      results,
    };
  }
}
