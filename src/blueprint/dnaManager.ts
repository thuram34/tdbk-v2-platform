/**
 * BUSINESS DNA MANAGER
 * Architectural Layer: LEVEL 3 — BLUEPRINT / BUSINESS DNA
 * Handles Business Identity & DNA binding, tenant-scoped persistence, and update protection.
 */

import { BusinessDNA, BusinessIdentity, BranchTopology } from './types';
import { SecurityContext } from '../kernel/types';
import { KernelError } from '../kernel/errors/kernelErrors';
import { BlueprintValidator } from './validator';
import { blueprintRegistry } from './registry';
import { auditLogger } from '../kernel/audit/auditLogger';
import { businessDnaRepository } from '../persistence/firestore/repositories/businessDnaRepository';

export class BusinessDnaManager {
  private static instance: BusinessDnaManager;
  // Tenant-scoped persistence map for Business DNA (keyed by dbkId)
  private dnaStore: Map<string, BusinessDNA> = new Map();

  private constructor() {}

  public static getInstance(): BusinessDnaManager {
    if (!BusinessDnaManager.instance) {
      BusinessDnaManager.instance = new BusinessDnaManager();
    }
    return BusinessDnaManager.instance;
  }

  /**
   * Binds a Blueprint to a DBK and generates initial Business DNA.
   */
  public bindBlueprintToDbk(
    securityContext: SecurityContext,
    dbkId: string,
    businessName: string,
    blueprintId: string,
    blueprintVersion?: string,
    branchTopologyInput?: Partial<BranchTopology>
  ): BusinessDNA {
    // 1. Assert Tenant Security
    BlueprintValidator.assertTenantAccess(securityContext, dbkId, 'bind Blueprint');

    // 2. Validate Blueprint Existence
    const blueprint = blueprintRegistry.getBlueprint(blueprintId, blueprintVersion);
    if (!blueprint) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        securityContext.principal.id,
        'bindBlueprint',
        `blueprint:${blueprintId}`,
        'DENIED',
        {
          tenantId: securityContext.principal.tenantId,
          requestId: securityContext.requestId,
          details: { dbkId, error: `Blueprint '${blueprintId}' not found` },
        }
      );
      throw new Error(`Invalid Blueprint Binding: Blueprint '${blueprintId}' version '${blueprintVersion || 'latest'}' is not registered`);
    }

    // 3. Check for Existing Binding (Prevent silent blueprint mutation)
    const existingDna = this.dnaStore.get(dbkId);
    if (existingDna && existingDna.identity.blueprintId !== blueprintId) {
      auditLogger.logEvent(
        'SECURITY_CONFIGURATION_CHANGE',
        securityContext.principal.id,
        'mutateBlueprintBinding',
        `dbk:${dbkId}`,
        'DENIED',
        {
          tenantId: securityContext.principal.tenantId,
          requestId: securityContext.requestId,
          details: { existingBlueprint: existingDna.identity.blueprintId, attemptedBlueprint: blueprintId },
        }
      );
      throw new Error(
        `Blueprint Mutation Restricted: DBK '${dbkId}' is already bound to Blueprint '${existingDna.identity.blueprintId}' v${existingDna.identity.blueprintVersion}. Silent blueprint switches are not permitted.`
      );
    }

    // 4. Construct Business Identity
    const identity: BusinessIdentity = {
      dbkId,
      businessName,
      legalName: businessName,
      businessType: blueprint.sector,
      blueprintId: blueprint.id,
      blueprintVersion: blueprint.version,
      industry: blueprint.sector,
      country: 'KE',
      currency: 'KES',
      timezone: 'Africa/Nairobi',
      operationalStatus: 'ACTIVE',
    };

    // 5. Construct Default Branch Topology
    const branchTopology: BranchTopology = branchTopologyInput?.branches?.length
      ? (branchTopologyInput as BranchTopology)
      : {
          type: 'SINGLE_BRANCH',
          branches: [
            {
              branchId: `${dbkId}_hq`,
              name: 'Headquarters',
              isHeadquarters: true,
              code: 'HQ-01',
              status: 'ACTIVE',
            },
          ],
        };

    // 6. Default Enabled Capabilities (All default capabilities from blueprint)
    const defaultEnabledCaps = blueprint.supportedCapabilities
      .filter((cap) => cap.isDefault)
      .map((cap) => cap.id);

    const now = new Date().toISOString();
    const dna: BusinessDNA = {
      dbkId,
      identity,
      scale: 'SMALL',
      branchTopology,
      operationalPreferences: {
        paperlessDefault: true,
        primaryCommunication: blueprint.supportedCommunicationChannels[0] || 'WHATSAPP',
      },
      enabledCapabilityIds: defaultEnabledCaps,
      growthStage: 'GROWTH',
      createdAt: existingDna ? existingDna.createdAt : now,
      updatedAt: now,
    };

    // 7. Validate constructed DNA
    const validation = BlueprintValidator.validateBusinessDna(dna);
    if (!validation.valid) {
      throw new Error(`Invalid Business DNA: ${validation.errors.join('; ')}`);
    }

    // 8. Persist DNA
    this.dnaStore.set(dbkId, dna);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      securityContext.principal.id,
      'bindBlueprintToDbk',
      `dbk:${dbkId}`,
      'ALLOWED',
      {
        tenantId: securityContext.principal.tenantId,
        requestId: securityContext.requestId,
        details: { blueprintId: blueprint.id, version: blueprint.version, enabledCapabilitiesCount: defaultEnabledCaps.length },
      }
    );

    return dna;
  }

  /**
   * Durable blueprint binding for production callers. The synchronous binding
   * method remains available for deterministic tests; production commits wait
   * for Firestore before reporting success.
   */
  public async bindBlueprintToDbkPersistent(
    securityContext: SecurityContext,
    dbkId: string,
    businessName: string,
    blueprintId: string,
    blueprintVersion?: string,
    branchTopologyInput?: Partial<BranchTopology>
  ): Promise<BusinessDNA> {
    const dna = this.bindBlueprintToDbk(
      securityContext,
      dbkId,
      businessName,
      blueprintId,
      blueprintVersion,
      branchTopologyInput
    );
    await businessDnaRepository.saveDna(dbkId, dna);
    return dna;
  }

  /**
   * Retrieves Business DNA for a specific DBK.
   */
  public getBusinessDna(securityContext: SecurityContext, targetDbkId: string): BusinessDNA {
    BlueprintValidator.assertTenantAccess(securityContext, targetDbkId, 'read Business DNA');

    const dna = this.dnaStore.get(targetDbkId);
    if (!dna) {
      throw new Error(`Business DNA Not Found: No Business DNA binding exists for DBK '${targetDbkId}'`);
    }

    return JSON.parse(JSON.stringify(dna)); // Return immutable deep copy
  }

  /**
   * Authoritative Firestore read for production callers.
   * The synchronous cache-backed method is retained for deterministic tests.
   */
  public async getPersistentBusinessDna(
    securityContext: SecurityContext,
    targetDbkId: string
  ): Promise<BusinessDNA> {
    BlueprintValidator.assertTenantAccess(securityContext, targetDbkId, 'read Business DNA');
    const dna = await businessDnaRepository.getDna(targetDbkId);
    if (!dna) {
      throw new KernelError('NOT_FOUND', 'Business DNA not found', 404, securityContext.requestId);
    }
    return JSON.parse(JSON.stringify(dna));
  }

  /**
   * Saves or updates Business DNA for a specific DBK.
   */
  public saveBusinessDna(securityContext: SecurityContext, dna: BusinessDNA): void {
    BlueprintValidator.assertTenantAccess(securityContext, dna.dbkId, 'update Business DNA');

    const validation = BlueprintValidator.validateBusinessDna(dna);
    if (!validation.valid) {
      throw new Error(`Business DNA Validation Failed: ${validation.errors.join('; ')}`);
    }

    // Prevent silent blueprint mutation
    const existing = this.dnaStore.get(dna.dbkId);
    if (existing && existing.identity.blueprintId !== dna.identity.blueprintId) {
      throw new Error(
        `Blueprint Mutation Restricted: Cannot change DBK '${dna.dbkId}' blueprint from '${existing.identity.blueprintId}' to '${dna.identity.blueprintId}'.`
      );
    }

    dna.updatedAt = new Date().toISOString();
    this.dnaStore.set(dna.dbkId, dna);
    void businessDnaRepository.saveDna(dna.dbkId, dna);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      securityContext.principal.id,
      'saveBusinessDna',
      `dbk:${dna.dbkId}`,
      'ALLOWED',
      {
        tenantId: securityContext.principal.tenantId,
        requestId: securityContext.requestId,
        details: { enabledCapabilities: dna.enabledCapabilityIds },
      }
    );
  }

  /** Durable Business DNA update for production callers. */
  public async savePersistentBusinessDna(securityContext: SecurityContext, dna: BusinessDNA): Promise<BusinessDNA> {
    this.saveBusinessDna(securityContext, dna);
    await businessDnaRepository.saveDna(dna.dbkId, dna);
    return JSON.parse(JSON.stringify(dna));
  }

  /**
   * Clears in-memory store for testing isolation.
   */
  public clearStoreForTesting(): void {
    this.dnaStore.clear();
  }
}

export const businessDnaManager = BusinessDnaManager.getInstance();
