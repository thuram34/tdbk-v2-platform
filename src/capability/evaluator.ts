/**
 * SERVER-AUTHORITATIVE CAPABILITY ACTIVATION EVALUATOR
 * Architectural Layer: LEVEL 4 — CAPABILITY & ENTITLEMENT ENGINE
 * Performs explicit, server-driven activation evaluation without trusting client assertions.
 */

import { SecurityContext } from '../kernel/types';
import { auditLogger } from '../kernel/audit/auditLogger';
import { businessDnaManager } from '../blueprint/dnaManager';
import { capabilityRegistry } from './registry';
import { entitlementEngine } from './entitlement';
import { dependencyEngine } from './dependencyEngine';
import { dbkCapabilityManager } from './dbkCapabilityManager';
import { ActivationDecision } from './types';

export class ActivationEvaluatorService {
  /**
   * Evaluates if a DBK is eligible to activate a specified capability.
   */
  public evaluateActivation(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string
  ): ActivationDecision {
    const cap = capabilityRegistry.getCapability(capabilityId);
    if (!cap) {
      return {
        allowed: false,
        outcome: 'DENIED',
        message: `Capability '${capabilityId}' is not registered in TDBK platform`,
        capabilityId,
        dbkId,
      };
    }

    // 1. Check Platform Lifecycle Status
    if (cap.lifecycleStatus === 'SUSPENDED') {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        securityContext.principal.id,
        'CAPABILITY_ACCESS_DENIED',
        `capability:${capabilityId}`,
        'DENIED',
        {
          tenantId: dbkId,
          requestId: securityContext.requestId,
          details: { error: `Capability '${capabilityId}' is suspended platform-wide` },
        }
      );
      return {
        allowed: false,
        outcome: 'SUSPENDED',
        message: `Capability '${cap.name}' is currently suspended platform-wide by TDBK Master`,
        capabilityId,
        dbkId,
      };
    }

    // 2. Check Blueprint Sector Compatibility
    const dna = businessDnaManager.getBusinessDna(securityContext, dbkId);
    const sector = dna.identity.businessType as any;

    const isBlueprintSupported =
      (cap.supportedBlueprints as string[]).includes('ALL') ||
      (cap.supportedBlueprints as string[]).includes(sector as string);

    if (!isBlueprintSupported) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        securityContext.principal.id,
        'CAPABILITY_ACCESS_DENIED',
        `capability:${capabilityId}`,
        'DENIED',
        {
          tenantId: dbkId,
          requestId: securityContext.requestId,
          details: { error: `Capability '${capabilityId}' is not supported by Blueprint sector '${sector}'` },
        }
      );
      return {
        allowed: false,
        outcome: 'BLUEPRINT_UNSUPPORTED',
        message: `Capability '${cap.name}' is not compatible with DBK Blueprint sector '${sector}'`,
        capabilityId,
        dbkId,
      };
    }

    // 3. Check Subscription Tier Entitlement
    const entitlementStatus = entitlementEngine.evaluateEntitlement(dbkId, cap);
    if (entitlementStatus === 'UPGRADE_REQUIRED') {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        securityContext.principal.id,
        'CAPABILITY_UPGRADE_REQUIRED',
        `capability:${capabilityId}`,
        'DENIED',
        {
          tenantId: dbkId,
          requestId: securityContext.requestId,
          details: { requiredTier: cap.entitlementRequirements.minimumTier },
        }
      );
      return {
        allowed: false,
        outcome: 'UPGRADE_REQUIRED',
        message: `Subscription upgrade required: Capability '${cap.name}' requires tier '${cap.entitlementRequirements.minimumTier}' or higher`,
        capabilityId,
        dbkId,
        requiredTier: cap.entitlementRequirements.minimumTier,
      };
    }

    // 4. Check Capability Dependencies
    const existingRecords = dbkCapabilityManager.getDbkCapabilityRecords(securityContext, dbkId);
    const enabledCapIds = existingRecords
      .filter((r) => r.state === 'ENABLED' || r.state === 'CONFIGURED')
      .map((r) => r.capabilityId);

    const depEval = dependencyEngine.evaluateDependencies(cap, enabledCapIds);
    if (!depEval.valid) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        securityContext.principal.id,
        'CAPABILITY_DEPENDENCY_REQUIRED',
        `capability:${capabilityId}`,
        'DENIED',
        {
          tenantId: dbkId,
          requestId: securityContext.requestId,
          details: { missingDependencies: depEval.missingDependencies },
        }
      );
      return {
        allowed: false,
        outcome: 'DEPENDENCY_REQUIRED',
        message: `Missing prerequisites: Capability '${cap.name}' requires dependencies [${depEval.missingDependencies.join(', ')}]`,
        capabilityId,
        dbkId,
        missingDependencies: depEval.missingDependencies,
      };
    }

    // 5. Check Configuration Requirement
    const existingRec = dbkCapabilityManager.getDbkCapabilityRecord(securityContext, dbkId, capabilityId);
    if (cap.configurationSchema.requiresConfiguration && (!existingRec || !existingRec.configurationState.isConfigured)) {
      return {
        allowed: true,
        outcome: 'CONFIGURATION_REQUIRED',
        message: `Capability '${cap.name}' is entitled and eligible, but requires setup configuration before becoming fully operational`,
        capabilityId,
        dbkId,
      };
    }

    // 6. Allowed
    auditLogger.logEvent(
      'AUTHORIZATION_ALLOWED',
      securityContext.principal.id,
      'CAPABILITY_ENTITLEMENT_EVALUATED',
      `capability:${capabilityId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: securityContext.requestId,
        details: { capabilityId, outcome: 'ALLOWED' },
      }
    );

    return {
      allowed: true,
      outcome: 'ALLOWED',
      message: `Capability '${cap.name}' is fully entitled and eligible for activation`,
      capabilityId,
      dbkId,
    };
  }
}

export const activationEvaluator = new ActivationEvaluatorService();
