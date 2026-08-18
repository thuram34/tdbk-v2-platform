/**
 * AUTHORITATIVE PLATFORM CAPABILITY REGISTRY
 * Architectural Layer: LEVEL 4 — CAPABILITY & ENTITLEMENT ENGINE
 * Manages platform-wide capability definitions with strict Master authority enforcement.
 */

import { SecurityContext } from '../kernel/types';
import { auditLogger } from '../kernel/audit/auditLogger';
import { KernelError } from '../kernel/errors/kernelErrors';
import { CapabilityDefinition } from './types';
import { INITIAL_CAPABILITY_CATALOG } from './catalog';

export class CapabilityRegistryService {
  private capabilities: Map<string, CapabilityDefinition> = new Map();

  constructor() {
    this.seedDefaultCatalog();
  }

  /**
   * Seeds default capability catalog.
   */
  public seedDefaultCatalog(): void {
    this.capabilities.clear();
    for (const cap of INITIAL_CAPABILITY_CATALOG) {
      const key = `${cap.capabilityId}@${cap.version}`;
      this.capabilities.set(key, { ...cap });
      this.capabilities.set(cap.capabilityId, { ...cap });
    }
  }

  /**
   * Resets registry state to default (for automated testing).
   */
  public resetToDefault(): void {
    this.seedDefaultCatalog();
  }

  /**
   * Validates that the provided context holds TDBK Master Authority.
   */
  private assertMasterAuthority(context: SecurityContext, action: string, resource: string): void {
    const isMaster =
      context.principal.isMaster === true ||
      context.principal.permissions.includes('master:platform') ||
      context.principal.permissions.includes('*');

    if (!isMaster) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        context.principal.id,
        action,
        resource,
        'DENIED',
        {
          tenantId: context.principal.tenantId,
          requestId: context.requestId,
          details: { error: 'Master Authority Required for Capability Registry Operations' },
        }
      );
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        `Master Authority Required: Principal '${context.principal.id}' from tenant '${context.principal.tenantId || 'NONE'}' is not authorized to perform capability administration '${action}'`,
        403,
        context.requestId
      );
    }
  }

  /**
   * Registers a new capability or version under Master authority.
   */
  public registerCapability(masterCtx: SecurityContext, capability: CapabilityDefinition): CapabilityDefinition {
    this.assertMasterAuthority(masterCtx, 'registerCapability', `capability:${capability.capabilityId}`);

    const exactKey = `${capability.capabilityId}@${capability.version}`;
    if (this.capabilities.has(exactKey)) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        masterCtx.principal.id,
        'registerCapability',
        `capability:${exactKey}`,
        'DENIED',
        {
          tenantId: masterCtx.principal.tenantId,
          requestId: masterCtx.requestId,
          details: { error: `Duplicate capability registration attempt for ${exactKey}` },
        }
      );
      throw new KernelError(
        'VALIDATION_ERROR',
        `Capability Registration Duplicate: Capability '${capability.capabilityId}' v${capability.version} is already registered`,
        409,
        masterCtx.requestId
      );
    }

    const newCap: CapabilityDefinition = {
      ...capability,
      createdAt: capability.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.capabilities.set(exactKey, newCap);
    this.capabilities.set(capability.capabilityId, newCap);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      masterCtx.principal.id,
      'registerCapability',
      `capability:${exactKey}`,
      'ALLOWED',
      {
        tenantId: masterCtx.principal.tenantId,
        requestId: masterCtx.requestId,
        details: { capabilityId: capability.capabilityId, version: capability.version, category: capability.category },
      }
    );

    return newCap;
  }

  /**
   * Updates an existing capability under Master authority.
   */
  public updateCapability(
    masterCtx: SecurityContext,
    capabilityId: string,
    updates: Partial<CapabilityDefinition>
  ): CapabilityDefinition {
    this.assertMasterAuthority(masterCtx, 'updateCapability', `capability:${capabilityId}`);

    const existing = this.getCapability(capabilityId);
    if (!existing) {
      throw new KernelError(
        'NOT_FOUND',
        `Capability Update Error: Capability '${capabilityId}' not found`,
        404
      );
    }

    const updated: CapabilityDefinition = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const exactKey = `${updated.capabilityId}@${updated.version}`;
    this.capabilities.set(exactKey, updated);
    this.capabilities.set(capabilityId, updated);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      masterCtx.principal.id,
      'updateCapability',
      `capability:${capabilityId}`,
      'ALLOWED',
      {
        tenantId: masterCtx.principal.tenantId,
        requestId: masterCtx.requestId,
        details: { updates },
      }
    );

    return updated;
  }

  /**
   * Retrieves a capability definition by ID and optional version.
   */
  public getCapability(capabilityId: string, version?: string): CapabilityDefinition | undefined {
    if (version) {
      const exactKey = `${capabilityId}@${version}`;
      return this.capabilities.get(exactKey);
    }
    return this.capabilities.get(capabilityId);
  }

  /**
   * Returns all primary registered capabilities.
   */
  public getAllCapabilities(): CapabilityDefinition[] {
    const uniqueMap = new Map<string, CapabilityDefinition>();
    for (const [key, val] of this.capabilities.entries()) {
      if (!key.includes('@')) {
        uniqueMap.set(key, val);
      }
    }
    return Array.from(uniqueMap.values());
  }

  /**
   * Suspends a capability platform-wide under Master authority.
   */
  public suspendCapabilityPlatformWide(masterCtx: SecurityContext, capabilityId: string, reason: string): CapabilityDefinition {
    this.assertMasterAuthority(masterCtx, 'suspendCapabilityPlatformWide', `capability:${capabilityId}`);

    const updated = this.updateCapability(masterCtx, capabilityId, {
      lifecycleStatus: 'SUSPENDED',
    });

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      masterCtx.principal.id,
      'suspendCapabilityPlatformWide',
      `capability:${capabilityId}`,
      'ALLOWED',
      {
        tenantId: masterCtx.principal.tenantId,
        requestId: masterCtx.requestId,
        details: { reason },
      }
    );

    return updated;
  }

  /**
   * Deprecates a capability platform-wide under Master authority.
   */
  public deprecateCapability(masterCtx: SecurityContext, capabilityId: string): CapabilityDefinition {
    this.assertMasterAuthority(masterCtx, 'deprecateCapability', `capability:${capabilityId}`);

    return this.updateCapability(masterCtx, capabilityId, {
      lifecycleStatus: 'DEPRECATED',
    });
  }
}

export const capabilityRegistry = new CapabilityRegistryService();
