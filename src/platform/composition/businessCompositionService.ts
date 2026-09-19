import { SecurityContext } from '../../kernel/types';
import { blueprintRegistry } from '../../blueprint/registry';
import { capabilityRegistry } from '../../capability/registry';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { entitlementEngine } from '../../capability/entitlement';
import { CapabilityDefinition, CapabilityLifecycleState, EntitlementStatus } from '../../capability/types';
import { dbkRegistry } from '../dbkRegistry';

export type CompositionOutcome =
  | 'ENABLED'
  | 'ALREADY_ACTIVE'
  | 'WAITING_CONFIGURATION'
  | 'UPGRADE_REQUIRED'
  | 'DEPENDENCY_REQUIRED'
  | 'BLUEPRINT_UNSUPPORTED'
  | 'SUSPENDED';

export interface BusinessCompositionItem {
  capabilityId: string;
  name: string;
  requiredByBlueprint: boolean;
  dependencyOf?: string;
  currentState: CapabilityLifecycleState | null;
  entitlement: EntitlementStatus;
  outcome: CompositionOutcome;
  reason: string;
}

export interface BusinessCompositionPlan {
  dbkId: string;
  blueprintId: string;
  blueprintVersion: string;
  generatedAt: string;
  items: BusinessCompositionItem[];
  executableCapabilityIds: string[];
  summary: string;
}

export interface BusinessCompositionResult {
  plan: BusinessCompositionPlan;
  appliedCapabilityIds: string[];
}

export class BusinessCompositionService {
  public async plan(context: SecurityContext, dbkId: string): Promise<BusinessCompositionPlan> {
    const dbk = await dbkRegistry.getDbk(context, dbkId);
    if (!dbk) throw new Error(`DBK '${dbkId}' not found.`);

    const blueprint = blueprintRegistry.getBlueprint(dbk.blueprintId, dbk.blueprintVersion);
    if (!blueprint) throw new Error(`Blueprint '${dbk.blueprintId}' v${dbk.blueprintVersion} is not registered.`);

    const records = await dbkCapabilityManager.hydratePersistentCapabilities(context, dbkId);
    const byId = new Map(records.map((record) => [record.capabilityId, record]));
    const defaultIds = new Set(
      blueprint.supportedCapabilities.filter((capability) => capability.isDefault).map((capability) => capability.id),
    );

    // Compose the blueprint default set plus its transitive dependency closure.
    const requiredIds = new Set(defaultIds);
    const queue = [...defaultIds];
    while (queue.length) {
      const id = queue.shift()!;
      const definition = capabilityRegistry.getCapability(id);
      if (!definition) continue;
      for (const dependency of definition.dependencies) {
        if (!requiredIds.has(dependency)) {
          requiredIds.add(dependency);
          queue.push(dependency);
        }
      }
    }

    const items: BusinessCompositionItem[] = [];
    for (const capabilityId of requiredIds) {
      const definition = capabilityRegistry.getCapability(capabilityId);
      if (!definition) {
        items.push({
          capabilityId,
          name: capabilityId,
          requiredByBlueprint: defaultIds.has(capabilityId),
          currentState: byId.get(capabilityId)?.state || null,
          entitlement: 'UNENTITLED',
          outcome: 'BLUEPRINT_UNSUPPORTED',
          reason: `Capability '${capabilityId}' is referenced by the blueprint but is not registered in the platform capability registry.`,
        });
        continue;
      }

      const blueprintSupported =
        definition.supportedBlueprints.includes('ALL') ||
        definition.supportedBlueprints.includes(blueprint.sector) ||
        blueprint.supportedCapabilities.some((capability) => capability.id === capabilityId);

      const record = byId.get(capabilityId);
      const entitlement = await entitlementEngine.evaluatePersistentEntitlement(dbkId, definition);

      if (!blueprintSupported) {
        items.push(this.item(definition, defaultIds.has(capabilityId), record?.state || null, entitlement, 'BLUEPRINT_UNSUPPORTED',
          `Capability '${capabilityId}' is not supported by blueprint '${blueprint.id}'.`));
        continue;
      }

      if (record?.state === 'SUSPENDED') {
        items.push(this.item(definition, defaultIds.has(capabilityId), record.state, entitlement, 'SUSPENDED',
          `Capability '${capabilityId}' is suspended and requires explicit operational action.`));
        continue;
      }

      if (entitlement !== 'ENTITLED') {
        items.push(this.item(definition, defaultIds.has(capabilityId), record?.state || null, entitlement, 'UPGRADE_REQUIRED',
          `Subscription tier does not satisfy the minimum tier for '${capabilityId}'.`));
        continue;
      }

      const dependenciesReady = definition.dependencies.every((dependency) => {
        const dependencyRecord = byId.get(dependency);
        return dependencyRecord?.state === 'ENABLED' || dependencyRecord?.state === 'CONFIGURED';
      });

      if (!dependenciesReady) {
        const missing = definition.dependencies.filter((dependency) => {
          const dependencyRecord = byId.get(dependency);
          return dependencyRecord?.state !== 'ENABLED' && dependencyRecord?.state !== 'CONFIGURED';
        });
        items.push(this.item(definition, defaultIds.has(capabilityId), record?.state || null, entitlement, 'DEPENDENCY_REQUIRED',
          `Required dependencies are not active: ${missing.join(', ')}.`));
        continue;
      }

      if (record?.state === 'ENABLED' || record?.state === 'CONFIGURED') {
        items.push(this.item(definition, defaultIds.has(capabilityId), record.state, entitlement, 'ALREADY_ACTIVE',
          `Capability '${capabilityId}' is already active.`));
        continue;
      }

      if (definition.configurationSchema.requiresConfiguration) {
        items.push(this.item(definition, defaultIds.has(capabilityId), record?.state || null, entitlement, 'WAITING_CONFIGURATION',
          `Capability '${capabilityId}' is entitled but requires configuration before activation.`));
        continue;
      }

      items.push(this.item(definition, defaultIds.has(capabilityId), record?.state || null, entitlement, 'ENABLED',
        `Capability '${capabilityId}' is entitled, supported, dependency-ready, and safe to activate.`));
    }

    const executableCapabilityIds = items
      .filter((item) => item.outcome === 'ENABLED')
      .map((item) => item.capabilityId);

    return {
      dbkId,
      blueprintId: blueprint.id,
      blueprintVersion: blueprint.version,
      generatedAt: new Date().toISOString(),
      items,
      executableCapabilityIds,
      summary: executableCapabilityIds.length
        ? `Business composition found ${executableCapabilityIds.length} capability activation(s) for DBK '${dbkId}'; no existing capabilities will be disabled.`
        : `Business composition is converged for DBK '${dbkId}', or remaining capabilities require configuration, entitlement, dependencies, or explicit operational intervention.`,
    };
  }

