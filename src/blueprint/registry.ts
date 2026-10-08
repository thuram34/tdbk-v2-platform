/**
 * BLUEPRINT REGISTRY
 * Architectural Layer: LEVEL 3 — BLUEPRINT / BUSINESS DNA
 * Manages platform-level Blueprint definitions, catalog indexing, and versioning.
 */

import { Blueprint } from './types';
import { INITIAL_BLUEPRINT_CATALOG } from './catalog';

export class BlueprintRegistry {
  private static instance: BlueprintRegistry;
  private blueprints: Map<string, Blueprint> = new Map();

  private constructor() {
    this.initializeDefaultCatalog();
  }

  public static getInstance(): BlueprintRegistry {
    if (!BlueprintRegistry.instance) {
      BlueprintRegistry.instance = new BlueprintRegistry();
    }
    return BlueprintRegistry.instance;
  }

  /**
   * Initializes the registry with default sector blueprints.
   */
  private initializeDefaultCatalog(): void {
    INITIAL_BLUEPRINT_CATALOG.forEach((bp) => {
      this.registerBlueprint(bp);
    });
  }

  /**
   * Registers a blueprint into the platform registry.
   */
  public registerBlueprint(blueprint: Blueprint): void {
    const key = `${blueprint.id}@${blueprint.version}`;
    this.blueprints.set(key, blueprint);
    // Also store by ID as default/latest version
    this.blueprints.set(blueprint.id, blueprint);
  }

  private static readonly ALIAS_MAP: Record<string, string> = {
    school_fee_structure: 'school_v1',
    pos_register: 'retail_v1',
    inventory_catalog: 'hardware_v1',
    logistics_fleet: 'logistics_v1',
    clinic_patients: 'clinic_v1',
    hotel_booking: 'hotel_v1',
    salon_pos: 'salon_v1',
    legal_cases: 'prof_services_v1',
  };

  /**
   * Gets a blueprint by ID and optional version.
   */
  public getBlueprint(id: string, version?: string): Blueprint | undefined {
    let bp: Blueprint | undefined;
    if (version) {
      const exactKey = `${id}@${version}`;
      bp = this.blueprints.get(exactKey);
    } else {
      bp = this.blueprints.get(id);
    }
    if (!bp && BlueprintRegistry.ALIAS_MAP[id]) {
      const targetId = BlueprintRegistry.ALIAS_MAP[id];
      if (version) {
        bp = this.blueprints.get(`${targetId}@${version}`);
      } else {
        bp = this.blueprints.get(targetId);
      }
    }
    return bp ? JSON.parse(JSON.stringify(bp)) : undefined;
  }

  /**
   * Returns all registered unique blueprints (latest version per ID).
   */
  public getAllBlueprints(): Blueprint[] {
    const uniqueMap = new Map<string, Blueprint>();
    this.blueprints.forEach((bp, key) => {
      if (!key.includes('@')) {
        uniqueMap.set(bp.id, bp);
      }
    });
    return Array.from(uniqueMap.values());
  }

  /**
   * Checks if a blueprint exists.
   */
  public hasBlueprint(id: string, version?: string): boolean {
    return !!this.getBlueprint(id, version);
  }

  /**
   * Resets registry to default state (useful for test isolation).
   */
  public resetToDefault(): void {
    this.blueprints.clear();
    this.initializeDefaultCatalog();
  }
}

export const blueprintRegistry = BlueprintRegistry.getInstance();
