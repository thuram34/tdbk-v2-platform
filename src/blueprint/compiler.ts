/**
 * BLUEPRINT COMPILER
 * Architectural Layer: LEVEL 3 — BLUEPRINT / BUSINESS DNA
 * Compiles a DBK's Identity, Blueprint, and Business DNA into a deterministic Operational Workspace Definition.
 */

import {
  Blueprint,
  BusinessDNA,
  CompiledWorkspace,
  CompiledDomain,
  CompiledCapabilitySummary,
  CompiledDomainCapability,
} from './types';
import { SecurityContext } from '../kernel/types';
import { blueprintRegistry } from './registry';
import { businessDnaManager } from './dnaManager';
import { auditLogger } from '../kernel/audit/auditLogger';

export class BlueprintCompiler {
  private static instance: BlueprintCompiler;

  private constructor() {}

  public static getInstance(): BlueprintCompiler {
    if (!BlueprintCompiler.instance) {
      BlueprintCompiler.instance = new BlueprintCompiler();
    }
    return BlueprintCompiler.instance;
  }

  /**
   * Compiles an operational workspace definition for a given DBK.
   */
  public compileWorkspace(securityContext: SecurityContext, dbkId: string): CompiledWorkspace {
    // 1. Fetch Business DNA for target DBK (enforces tenant security & access controls)
    const dna = businessDnaManager.getBusinessDna(securityContext, dbkId);

    // 2. Resolve target Blueprint from Registry
    const blueprint = blueprintRegistry.getBlueprint(
      dna.identity.blueprintId,
      dna.identity.blueprintVersion
    );

    if (!blueprint) {
      throw new Error(
        `Blueprint Compiler Error: Blueprint '${dna.identity.blueprintId}' v${dna.identity.blueprintVersion} not found in registry`
      );
    }

    // 3. Perform Compilation
    const workspace = this.compileFromBlueprintAndDna(blueprint, dna);

    auditLogger.logEvent(
      'AUTHORIZATION_ALLOWED',
      securityContext.principal.id,
      'compileWorkspace',
      `dbk:${dbkId}`,
      'ALLOWED',
      {
        tenantId: securityContext.principal.tenantId,
        requestId: securityContext.requestId,
        details: {
          blueprintId: blueprint.id,
          hash: workspace.hash,
          enabledCapsCount: workspace.enabledCapabilities.length,
          discoverableCapsCount: workspace.discoverableCapabilities.length,
        },
      }
    );

    return workspace;
  }

  /**
   * Deterministic core compilation logic.
   * Given the same Blueprint and Business DNA, produces the exact same workspace definition.
   */
  public compileFromBlueprintAndDna(blueprint: Blueprint, dna: BusinessDNA): CompiledWorkspace {
    const enabledSet = new Set(dna.enabledCapabilityIds || []);

    // Map all capabilities supported by the Blueprint
    const allSupportedCaps = blueprint.supportedCapabilities || [];
    
    const enabledCapabilities: CompiledCapabilitySummary[] = [];
    const discoverableCapabilities: CompiledCapabilitySummary[] = [];

    // Map capabilities into operational vs discoverable
    const capabilityStatusMap = new Map<string, CompiledDomainCapability>();

    allSupportedCaps.forEach((cap) => {
      const isEnabled = enabledSet.has(cap.id);
      const status: 'OPERATIONAL' | 'DISCOVERABLE' = isEnabled ? 'OPERATIONAL' : 'DISCOVERABLE';

      const compiledCap: CompiledDomainCapability = {
        id: cap.id,
        name: cap.name,
        category: cap.category,
        status,
        isEnabled,
        isDiscoverable: true, // Supported by blueprint, so discoverable
      };

      capabilityStatusMap.set(cap.id, compiledCap);

      const summary: CompiledCapabilitySummary = {
        id: cap.id,
        name: cap.name,
        category: cap.category,
        status,
      };

      if (isEnabled) {
        enabledCapabilities.push(summary);
      } else {
        discoverableCapabilities.push(summary);
      }
    });

    // Compile Domains
    const compiledDomains: CompiledDomain[] = blueprint.domains.map((domain) => {
      const domainCaps: CompiledDomainCapability[] = domain.supportedCapabilityIds
        .map((capId) => capabilityStatusMap.get(capId))
        .filter((c): c is CompiledDomainCapability => c !== undefined);

      return {
        id: domain.id,
        name: domain.name,
        description: domain.description,
        displayOrder: domain.displayOrder,
        capabilities: domainCaps,
      };
    });

    // Sort domains by display order
    compiledDomains.sort((a, b) => a.displayOrder - b.displayOrder);

    // Branch Summary
    const hqBranch = dna.branchTopology.branches.find((b) => b.isHeadquarters);
    const branchSummary = {
      totalBranches: dna.branchTopology.branches.length,
      hqBranchId: hqBranch ? hqBranch.branchId : dna.branchTopology.branches[0]?.branchId || 'HQ',
      type: dna.branchTopology.type,
      branches: dna.branchTopology.branches.map((b) => ({
        branchId: b.branchId,
        name: b.name,
        isHQ: b.isHeadquarters,
      })),
    };

    // Calculate Deterministic Hash
    const rawContentToHash = JSON.stringify({
      dbkId: dna.dbkId,
      blueprintId: blueprint.id,
      blueprintVersion: blueprint.version,
      enabledCapabilityIds: Array.from(enabledSet).sort(),
      branches: branchSummary,
      terminology: blueprint.terminology,
    });

    const hash = this.simpleHash(rawContentToHash);

    return {
      dbkId: dna.dbkId,
      businessName: dna.identity.businessName,
      blueprint: {
        id: blueprint.id,
        version: blueprint.version,
        name: blueprint.name,
        sector: blueprint.sector,
      },
      terminology: blueprint.terminology,
      domains: compiledDomains,
      enabledCapabilities,
      discoverableCapabilities,
      branchSummary,
      defaultRoles: blueprint.defaultRoles,
      compiledAt: new Date().toISOString(),
      hash,
    };
  }

  /**
   * Deterministic string hashing helper.
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `hash_v1_${Math.abs(hash).toString(16)}`;
  }
}

export const blueprintCompiler = BlueprintCompiler.getInstance();
