/**
 * DBK CAPABILITY STATE MANAGER
 * Architectural Layer: LEVEL 4 — CAPABILITY & ENTITLEMENT ENGINE
 * Server-authoritative store for tenant-scoped capability state and lifecycle transitions.
 */

import { SecurityContext } from '../kernel/types';
import { auditLogger } from '../kernel/audit/auditLogger';
import { KernelError } from '../kernel/errors/kernelErrors';
import { BlueprintValidator } from '../blueprint/validator';
import { masterAuthority } from '../kernel/master/masterAuthority';
import { DbkCapabilityRecord, CapabilityLifecycleState, EntitlementStatus } from './types';
import { capabilityRegistry } from './registry';
import { capabilityStateRepository } from '../persistence/firestore/repositories/capabilityStateRepository';

export class DbkCapabilityManagerService {
  // Map of `dbkId` -> Map of `capabilityId` -> `DbkCapabilityRecord`
  private dbkCapabilityStore: Map<string, Map<string, DbkCapabilityRecord>> = new Map();

  /**
   * Resets tenant capability state store (for automated testing).
   */
  public clearStoreForTesting(): void {
    this.dbkCapabilityStore.clear();
  }

  public isCapabilityEnabled(securityContextOrTenantId: SecurityContext | string, capabilityId: string): boolean {
    const tenantId = typeof securityContextOrTenantId === 'string' ? securityContextOrTenantId : securityContextOrTenantId.principal.tenantId;
    if (!tenantId) return false;
    const tenantMap = this.dbkCapabilityStore.get(tenantId);
    if (!tenantMap) return false;
    const record = tenantMap.get(capabilityId);
    if (!record) return false;
    return record.state === 'ENABLED' || record.state === 'CONFIGURED';
  }

  /**
   * Asserts tenant isolation access for target DBK ID using Phase 0 validator.
   */
  private assertTenant(context: SecurityContext, targetDbkId: string, action: string): void {
    if (!masterAuthority.isMasterAdmin(context.principal)) {
      BlueprintValidator.assertTenantAccess(context, targetDbkId, action);
    }
  }

  /**
   * Gets all capability records for a DBK.
   */
  public getDbkCapabilityRecords(securityContext: SecurityContext, dbkId: string): DbkCapabilityRecord[] {
    this.assertTenant(securityContext, dbkId, 'getDbkCapabilityRecords');
    const tenantMap = this.dbkCapabilityStore.get(dbkId);
    if (!tenantMap) return [];
    return Array.from(tenantMap.values());
  }

  /**
   * Gets a single capability record for a DBK.
   */
  public getDbkCapabilityRecord(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string
  ): DbkCapabilityRecord | undefined {
    this.assertTenant(securityContext, dbkId, 'getDbkCapabilityRecord');
    const tenantMap = this.dbkCapabilityStore.get(dbkId);
    return tenantMap?.get(capabilityId);
  }

  /**
   * Saves or updates a capability record for a DBK.
   */
  public saveDbkCapabilityRecord(securityContext: SecurityContext, record: DbkCapabilityRecord): DbkCapabilityRecord {
    this.assertTenant(securityContext, record.dbkId, 'saveDbkCapabilityRecord');

    let tenantMap = this.dbkCapabilityStore.get(record.dbkId);
    if (!tenantMap) {
      tenantMap = new Map();
      this.dbkCapabilityStore.set(record.dbkId, tenantMap);
    }

    const updatedRecord: DbkCapabilityRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
    };

