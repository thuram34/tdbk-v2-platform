/**
 * BLUEPRINT & BUSINESS DNA VALIDATOR
 * Architectural Layer: LEVEL 3 — BLUEPRINT / BUSINESS DNA
 * Provides strict validation for Blueprints, Business Identity, Business DNA, and cross-tenant access.
 */

import { Blueprint, BusinessDNA, BusinessIdentity, ValidationResult } from './types';
import { SecurityContext } from '../kernel/types';
import { blueprintRegistry } from './registry';

export class BlueprintValidator {
  /**
   * Validates a Blueprint definition structure.
   */
  public static validateBlueprint(blueprint: Partial<Blueprint>): ValidationResult {
    const errors: string[] = [];

    if (!blueprint.id || blueprint.id.trim() === '') {
      errors.push('Blueprint ID is required');
    }
    if (!blueprint.name || blueprint.name.trim() === '') {
      errors.push('Blueprint name is required');
    }
    if (!blueprint.version || blueprint.version.trim() === '') {
      errors.push('Blueprint version is required');
    }
    if (!blueprint.sector) {
      errors.push('Blueprint sector type is required');
    }
    if (!blueprint.domains || blueprint.domains.length === 0) {
      errors.push('Blueprint must contain at least one operational domain');
    }
    if (!blueprint.supportedCapabilities) {
      errors.push('Blueprint supportedCapabilities array is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates Business Identity completeness.
   */
  public static validateBusinessIdentity(identity: Partial<BusinessIdentity>): ValidationResult {
    const errors: string[] = [];

    if (!identity.dbkId || identity.dbkId.trim() === '') {
      errors.push('Business Identity requires a valid dbkId');
    }
    if (!identity.businessName || identity.businessName.trim() === '') {
      errors.push('Business Identity requires a valid businessName');
    }
    if (!identity.blueprintId || identity.blueprintId.trim() === '') {
      errors.push('Business Identity requires a valid blueprintId');
    }
    if (!identity.blueprintVersion || identity.blueprintVersion.trim() === '') {
      errors.push('Business Identity requires a valid blueprintVersion');
    }
    if (!identity.industry || identity.industry.trim() === '') {
      errors.push('Business Identity requires an industry specification');
    }

    // Check if blueprint exists in registry
    if (identity.blueprintId) {
      const exists = blueprintRegistry.hasBlueprint(identity.blueprintId, identity.blueprintVersion);
      if (!exists) {
        errors.push(`Blueprint '${identity.blueprintId}' with version '${identity.blueprintVersion || 'latest'}' is not registered`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates Business DNA completeness.
   */
  public static validateBusinessDna(dna: Partial<BusinessDNA>): ValidationResult {
    const errors: string[] = [];

    if (!dna.dbkId || dna.dbkId.trim() === '') {
      errors.push('Business DNA requires a valid dbkId');
    }

    if (!dna.identity) {
      errors.push('Business DNA missing required BusinessIdentity');
    } else {
      const identityVal = this.validateBusinessIdentity(dna.identity);
      if (!identityVal.valid) {
        errors.push(...identityVal.errors);
      }
    }

    if (!dna.branchTopology) {
      errors.push('Business DNA requires a branchTopology definition');
    } else if (!dna.branchTopology.branches || dna.branchTopology.branches.length === 0) {
      errors.push('Branch topology must contain at least one branch');
    } else {
      const hqCount = dna.branchTopology.branches.filter((b) => b.isHeadquarters).length;
      if (hqCount !== 1) {
        errors.push('Branch topology must contain exactly one Headquarters branch');
      }
    }

    if (!dna.enabledCapabilityIds || !Array.isArray(dna.enabledCapabilityIds)) {
      errors.push('Business DNA enabledCapabilityIds array is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Asserts tenant boundary for Business DNA operations.
   */
  public static assertTenantAccess(securityContext: SecurityContext, targetDbkId: string, actionName: string): void {
    if (!securityContext || !securityContext.principal) {
      throw new Error(`Security Exception: Unauthenticated access attempt during ${actionName}`);
    }

    const { principal } = securityContext;

    // Master Admins or Business Owners possess portfolio/platform-wide administrative authority
    if (principal.isMaster || (principal.roles || []).includes('BUSINESS_OWNER') || (principal.roles || []).includes('TDBK_MASTER_ADMIN')) {
      return;
    }

    // Tenant Isolation Assertion: User must belong to targetDbkId
    if (!principal.tenantId || principal.tenantId !== targetDbkId) {
      throw new Error(
        `Tenant Isolation Violation: Principal '${principal.id}' from tenant '${principal.tenantId}' cannot ${actionName} for DBK '${targetDbkId}'`
      );
    }
  }
}
