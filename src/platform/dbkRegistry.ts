/**
 * TDBK V2 DBK REGISTRY & IDENTITY STORE
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Canonical server-authoritative store for DBK identities and lifecycle state.
 */

import { DbkIdentity, DbkLifecycleStatus } from './types';
import { SecurityContext } from '../kernel/types';
import { masterAuthority } from '../kernel/master/masterAuthority';
import { BlueprintValidator } from '../blueprint/validator';
import { KernelError } from '../kernel/errors/kernelErrors';
import { auditLogger } from '../kernel/audit/auditLogger';
import { dbkRegistryRepository } from '../persistence/firestore/repositories/dbkRegistryRepository';

export class DbkRegistryService {
  private static instance: DbkRegistryService;
  // Authoritative DBK Store keyed by dbkId (canonical tenant ID)
  private dbkStore: Map<string, DbkIdentity> = new Map();

  private constructor() {}

  public static getInstance(): DbkRegistryService {
    if (!DbkRegistryService.instance) {
      DbkRegistryService.instance = new DbkRegistryService();
    }
    return DbkRegistryService.instance;
  }

  /**
   * Resets the DBK store for test isolation.
   */
  public clearStoreForTesting(): void {
    this.dbkStore.clear();
  }

  /**
   * Registers or saves an authoritative DBK identity.
   * Can be called by Master or internal provisioning orchestrators.
   */
  public saveDbk(context: SecurityContext, dbk: DbkIdentity): void {
    const record: DbkIdentity = {
      ...dbk,
      updatedAt: new Date().toISOString(),
    };
    this.dbkStore.set(dbk.dbkId, record);
    // Write-through to Firestore Native Mode repository
    void dbkRegistryRepository.saveDbk(dbk.dbkId, record);
  }

  /**
   * Retrieves a DBK by its unique dbkId with tenant isolation enforcement.
   * Master admin can inspect any DBK.
   * DBK users can only inspect their own DBK.
   */
  public getDbk(context: SecurityContext, dbkId: string): DbkIdentity | undefined {
    if (!masterAuthority.isMasterAdmin(context.principal) && !masterAuthority.isOwnerPortfolio(context.principal)) {
      BlueprintValidator.assertTenantAccess(context, dbkId, 'getDbk');
    }
    return this.dbkStore.get(dbkId);
  }

  /**
   * Direct lookup without security check for internal kernel/orchestrator pipelines.
   */
  public getDbkInternal(dbkId: string): DbkIdentity | undefined {
    return this.dbkStore.get(dbkId);
  }

  /**
   * Lists DBKs for the authorized owner portfolio or all DBKs for master admin.
   */
  public listAllDbks(context: SecurityContext): DbkIdentity[] {
    masterAuthority.assertOwnerOrMasterAuthority(context.principal, 'listAllDbks', context.requestId);
    const all = Array.from(this.dbkStore.values());
    if (masterAuthority.isMasterAdmin(context.principal)) {
      return all;
    }
    // If business owner, return DBKs they own (masterOwner === principal.id), created by them, or match tenantId
    return all.filter(d => d.masterOwner === context.principal.id || d.createdBy === context.principal.id || d.dbkId === context.principal.tenantId);
  }

  /**
   * Updates the lifecycle status of a DBK.
   */
  public updateStatus(
    context: SecurityContext,
    dbkId: string,
    newStatus: DbkLifecycleStatus,
    reason?: string
  ): DbkIdentity {
    const dbk = this.dbkStore.get(dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK with ID '${dbkId}' not found`, 404, context.requestId);
    }

    const previousStatus = dbk.status;
    dbk.status = newStatus;
    dbk.updatedAt = new Date().toISOString();

    const transitionRecord = {
      transitionId: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fromStatus: previousStatus,
      toStatus: newStatus,
      actorId: context.principal.id,
      actorRole: context.principal.roles[0] || 'UNKNOWN',
      timestamp: new Date().toISOString(),
      reason,
      correlationId: context.correlationId || `corr_${dbkId}`,
    };

    dbk.lifecycleHistory.push(transitionRecord);
    this.dbkStore.set(dbkId, dbk);
    void dbkRegistryRepository.saveDbk(dbkId, dbk);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      `DBK_STATUS_${newStatus}`,
      `dbk:${dbkId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: context.requestId,
        details: {
          previousStatus,
          newStatus,
          reason,
          correlationId: context.correlationId,
        },
      }
    );

    return dbk;
  }

  /**
   * Checks if a DBK exists.
   */
  public hasDbk(dbkId: string): boolean {
    return this.dbkStore.has(dbkId);
  }

  /**
   * Increments the configuration version for a DBK.
   */
  public incrementConfigurationVersion(context: SecurityContext, dbkId: string): number {
    const dbk = this.getDbk(context, dbkId);
    if (!dbk) return 1;
    dbk.configurationVersion = (dbk.configurationVersion || 1) + 1;
    dbk.updatedAt = new Date().toISOString();
    this.dbkStore.set(dbkId, dbk);
    void dbkRegistryRepository.saveDbk(dbkId, dbk);
    return dbk.configurationVersion;
  }
}

export const dbkRegistry = DbkRegistryService.getInstance();
