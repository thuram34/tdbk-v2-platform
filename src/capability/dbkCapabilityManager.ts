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
import { rbacEngine } from '../kernel/authorization/rbacEngine';

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
    return updatedRecord;
  }

  /** Loads one capability record from Firestore into the hot cache for production mutations. */
  public async hydratePersistentCapability(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string
  ): Promise<DbkCapabilityRecord | undefined> {
    this.assertTenant(securityContext, dbkId, 'hydratePersistentCapability');
    const record = await capabilityStateRepository.getCapabilityState(dbkId, capabilityId);
    if (record) {
      let tenantMap = this.dbkCapabilityStore.get(dbkId);
      if (!tenantMap) {
        tenantMap = new Map();
        this.dbkCapabilityStore.set(dbkId, tenantMap);
      }
      tenantMap.set(capabilityId, record);
    }
    return record ?? undefined;
  }

  /** Loads all persistent capability records for a DBK into the hot cache. */
  public async hydratePersistentCapabilities(
    securityContext: SecurityContext,
    dbkId: string
  ): Promise<DbkCapabilityRecord[]> {
    this.assertTenant(securityContext, dbkId, 'hydratePersistentCapabilities');
    const isTestRuntime = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || process.env.TDBK_PERSISTENCE_DRIVER === 'test_memory';

    // Legacy synchronous capability tests intentionally operate on the hot
    // fixture store. Never hydrate stale durable state into those tests.
    // Production remains strictly Firestore-authoritative.
    if (isTestRuntime) {
      return this.getDbkCapabilityRecords(securityContext, dbkId);
    }

    const records = await capabilityStateRepository.listCapabilityStates(dbkId);

    const tenantMap = new Map<string, DbkCapabilityRecord>();
    for (const record of records) tenantMap.set(record.capabilityId, record);
    this.dbkCapabilityStore.set(dbkId, tenantMap);
    return records;
  }

  /** Commits a capability mutation and only returns after Firestore accepts it. */
  public async persistCapabilityRecord(
    securityContext: SecurityContext,
    record: DbkCapabilityRecord
  ): Promise<DbkCapabilityRecord> {
    this.assertTenant(securityContext, record.dbkId, 'persistCapabilityRecord');
    const persisted = { ...record, updatedAt: new Date().toISOString() };
    let tenantMap = this.dbkCapabilityStore.get(record.dbkId);
    if (!tenantMap) {
      tenantMap = new Map();
      this.dbkCapabilityStore.set(record.dbkId, tenantMap);
    }
    tenantMap.set(record.capabilityId, persisted);
    await capabilityStateRepository.saveCapabilityState(record.dbkId, record.capabilityId, persisted);
    return persisted;
  }

  private assertCapabilityAdmin(securityContext: SecurityContext, dbkId: string, action: string): void {
    this.assertTenant(securityContext, dbkId, action);
    const principal = securityContext.principal;
    const ownerOverride = masterAuthority.isMasterAdmin(principal) || masterAuthority.isOwnerPortfolio(principal);
    const roleAllowed = principal.roles.some((role) => ['TENANT_ADMIN', 'SYSTEM_ADMIN'].includes(role));
    if (!ownerOverride && !roleAllowed && !rbacEngine.hasPermission(principal, 'admin:*')) {
      throw new KernelError('AUTHORIZATION_ERROR', 'Capability administration requires tenant administrator authority.', 403, securityContext.requestId);
    }
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
    this.assertCapabilityAdmin(securityContext, dbkId, 'enableCapability');

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
   * Authoritative runtime guard for operating an enabled DBK capability.
   * Activation/configuration authority is deliberately separate from runtime operation.
   */
  public async assertCapabilityOperational(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string,
    action: string,
  ): Promise<DbkCapabilityRecord> {
    const isTestRuntime = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || process.env.TDBK_PERSISTENCE_DRIVER === 'test_memory';
    if (!isTestRuntime) await this.hydratePersistentCapability(securityContext, dbkId, capabilityId);
    const cap = capabilityRegistry.getCapability(capabilityId);
    if (!cap) throw new KernelError('NOT_FOUND', "Capability '" + capabilityId + "' is not registered", 404, securityContext.requestId);
    const record = this.getDbkCapabilityRecord(securityContext, dbkId, capabilityId);
    if (!record) throw new KernelError('AUTHORIZATION_ERROR', "Capability '" + capabilityId + "' is not enabled for this DBK", 403, securityContext.requestId);
    const ownerOverride = masterAuthority.isMasterAdmin(securityContext.principal) || masterAuthority.isOwnerPortfolio(securityContext.principal);
    if (!ownerOverride) {
      const roleAllowed = cap.requiredRoles.length === 0 || cap.requiredRoles.some((role) => securityContext.principal.roles.includes(role));
      const permissionAllowed = cap.requiredPermissions.length === 0 || cap.requiredPermissions.every((permission) => rbacEngine.hasPermission(securityContext.principal, permission));
      if (!roleAllowed || !permissionAllowed) {
        auditLogger.logEvent('AUTHORIZATION_DENIED', securityContext.principal.id, action, 'capability:' + capabilityId, 'DENIED', { tenantId: dbkId, requestId: securityContext.requestId, details: { requiredRoles: cap.requiredRoles, requiredPermissions: cap.requiredPermissions } });
        throw new KernelError('AUTHORIZATION_ERROR', "Not authorized to operate capability '" + capabilityId + "'", 403, securityContext.requestId);
      }
    }
    if (record.entitlement !== 'ENTITLED') throw new KernelError('AUTHORIZATION_ERROR', "Capability '" + capabilityId + "' is not entitled for this DBK", 403, securityContext.requestId);
    if (!['ENABLED', 'CONFIGURED'].includes(record.state)) throw new KernelError('AUTHORIZATION_ERROR', "Capability '" + capabilityId + "' is not operational (state: " + record.state + ")", 403, securityContext.requestId);
    return record;
  }

  /**
   * Production-safe enable path: hydrate authoritative state, mutate, then
   * durably commit before returning. The process-local map is only a cache.
   */
  public async enableCapabilityPersistent(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string,
    entitlement: EntitlementStatus,
    requiresConfig: boolean
  ): Promise<DbkCapabilityRecord> {
    await this.hydratePersistentCapability(securityContext, dbkId, capabilityId);
    const updated = this.enableCapability(securityContext, dbkId, capabilityId, entitlement, requiresConfig);
    return await this.persistCapabilityRecord(securityContext, updated);
  }

  /** Production-safe configuration path: always derives from durable state. */
  public async configureCapabilityPersistent(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string,
    configData: Record<string, unknown>
  ): Promise<DbkCapabilityRecord> {
    await this.hydratePersistentCapability(securityContext, dbkId, capabilityId);
    const updated = this.configureCapability(securityContext, dbkId, capabilityId, configData);
    return await this.persistCapabilityRecord(securityContext, updated);
  }

  /** Production-safe disable path: always derives from durable state. */
  public async disableCapabilityPersistent(
    securityContext: SecurityContext,
    dbkId: string,
    capabilityId: string
  ): Promise<DbkCapabilityRecord> {
    await this.hydratePersistentCapability(securityContext, dbkId, capabilityId);
    const updated = this.disableCapability(securityContext, dbkId, capabilityId);
    return await this.persistCapabilityRecord(securityContext, updated);
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
    this.assertCapabilityAdmin(securityContext, dbkId, 'configureCapability');

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
    this.assertCapabilityAdmin(securityContext, dbkId, 'disableCapability');

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
    this.assertCapabilityAdmin(securityContext, dbkId, 'suspendCapabilityForDbk');

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
