/**
 * CAPABILITY ENTITLEMENT & SUBSCRIPTION TIER ENGINE
 * Architectural Layer: LEVEL 4 — CAPABILITY & ENTITLEMENT ENGINE
 * Evaluates subscription tier eligibility and separates commercial entitlement from technical execution.
 */

import { SubscriptionTier, EntitlementStatus, CapabilityDefinition } from './types';
import { capabilityRegistry } from './registry';

export class EntitlementEngineService {
  private static readonly TIER_HIERARCHY: Record<SubscriptionTier, number> = {
    FREE: 5,
    FOUNDATION: 10,
    GROWTH: 20,
    PRO: 30,
    ENTERPRISE: 40,
  };

  private dbkSubscriptionStore: Map<string, SubscriptionTier> = new Map();

  /**
   * Sets the subscription tier for a DBK.
   */
  public setDbkSubscriptionTier(dbkId: string, tier: SubscriptionTier): void {
    this.dbkSubscriptionStore.set(dbkId, tier);
  }

  /**
   * Retrieves the subscription tier for a DBK (defaults to FOUNDATION).
   */
  public getDbkSubscriptionTier(dbkId: string): SubscriptionTier {
    return this.dbkSubscriptionStore.get(dbkId) || 'FOUNDATION';
  }

  /**
   * Checks if current subscription tier meets or exceeds required minimum tier.
   */
  public isTierSatisfied(currentTier: SubscriptionTier, minimumTier: SubscriptionTier): boolean {
    const currentLevel = EntitlementEngineService.TIER_HIERARCHY[currentTier] || 10;
    const requiredLevel = EntitlementEngineService.TIER_HIERARCHY[minimumTier] || 10;
    return currentLevel >= requiredLevel;
  }

  /**
   * Evaluates entitlement status for a capability given a DBK's current subscription tier.
   */
  public evaluateEntitlement(dbkId: string, capability: CapabilityDefinition | string): EntitlementStatus {
    let capDef: CapabilityDefinition | undefined;
    if (typeof capability === 'string') {
      capDef = capabilityRegistry.getCapability(capability) || undefined;
    } else {
      capDef = capability;
    }
    const currentTier = this.getDbkSubscriptionTier(dbkId);
    const minimumTier = capDef?.entitlementRequirements?.minimumTier || 'FOUNDATION';

    if (this.isTierSatisfied(currentTier, minimumTier)) {
      return 'ENTITLED';
    }
    return 'UPGRADE_REQUIRED';
  }

  /**
   * Clears subscription store for automated testing.
   */
  public clearStoreForTesting(): void {
    this.dbkSubscriptionStore.clear();
  }
}

export const entitlementEngine = new EntitlementEngineService();
