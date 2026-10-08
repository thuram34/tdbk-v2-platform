/**
 * TDBK V2 DBK REGISTRY & IDENTITY STORE
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Canonical server-authoritative store for DBK identities and lifecycle state backed by Google Cloud Firestore.
 */

import { DbkIdentity, DbkLifecycleStatus } from './types';
import { SubscriptionTier } from '../capability/types';
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
    if (!dbk.dbkId) {
      throw new KernelError('VALIDATION_ERROR', 'DBK identity requires dbkId', 400, context.requestId);
    }

    const existing = await dbkRegistryRepository.getDbk(dbk.dbkId);

    if (existing) {
      // Every existing-DBK write must prove durable ownership/authority.
      await masterAuthority.assertTenantAuthority(context, dbk.dbkId, 'saveDbk', context.requestId);

      // Immutable DBK identity cannot be rewritten through the generic persistence primitive.
      const immutableFields: Array<keyof DbkIdentity> = [
        'dbkId',
        'legalName',
        'sector',
        'blueprintId',
        'blueprintVersion',
        'subscriptionTier',
        'status',
        'masterOwner',
        'createdAt',
        'createdBy',
      ];
      for (const field of immutableFields) {
        if (dbk[field] !== existing[field]) {
          throw new KernelError(
            'AUTHORIZATION_ERROR',
            `Immutable DBK field '${String(field)}' cannot be changed through saveDbk. Use the authoritative DBK lifecycle/commercial API.`,
            403,
            context.requestId,
          );
        }
      }

      // Lifecycle history is append-only and is owned by the lifecycle transition primitive.
      if (JSON.stringify(dbk.lifecycleHistory) !== JSON.stringify(existing.lifecycleHistory)) {
        throw new KernelError(
          'AUTHORIZATION_ERROR',
          'DBK lifecycle history can only be changed through the lifecycle transition authority.',
          403,
          context.requestId,
        );
      }
    } else {
      masterAuthority.assertOwnerOrMasterAuthority(context.principal, 'saveDbk', context.requestId);

      // Generic DBK persistence cannot bypass the provisioning state machine.
      if (dbk.status !== 'PROVISIONING') {
        throw new KernelError(
          'VALIDATION_ERROR',
          'New DBKs must enter through the PROVISIONING lifecycle state.',
          400,
          context.requestId,
        );
      }
      if (dbk.masterOwner !== context.principal.id || dbk.createdBy !== context.principal.id) {
        if (!masterAuthority.isMasterAdmin(context.principal)) {
          throw new KernelError(
            'AUTHORIZATION_ERROR',
            'A Business Owner may only create a DBK owned by the authenticated owner identity.',
            403,
            context.requestId,
          );
        }
      }
    }

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
    const isDev = process.env.NODE_ENV !== 'production';
    return all.filter(
      (d) =>
        d.masterOwner === context.principal.id ||
        d.createdBy === context.principal.id ||
        d.dbkId === context.principal.tenantId ||
        (isDev &&
          (d.masterOwner === 'usr_master_super' ||
            d.dbkId === 'tenant_hardware_01' ||
            d.dbkId === 'tenant_school_01' ||
            d.dbkId === 'tenant_pharmacy_01' ||
            d.dbkId === 'tenant_law_01'))
    );
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
    await masterAuthority.assertTenantAuthority(context, dbkId, 'updateDbkStatus', context.requestId);

    const dbk = await dbkRegistryRepository.getDbk(dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK with ID '${dbkId}' not found`, 404, context.requestId);
    }

    const previousStatus = dbk.status;

    if (
      newStatus !== 'PROVISIONING_FAILED' &&
      !masterAuthority.isMasterAdmin(context.principal)
    ) {
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        'Only TDBK MASTER may perform lifecycle transitions outside provisioning failure handling.',
        403,
        context.requestId,
      );
    }

    const validTransitions: Record<DbkLifecycleStatus, DbkLifecycleStatus[]> = {
      PROVISIONING: ['ACTIVE', 'PROVISIONING_FAILED'],
      PROVISIONING_FAILED: ['PROVISIONING'],
      ACTIVE: ['SUSPENDED', 'ARCHIVED'],
      SUSPENDED: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: ['ACTIVE'],
    };
    if (previousStatus === 'PROVISIONING_FAILED' && newStatus === 'PROVISIONING' && !masterAuthority.isMasterAdmin(context.principal)) {
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        'Provisioning recovery must be performed through the authoritative provisioning flow.',
        403,
        context.requestId,
      );
    }

    if (!validTransitions[previousStatus]?.includes(newStatus)) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Invalid DBK lifecycle transition from '${previousStatus}' to '${newStatus}'.`,
        400,
        context.requestId,
      );
    }

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
   * Authoritatively re-enters a failed DBK into provisioning for recovery.
   * This is the only non-Master lifecycle recovery transition.
   */
  public async beginProvisioningRecovery(
    context: SecurityContext,
    dbkId: string,
    reason: string = 'Provisioning recovery initiated',
  ): Promise<DbkIdentity> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'beginProvisioningRecovery', context.requestId);
    const dbk = await dbkRegistryRepository.getDbk(dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK with ID '${dbkId}' not found`, 404, context.requestId);
    }
    if (dbk.status !== 'PROVISIONING_FAILED') {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Cannot recover DBK that is currently '${dbk.status}' (must be PROVISIONING_FAILED)`,
        400,
        context.requestId,
      );
    }

    const now = new Date().toISOString();
    dbk.status = 'PROVISIONING';
    dbk.provisioningStage = 'REGISTRATION_ACCEPTED';
    dbk.metadata = {
      ...(dbk.metadata || {}),
      provisioningStage: 'REGISTRATION_ACCEPTED',
      provisioningRecoveryAt: now,
    };
    dbk.updatedAt = now;
    dbk.lifecycleHistory.push({
      transitionId: `trans_recovery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fromStatus: 'PROVISIONING_FAILED',
      toStatus: 'PROVISIONING',
      actorId: context.principal.id,
      actorRole: context.principal.roles[0] || 'BUSINESS_OWNER',
      timestamp: now,
      reason,
      correlationId: context.correlationId || `corr_${dbkId}`,
    });

    await dbkRegistryRepository.saveDbk(dbkId, dbk);
    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      'DBK_PROVISIONING_RECOVERY_STARTED',
      `dbk:${dbkId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: context.requestId,
        details: { reason, correlationId: context.correlationId },
      },
    );
    return dbk;
  }

  /**
   * Authoritatively changes a DBK subscription tier.
   * Commercial authority is TDBK Master; the new tier is persisted on the canonical DBK identity.
   */
  public async changeSubscriptionTier(
    context: SecurityContext,
    dbkId: string,
    newTier: SubscriptionTier,
    reason?: string,
  ): Promise<DbkIdentity> {
    masterAuthority.assertMasterAuthority(context.principal, 'changeSubscriptionTier', context.requestId);

    const dbk = await dbkRegistryRepository.getDbk(dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK with ID '${dbkId}' not found`, 404, context.requestId);
    }

    const previousTier = dbk.subscriptionTier;
    if (previousTier === newTier) return dbk;

    dbk.subscriptionTier = newTier;
    dbk.updatedAt = new Date().toISOString();
    await dbkRegistryRepository.saveDbk(dbkId, dbk);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      'DBK_SUBSCRIPTION_TIER_CHANGED',
      `dbk:${dbkId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: context.requestId,
        details: { previousTier, newTier, reason, correlationId: context.correlationId },
      },
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
