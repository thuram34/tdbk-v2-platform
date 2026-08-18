/**
 * CAPABILITY DEPENDENCY ENGINE
 * Architectural Layer: LEVEL 4 — CAPABILITY & ENTITLEMENT ENGINE
 * Evaluates dependency graphs, detects missing prerequisites, and enforces circular dependency guards.
 */

import { CapabilityDefinition } from './types';
import { capabilityRegistry } from './registry';

export class DependencyEngineService {
  /**
   * Evaluates if a capability's required dependencies are present in the list of currently enabled capability IDs.
   */
  public evaluateDependencies(
    capability: CapabilityDefinition,
    enabledCapabilityIds: string[]
  ): { valid: boolean; missingDependencies: string[]; errors: string[] } {
    const missingDependencies: string[] = [];
    const errors: string[] = [];

    if (!capability.dependencies || capability.dependencies.length === 0) {
      return { valid: true, missingDependencies: [], errors: [] };
    }

    const enabledSet = new Set(enabledCapabilityIds);

    for (const depId of capability.dependencies) {
      if (!enabledSet.has(depId)) {
        missingDependencies.push(depId);
        const depCap = capabilityRegistry.getCapability(depId);
        const depName = depCap ? depCap.name : depId;
        errors.push(`Missing required dependency: '${depName}' (${depId})`);
      }
    }

    return {
      valid: missingDependencies.length === 0,
      missingDependencies,
      errors,
    };
  }

  /**
   * Detects circular dependencies for a given capability definition using DFS.
   */
  public detectCircularDependencies(
    capability: CapabilityDefinition,
    allCapabilities: CapabilityDefinition[] = capabilityRegistry.getAllCapabilities()
  ): { hasCircular: boolean; cycle: string[] } {
    const capMap = new Map<string, CapabilityDefinition>();
    for (const c of allCapabilities) {
      capMap.set(c.capabilityId, c);
    }
    capMap.set(capability.capabilityId, capability);

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (currId: string): boolean => {
      visited.add(currId);
      recStack.add(currId);
      path.push(currId);

      const cap = capMap.get(currId);
      if (cap && cap.dependencies) {
        for (const depId of cap.dependencies) {
          if (!visited.has(depId)) {
            if (dfs(depId)) return true;
          } else if (recStack.has(depId)) {
            path.push(depId);
            return true;
          }
        }
      }

      recStack.delete(currId);
      path.pop();
      return false;
    };

    const hasCircular = dfs(capability.capabilityId);
    return {
      hasCircular,
      cycle: hasCircular ? [...path] : [],
    };
  }
}

export const dependencyEngine = new DependencyEngineService();
