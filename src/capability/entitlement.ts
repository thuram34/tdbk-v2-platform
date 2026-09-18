/**
 * CAPABILITY ENTITLEMENT & SUBSCRIPTION TIER ENGINE
 * Architectural Layer: LEVEL 4 — CAPABILITY & ENTITLEMENT ENGINE
 * Evaluates subscription tier eligibility and separates commercial entitlement from technical execution.
 */

import { SubscriptionTier, EntitlementStatus, CapabilityDefinition } from './types';
import { capabilityRegistry } from './registry';
import { dbkRegistry } from '../platform/dbkRegistry';

export class EntitlementEngineService {
  private static readonly TIER_HIERARCHY: Record<SubscriptionTier, number> = {
    FREE: 5,
    FOUNDATION: 10,
    GROWTH: 20,
    PRO: 30,
    ENTERPRISE: 40,
  };

  private dbkSubscriptionStore: Map<string, SubscriptionTier> = new Map();

  /** Legacy test-only setter. Production entitlement is stored on the durable DBK identity. */
  public setDbkSubscriptionTier(dbkId: string, tier: SubscriptionTier): void {
    this.dbkSubscriptionStore.set(dbkId, tier);
  }

  /** Legacy synchronous accessor retained for deterministic tests. */
  public getDbkSubscriptionTier(dbkId: string): SubscriptionTier {
    return this.dbkSubscriptionStore.get(dbkId) || 'FOUNDATION';
  }

  /** Authoritative production read. Process memory is never the source of truth. */
  public async getPersistentDbkSubscriptionTier(dbkId: string): Promise<SubscriptionTier> {
    const dbk = await dbkRegistry.getDbkInternal(dbkId);
    return dbk?.subscriptionTier || 'FOUNDATION';
  }

  /** Authoritative production entitlement evaluation. */
  public async evaluatePersistentEntitlement(
    dbkId: string,
    capability: CapabilityDefinition | string
  ): Promise<EntitlementStatus> {
    const capDef = typeof capability === 'string'
      ? capabilityRegistry.getCapability(capability) || undefined
      : capability;
    const currentTier = await this.getPersistentDbkSubscriptionTier(dbkId);
    const minimumTier = capDef?.entitlementRequirements?.minimumTier || 'FOUNDATION';
    return this.isTierSatisfied(currentTier, minimumTier) ? 'ENTITLED' : 'UPGRADE_REQUIRED';
  }

  public isTierSatisfied(currentTier: SubscriptionTier, minimumTier: SubscriptionTier): boolean {
    const currentLevel = EntitlementEngineService.TIER_HIERARCHY[currentTier] || 10;
    const requiredLevel = EntitlementEngineService.TIER_HIERARCHY[minimumTier] || 10;
    return currentLevel >= requiredLevel;
  }

  /** Legacy synchronous evaluation retained for deterministic tests. */
  public evaluateEntitlement(dbkId: string, capability: CapabilityDefinition | string): EntitlementStatus {
    const capDef = typeof capability === 'string'
      ? capabilityRegistry.getCapability(capability) || undefined
      : capability;
    const currentTier = this.getDbkSubscriptionTier(dbkId);
    const minimumTier = capDef?.entitlementRequirements?.minimumTier || 'FOUNDATION';
    return this.isTierSatisfied(currentTier, minimumTier) ? 'ENTITLED' : 'UPGRADE_REQUIRED';
  }

  public clearStoreForTesting(): void {
    this.dbkSubscriptionStore.clear();
  }
}

export const entitlementEngine = new EntitlementEngineService();