  public async compose(context: SecurityContext, dbkId: string): Promise<BusinessCompositionResult> {
    let currentPlan = await this.plan(context, dbkId);
    const appliedCapabilityIds: string[] = [];
    const applied = new Set<string>();

    // Apply in dependency-ready passes. This lets the composition engine construct
    // dependency chains deterministically without bypassing the capability manager.
    for (let pass = 0; pass < 20 && currentPlan.executableCapabilityIds.length > 0; pass++) {
      const executable = currentPlan.executableCapabilityIds.filter((id) => !applied.has(id));
      if (executable.length === 0) break;

      for (const capabilityId of executable) {
        const definition = capabilityRegistry.getCapability(capabilityId);
        if (!definition) continue;
        await dbkCapabilityManager.enableCapabilityPersistent(
          context,
          dbkId,
          capabilityId,
          'ENTITLED',
          definition.configurationSchema.requiresConfiguration,
        );
        applied.add(capabilityId);
        appliedCapabilityIds.push(capabilityId);
      }

      currentPlan = await this.plan(context, dbkId);
    }

    const finalPlan = currentPlan;
    return { plan: finalPlan, appliedCapabilityIds };
  }

  private item(
    definition: CapabilityDefinition,
    requiredByBlueprint: boolean,
    currentState: CapabilityLifecycleState | null,
    entitlement: EntitlementStatus,
    outcome: CompositionOutcome,
    reason: string,
  ): BusinessCompositionItem {
    return {
      capabilityId: definition.capabilityId,
      name: definition.name,
      requiredByBlueprint,
      currentState,
      entitlement,
      outcome,
      reason,
    };
  }
}

export const businessCompositionService = new BusinessCompositionService();
