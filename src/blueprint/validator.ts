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
      // Persistence contract: /tenants/{tenantId}/... where tenantId === dbkId.
      // The nested identity must refer to the same business as the aggregate root.
      if (dna.dbkId && dna.identity.dbkId && dna.dbkId !== dna.identity.dbkId) {
        errors.push('Business DNA dbkId must match BusinessIdentity dbkId');
      }
    }

    if (!dna.branchTopology) {
      errors.push('Business DNA requires a branchTopology definition');
    } else if (!dna.branchTopology.branches || dna.branchTopology.branches.length === 0) {
      errors.push('Branch topology must contain at least one branch');
    } else {
      const branches = dna.branchTopology.branches;
      const hqCount = branches.filter((b) => b.isHeadquarters).length;
      if (hqCount !== 1) {
        errors.push('Branch topology must contain exactly one Headquarters branch');
      }

      const branchIds = branches.map((branch) => branch.branchId);
      if (branchIds.some((id) => !id || id.trim() === '')) {
        errors.push('Every branch must have a non-empty branchId');
      }
      if (new Set(branchIds).size !== branchIds.length) {
        errors.push('Branch topology must not contain duplicate branchId values');
      }
      if (branches.some((branch) => !branch.name || branch.name.trim() === '')) {
        errors.push('Every branch must have a non-empty name');
      }
      if (dna.branchTopology.type === 'SINGLE_BRANCH' && branches.length !== 1) {
        errors.push('SINGLE_BRANCH topology must contain exactly one branch');
      }
      if (dna.branchTopology.type === 'MULTI_BRANCH' && branches.length < 2) {
        errors.push('MULTI_BRANCH topology must contain at least two branches');
      }
    }

    if (!dna.enabledCapabilityIds || !Array.isArray(dna.enabledCapabilityIds)) {
      errors.push('Business DNA enabledCapabilityIds array is required');
    } else {
      if (dna.enabledCapabilityIds.some((id) => typeof id !== 'string' || id.trim() === '')) {
        errors.push('Business DNA capability IDs must be non-empty strings');
      }
      if (new Set(dna.enabledCapabilityIds).size !== dna.enabledCapabilityIds.length) {
        errors.push('Business DNA must not contain duplicate enabled capability IDs');
      }
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

    // Synchronous cache-backed methods cannot verify portfolio ownership against
    // the authoritative DBK Registry. Only the persistent path may grant a
    // Business Owner access to another business in their portfolio.
    const roles = Array.isArray(principal.roles) ? principal.roles : [];
    const isMasterAdmin = principal.isMaster === true && roles.includes('TDBK_MASTER_ADMIN');
    if (isMasterAdmin) {
      return;
    }

    // All non-master synchronous access is restricted to the exact tenant claim.
    // Business Owner role alone is not proof of ownership of the requested DBK.
    if (!principal.tenantId || principal.tenantId !== targetDbkId || roles.length === 0) {
      throw new Error(
        `Tenant Isolation Violation: Principal '${principal.id}' from tenant '${principal.tenantId}' cannot ${actionName} for DBK '${targetDbkId}'`
      );
    }
  }
}
