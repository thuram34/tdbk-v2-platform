/**
 * TDBK V2 DBK REGISTRY & IDENTITY STORE
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Canonical server-authoritative store for DBK identities and lifecycle state backed by Google Cloud Firestore.
 */

import { DbkIdentity, DbkLifecycleStatus } from './types';
import { SecurityContext } from '../kernel/types';
import { masterAuthority } from '../kernel/master/masterAuthority';
import { KernelError } from '../kernel/errors/kernelErrors';
import { auditLogger } from '../kernel/audit/auditLogger';
import { dbkRegistryRepository } from '../persistence/firestore/repositories/dbkRegistryRepository';
import { firestoreClient } from '../persistence/firestore/firestoreClient';

export class DbkRegistryService {
  private static instance: DbkRegistryService;

  private constructor() {}

  public static getInstance(): DbkRegistryService {
    if (!DbkRegistryService.instance) {
      DbkRegistryService.instance = new DbkRegistryService();
    }
    return DbkRegistryService.instance;
  }

  /**
   * Resets the persistence driver store for test isolation.
   */
  public clearStoreForTesting(): void {
    const driver = firestoreClient.getDriver();
    if ('clearAllForTesting' in driver && typeof (driver as any).clearAllForTesting === 'function') {
      (driver as any).clearAllForTesting();
    }
  }

  /**
   * Registers or saves an authoritative DBK identity in Firestore.
   */
  public async saveDbk(context: SecurityContext, dbk: DbkIdentity): Promise<void> {
    const record: DbkIdentity = {
      ...dbk,
      updatedAt: new Date().toISOString(),
    };
    await dbkRegistryRepository.saveDbk(dbk.dbkId, record);
  }

  /**
   * Retrieves a DBK by its unique dbkId from Firestore with tenant isolation enforcement.
   */
  public async getDbk(context: SecurityContext, dbkId: string): Promise<DbkIdentity | undefined> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'getDbk');
    const dbk = await dbkRegistryRepository.getDbk(dbkId);
    return dbk || undefined;
  }

  /**
   * Direct lookup without security check for internal kernel/orchestrator pipelines.
   */
  public async getDbkInternal(dbkId: string): Promise<DbkIdentity | undefined> {
    const dbk = await dbkRegistryRepository.getDbk(dbkId);
    return dbk || undefined;
  }

  /**
   * Lists DBKs from Firestore for the authorized owner portfolio or all DBKs for master admin.
   */
  public async listAllDbks(context: SecurityContext): Promise<DbkIdentity[]> {
    masterAuthority.assertOwnerOrMasterAuthority(context.principal, 'listAllDbks', context.requestId);
    const all = await dbkRegistryRepository.listAllDbks();
    if (masterAuthority.isMasterAdmin(context.principal)) {
      return all;
    }
    // If business owner, return DBKs they own, created by them, or match tenantId
    return all.filter(d => d.masterOwner === context.principal.id || d.createdBy === context.principal.id || d.dbkId === context.principal.tenantId);
  }

  /**
   * Updates the lifecycle status of a DBK in Firestore.
   */
  public async updateStatus(
    context: SecurityContext,
    dbkId: string,
    newStatus: DbkLifecycleStatus,
    reason?: string
  ): Promise<DbkIdentity> {
    const dbk = await dbkRegistryRepository.getDbk(dbkId);
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
    await dbkRegistryRepository.saveDbk(dbkId, dbk);

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
   * Checks if a DBK exists in Firestore.
   */
  public async hasDbk(dbkId: string): Promise<boolean> {
    return await dbkRegistryRepository.hasDbk(dbkId);
  }

  /**
   * Increments the configuration version for a DBK in Firestore.
   */
  public async incrementConfigurationVersion(context: SecurityContext, dbkId: string): Promise<number> {
    const dbk = await this.getDbk(context, dbkId);
    if (!dbk) return 1;
    dbk.configurationVersion = (dbk.configurationVersion || 1) + 1;
    dbk.updatedAt = new Date().toISOString();
    await dbkRegistryRepository.saveDbk(dbkId, dbk);
    return dbk.configurationVersion;
  }
}

export const dbkRegistry = DbkRegistryService.getInstance();