    tenantMap.set(record.capabilityId, updatedRecord);
    void capabilityStateRepository.saveCapabilityState(record.dbkId, record.capabilityId, updatedRecord);
    return updatedRecord;
  }

  /**
   * Enables or updates a capability record state for a DBK.
   */
  public enableCapability(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string,
    entitlement: EntitlementStatus,
    requiresConfig: boolean
  ): DbkCapabilityRecord {
    this.assertTenant(securityContext, dbkId, 'enableCapability');

    const cap = capabilityRegistry.getCapability(capabilityId);
    if (!cap) {
      throw new KernelError('NOT_FOUND', `Capability '${capabilityId}' not found in platform registry`, 404);
    }

    const existing = this.getDbkCapabilityRecord(securityContext, dbkId, capabilityId);

    const initialState: CapabilityLifecycleState = requiresConfig ? 'ENABLED' : 'CONFIGURED';

    const newRecord: DbkCapabilityRecord = {
      dbkId,
      capabilityId,
      capabilityVersion: cap.version,
      state: initialState,
      entitlement,
      configurationState: {
        isConfigured: !requiresConfig,
        configData: existing?.configurationState?.configData || {},
      },
      enabledAt: new Date().toISOString(),
      enabledBy: securityContext.principal.id,
      updatedAt: new Date().toISOString(),
    };

    this.saveDbkCapabilityRecord(securityContext, newRecord);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      securityContext.principal.id,
      'CAPABILITY_ENABLED',
      `capability:${capabilityId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: securityContext.requestId,
        details: { capabilityId, version: cap.version, state: newRecord.state },
      }
    );

    return newRecord;
  }

  /**
   * Configures a capability for a DBK.
   */
  public configureCapability(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string,
    configData: Record<string, unknown>
  ): DbkCapabilityRecord {
    this.assertTenant(securityContext, dbkId, 'configureCapability');

    const existing = this.getDbkCapabilityRecord(securityContext, dbkId, capabilityId);
    if (!existing) {
      throw new KernelError('NOT_FOUND', `Capability record '${capabilityId}' not found for DBK '${dbkId}'`, 404);
    }

    if (existing.state === 'DISABLED' || existing.state === 'SUSPENDED') {
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        `Cannot configure capability '${capabilityId}' while in state '${existing.state}'`,
        400
      );
    }

    const updatedRecord: DbkCapabilityRecord = {
      ...existing,
      state: 'CONFIGURED',
      configurationState: {
        isConfigured: true,
        configData: {
          ...(existing.configurationState.configData || {}),
          ...configData,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    this.saveDbkCapabilityRecord(securityContext, updatedRecord);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      securityContext.principal.id,
      'CAPABILITY_CONFIGURATION_CHANGED',
      `capability:${capabilityId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: securityContext.requestId,
        details: { capabilityId, isConfigured: true },
      }
    );

    return updatedRecord;
  }

  /**
   * Disables a capability for a DBK.
   */
  public disableCapability(securityContext: SecurityContext, dbkId: string, capabilityId: string): DbkCapabilityRecord {
    this.assertTenant(securityContext, dbkId, 'disableCapability');

    const existing = this.getDbkCapabilityRecord(securityContext, dbkId, capabilityId);
    const cap = capabilityRegistry.getCapability(capabilityId);
    const version = cap ? cap.version : '1.0.0';

    const disabledRecord: DbkCapabilityRecord = {
      dbkId,
      capabilityId,
      capabilityVersion: version,
      state: 'DISABLED',
      entitlement: existing?.entitlement || 'ENTITLED',
      configurationState: existing?.configurationState || { isConfigured: false },
      disabledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveDbkCapabilityRecord(securityContext, disabledRecord);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      securityContext.principal.id,
      'CAPABILITY_DISABLED',
      `capability:${capabilityId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: securityContext.requestId,
        details: { capabilityId },
      }
    );

    return disabledRecord;
  }

  /**
   * Suspends a capability for a specific DBK.
   */
  public suspendCapabilityForDbk(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string,
    reason: string
  ): DbkCapabilityRecord {
    this.assertTenant(securityContext, dbkId, 'suspendCapabilityForDbk');

    const existing = this.getDbkCapabilityRecord(securityContext, dbkId, capabilityId);
    const cap = capabilityRegistry.getCapability(capabilityId);
    const version = cap ? cap.version : '1.0.0';

    const suspendedRecord: DbkCapabilityRecord = {
      dbkId,
      capabilityId,
      capabilityVersion: version,
      state: 'SUSPENDED',
      entitlement: existing?.entitlement || 'ENTITLED',
      configurationState: existing?.configurationState || { isConfigured: false },
      suspendedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveDbkCapabilityRecord(securityContext, suspendedRecord);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      securityContext.principal.id,
      'CAPABILITY_SUSPENDED',
      `capability:${capabilityId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: securityContext.requestId,
        details: { capabilityId, reason },
      }
    );

    return suspendedRecord;
  }
}

export const dbkCapabilityManager = new DbkCapabilityManagerService();
