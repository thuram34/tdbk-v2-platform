/**
 * DISCOVERY ENGINE
 * Architectural Layer: LEVEL 4 — CAPABILITY & ENTITLEMENT ENGINE
 * Generates Blueprint-bounded discovery surfaces adhering strictly to DISCOVERABLE ≠ ENABLED.
 */

import { SecurityContext } from '../kernel/types';
import { auditLogger } from '../kernel/audit/auditLogger';
import { businessDnaManager } from '../blueprint/dnaManager';
import { capabilityRegistry } from './registry';
import { entitlementEngine } from './entitlement';
import { dependencyEngine } from './dependencyEngine';
import { dbkCapabilityManager } from './dbkCapabilityManager';
import { dbkRegistry } from '../platform/dbkRegistry';
import { DiscoverySurface, DiscoveryResultItem, CapabilityLifecycleState, EntitlementStatus } from './types';

export class DiscoveryEngineService {
  /**
   * Generates a Blueprint-bounded discovery surface for a DBK.
   */
  public async discoverCapabilitiesForDbk(securityContext: SecurityContext, dbkId: string): Promise<DiscoverySurface> {
    const dna = await businessDnaManager.getPersistentBusinessDna(securityContext, dbkId);
    const rawSector = dna.identity.businessType as string;
    const sector = (rawSector === 'SCHOOL' ? 'EDUCATION' : rawSector) as any;
    const subscriptionTier = await entitlementEngine.getPersistentDbkSubscriptionTier(dbkId);

    const allCaps = capabilityRegistry.getAllCapabilities();

    // 1. Filter Blueprint-compatible capabilities
    const compatibleCaps = allCaps.filter(
      (c) =>
        (c.supportedBlueprints as string[]).includes('ALL') ||
        (c.supportedBlueprints as string[]).includes(sector as string) ||
        (c.supportedBlueprints as string[]).includes(rawSector)
    );

    // Get current DBK capability records
    const records = await dbkCapabilityManager.hydratePersistentCapabilities(securityContext, dbkId);
    const recordMap = new Map(records.map((r) => [r.capabilityId, r]));

    const enabledCapIds = records
      .filter((r) => r.state === 'ENABLED' || r.state === 'CONFIGURED')
      .map((r) => r.capabilityId);

    const items: DiscoveryResultItem[] = await Promise.all(compatibleCaps.map(async (cap) => {
      const rec = recordMap.get(cap.capabilityId);

      // Entitlement status
      const entitlementStatus: EntitlementStatus = await entitlementEngine.evaluatePersistentEntitlement(dbkId, cap);

      // Dependency check
      const depEval = dependencyEngine.evaluateDependencies(cap, enabledCapIds);

      // Determine state
      let currentState: CapabilityLifecycleState = 'DISCOVERABLE';
      let rejectionReason: DiscoveryResultItem['rejectionReason'] = null;
      let isEligible = false;
      let explanation = '';

      if (cap.lifecycleStatus === 'SUSPENDED') {
        currentState = 'SUSPENDED';
        rejectionReason = 'SUSPENDED';
        explanation = `Capability '${cap.name}' is suspended platform-wide.`;
      } else if (rec?.state === 'SUSPENDED') {
        currentState = 'SUSPENDED';
        rejectionReason = 'SUSPENDED';
        explanation = `Capability '${cap.name}' is suspended for this DBK.`;
      } else if (rec?.state === 'CONFIGURED') {
        currentState = 'CONFIGURED';
        isEligible = true;
        explanation = `Capability '${cap.name}' is fully operational.`;
      } else if (rec?.state === 'ENABLED') {
        if (cap.configurationSchema.requiresConfiguration && !rec.configurationState.isConfigured) {
          currentState = 'ENABLED';
          rejectionReason = 'CONFIGURATION_REQUIRED';
          explanation = `Capability '${cap.name}' is enabled but requires setup configuration.`;
        } else {
          currentState = 'CONFIGURED';
          isEligible = true;
          explanation = `Capability '${cap.name}' is fully operational.`;
        }
      } else if (rec?.state === 'DISABLED') {
        currentState = 'DISABLED';
        explanation = `Capability '${cap.name}' was disabled by DBK Admin.`;
      } else if (entitlementStatus === 'UPGRADE_REQUIRED') {
        currentState = 'DISCOVERABLE';
        rejectionReason = 'UPGRADE_REQUIRED';
        explanation = `Requires subscription tier '${cap.entitlementRequirements.minimumTier}' or higher.`;
      } else if (!depEval.valid) {
        currentState = 'DISCOVERABLE';
        rejectionReason = 'DEPENDENCY_REQUIRED';
        explanation = `Requires missing prerequisite capabilities: [${depEval.missingDependencies.join(', ')}].`;
      } else {
        // Entitled and dependencies satisfied, but not enabled yet
        currentState = 'ENTITLED';
        isEligible = true;
        explanation = `Capability '${cap.name}' is eligible for activation.`;
      }

      return {
        capability: cap,
        currentState,
        entitlementStatus,
        isEligibleForActivation: isEligible,
        rejectionReason,
        missingDependencies: depEval.missingDependencies,
        explanation,
      };
    });

    auditLogger.logEvent(
      'AUTHORIZATION_ALLOWED',
      securityContext.principal.id,
      'CAPABILITY_DISCOVERED',
      `dbk:${dbkId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: securityContext.requestId,
        details: { totalDiscovered: items.length, sector, subscriptionTier },
      }
    );

    return {
      dbkId,
      blueprintId: dna.identity.blueprintId,
      blueprintSector: sector,
      subscriptionTier,
      items,
      availableCapabilities: items.map((i) => i.capability),
      evaluatedAt: new Date().toISOString(),
    };
  }
  /** Authoritative variant used by production request paths. */
  public async discoverPersistentCapabilitiesForDbk(
    securityContext: SecurityContext,
    dbkId: string
  ): Promise<DiscoverySurface> {
    const dna = await businessDnaManager.getPersistentBusinessDna(securityContext, dbkId);
    const rawSector = dna.identity.businessType as string;
    const sector = (rawSector === 'SCHOOL' ? 'EDUCATION' : rawSector) as any;
    const dbk = await dbkRegistry.getDbk(securityContext, dbkId);
    const subscriptionTier = dbk?.subscriptionTier || 'FOUNDATION';
    const allCaps = capabilityRegistry.getAllCapabilities();
    const compatibleCaps = allCaps.filter((cap) =>
      (cap.supportedBlueprints as string[]).includes('ALL') ||
      (cap.supportedBlueprints as string[]).includes(sector as string) ||
      (cap.supportedBlueprints as string[]).includes(rawSector)
    );
    const records = await dbkCapabilityManager.hydratePersistentCapabilities(securityContext, dbkId);
    const recordMap = new Map(records.map((record) => [record.capabilityId, record]));
    const enabledCapIds = records
      .filter((record) => record.state === 'ENABLED' || record.state === 'CONFIGURED')
      .map((record) => record.capabilityId);
    const items: DiscoveryResultItem[] = compatibleCaps.map((cap) => {
      const rec = recordMap.get(cap.capabilityId);
      const entitlementStatus: EntitlementStatus =
        entitlementEngine.isTierSatisfied(subscriptionTier, cap.entitlementRequirements.minimumTier)
          ? 'ENTITLED'
          : 'UPGRADE_REQUIRED';
      const depEval = dependencyEngine.evaluateDependencies(cap, enabledCapIds);
      let currentState: CapabilityLifecycleState = 'DISCOVERABLE';
      let rejectionReason: DiscoveryResultItem['rejectionReason'] = null;
      let isEligible = false;
      let explanation = '';
      if (cap.lifecycleStatus === 'SUSPENDED') {
        currentState = 'SUSPENDED'; rejectionReason = 'SUSPENDED';
        explanation = `Capability '${cap.name}' is suspended platform-wide.`;
      } else if (rec?.state === 'SUSPENDED') {
        currentState = 'SUSPENDED'; rejectionReason = 'SUSPENDED';
        explanation = `Capability '${cap.name}' is suspended for this DBK.`;
      } else if (rec?.state === 'CONFIGURED') {
        currentState = 'CONFIGURED'; isEligible = true;
        explanation = `Capability '${cap.name}' is fully operational.`;
      } else if (rec?.state === 'ENABLED') {
        if (cap.configurationSchema.requiresConfiguration && !rec.configurationState.isConfigured) {
          rejectionReason = 'CONFIGURATION_REQUIRED';
          explanation = `Capability '${cap.name}' is enabled but requires setup configuration.`;
        } else {
          currentState = 'CONFIGURED'; isEligible = true;
          explanation = `Capability '${cap.name}' is fully operational.`;
        }
      } else if (rec?.state === 'DISABLED') {
        currentState = 'DISABLED'; explanation = `Capability '${cap.name}' was disabled by DBK Admin.`;
      } else if (entitlementStatus === 'UPGRADE_REQUIRED') {
        rejectionReason = 'UPGRADE_REQUIRED';
        explanation = `Requires subscription tier '${cap.entitlementRequirements.minimumTier}' or higher.`;
      } else if (!depEval.valid) {
        rejectionReason = 'DEPENDENCY_REQUIRED';
        explanation = `Requires missing prerequisite capabilities: [${depEval.missingDependencies.join(', ')}].`;
      } else {
        currentState = 'ENTITLED'; isEligible = true;
        explanation = `Capability '${cap.name}' is eligible for activation.`;
      }
      return { capability: cap, currentState, entitlementStatus, isEligibleForActivation: isEligible,
        rejectionReason, missingDependencies: depEval.missingDependencies, explanation };
    });
    auditLogger.logEvent('AUTHORIZATION_ALLOWED', securityContext.principal.id, 'CAPABILITY_DISCOVERED',
      `dbk:${dbkId}`, 'ALLOWED', { tenantId: dbkId, requestId: securityContext.requestId,
      details: { totalDiscovered: items.length, sector, subscriptionTier } });
    return { dbkId, blueprintId: dna.identity.blueprintId, blueprintSector: sector,
      subscriptionTier, items, availableCapabilities: items.map((i) => i.capability),
      evaluatedAt: new Date().toISOString() };
  }

}

export const discoveryEngine = new DiscoveryEngineService();
