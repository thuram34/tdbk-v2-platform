/**
 * TDBK V2 DBK LIFECYCLE MANAGER
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Governs server-authoritative DBK lifecycle transitions, suspension, archiving, and operational gating.
 */

import { DbkLifecycleStatus, DbkIdentity } from '../types';
import { SecurityContext } from '../../kernel/types';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { dbkRegistry } from '../dbkRegistry';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { eventBus } from '../../orchestration/events/eventBus';
import { publicPublicationService } from '../public/publicPublicationService';
import { auditLogger } from '../../kernel/audit/auditLogger';

export class DbkLifecycleManagerService {
  private static instance: DbkLifecycleManagerService;

  // Permitted transitions
  private static readonly VALID_TRANSITIONS: Record<DbkLifecycleStatus, DbkLifecycleStatus[]> = {
    PROVISIONING: ['ACTIVE', 'PROVISIONING_FAILED'],
    PROVISIONING_FAILED: ['PROVISIONING'],
    ACTIVE: ['SUSPENDED', 'ARCHIVED'],
    SUSPENDED: ['ACTIVE', 'ARCHIVED'],
    ARCHIVED: ['ACTIVE'], // Restore by Master only
  };

  private constructor() {}

  public static getInstance(): DbkLifecycleManagerService {
    if (!DbkLifecycleManagerService.instance) {
      DbkLifecycleManagerService.instance = new DbkLifecycleManagerService();
    }
    return DbkLifecycleManagerService.instance;
  }

  /**
   * Asserts whether a transition from fromStatus to toStatus is valid.
   */
  public isValidTransition(fromStatus: DbkLifecycleStatus, toStatus: DbkLifecycleStatus): boolean {
    const allowed = DbkLifecycleManagerService.VALID_TRANSITIONS[fromStatus];
    return allowed ? allowed.includes(toStatus) : false;
  }

  /**
   * Suspends a DBK.
   * RESTRICTED: TDBK MASTER ADMIN ONLY.
   */
  public async suspendDbk(context: SecurityContext, dbkId: string, reason: string): Promise<DbkIdentity> {
    masterAuthority.assertMasterAuthority(context.principal, 'suspendDbk', context.requestId);

    const dbk = await dbkRegistry.getDbk(context, dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK '${dbkId}' not found`, 404, context.requestId);
    }

    if (!this.isValidTransition(dbk.status, 'SUSPENDED')) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Cannot suspend DBK in '${dbk.status}' state`,
        400,
        context.requestId
      );
    }

    const updated = await dbkRegistry.updateStatus(context, dbkId, 'SUSPENDED', reason);
    try {
      const publication = await publicPublicationService.getPublication(dbkId);
      if (publication.status === 'PUBLISHED') await publicPublicationService.setPublication(context, dbkId, 'SUSPENDED', reason);
    } catch (projectionError) {
      auditLogger.logEvent('SYSTEM_ERROR', context.principal.id, 'PUBLIC_PUBLICATION_SYNC_REQUIRED', `dbk:${dbkId}`, 'ALLOWED', {
        tenantId: dbkId,
        requestId: context.requestId,
        details: { lifecycleStatus: 'SUSPENDED', error: projectionError instanceof Error ? projectionError.message : String(projectionError) },
      });
    }

    // Emit event
    eventBus.publishEvent(
      context,
      'dbk.suspended.v1',
      {
        dbkId,
        previousStatus: dbk.status,
        newStatus: 'SUSPENDED',
        reason,
      },
      'v1.0'
    );

    return updated;
  }

  /**
   * Reactivates a suspended DBK.
   * RESTRICTED: TDBK MASTER ADMIN ONLY.
   */
  public async reactivateDbk(context: SecurityContext, dbkId: string, reason?: string): Promise<DbkIdentity> {
    masterAuthority.assertMasterAuthority(context.principal, 'reactivateDbk', context.requestId);

    const dbk = await dbkRegistry.getDbk(context, dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK '${dbkId}' not found`, 404, context.requestId);
    }

    if (dbk.status !== 'SUSPENDED') {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Cannot reactivate DBK that is currently '${dbk.status}' (must be SUSPENDED)`,
        400,
        context.requestId
      );
    }

    const updated = await dbkRegistry.updateStatus(context, dbkId, 'ACTIVE', reason || 'Reactivated by Master Admin');

    // Emit event
    eventBus.publishEvent(
      context,
      'dbk.reactivated.v1',
      {
        dbkId,
        previousStatus: 'SUSPENDED',
        newStatus: 'ACTIVE',
        reason,
      },
      'v1.0'
    );

    return updated;
  }

  /**
   * Archives a DBK (Non-destructive preservation of records).
   * RESTRICTED: TDBK MASTER ADMIN ONLY.
   */
  public async archiveDbk(context: SecurityContext, dbkId: string, reason: string): Promise<DbkIdentity> {
    masterAuthority.assertMasterAuthority(context.principal, 'archiveDbk', context.requestId);

    const dbk = await dbkRegistry.getDbk(context, dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK '${dbkId}' not found`, 404, context.requestId);
    }

    if (!this.isValidTransition(dbk.status, 'ARCHIVED')) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Cannot archive DBK in '${dbk.status}' state`,
        400,
        context.requestId
      );
    }

    const updated = await dbkRegistry.updateStatus(context, dbkId, 'ARCHIVED', reason);
    try {
      const publication = await publicPublicationService.getPublication(dbkId);
      if (publication.status === 'PUBLISHED') await publicPublicationService.setPublication(context, dbkId, 'SUSPENDED', reason);
    } catch (projectionError) {
      auditLogger.logEvent('SYSTEM_ERROR', context.principal.id, 'PUBLIC_PUBLICATION_SYNC_REQUIRED', `dbk:${dbkId}`, 'ALLOWED', {
        tenantId: dbkId,
        requestId: context.requestId,
        details: { lifecycleStatus: 'ARCHIVED', error: projectionError instanceof Error ? projectionError.message : String(projectionError) },
      });
    }

    // Emit event
    eventBus.publishEvent(
      context,
      'dbk.archived.v1',
      {
        dbkId,
        previousStatus: dbk.status,
        newStatus: 'ARCHIVED',
        reason,
      },
      'v1.0'
    );

    return updated;
  }

  /**
   * Restores an archived DBK.
   * RESTRICTED: TDBK MASTER ADMIN ONLY.
   */
  public async restoreDbk(context: SecurityContext, dbkId: string, reason?: string): Promise<DbkIdentity> {
    masterAuthority.assertMasterAuthority(context.principal, 'restoreDbk', context.requestId);

    const dbk = await dbkRegistry.getDbk(context, dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK '${dbkId}' not found`, 404, context.requestId);
    }

    if (dbk.status !== 'ARCHIVED') {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Cannot restore DBK that is currently '${dbk.status}' (must be ARCHIVED)`,
        400,
        context.requestId
      );
    }

    const updated = await dbkRegistry.updateStatus(context, dbkId, 'ACTIVE', reason || 'Restored from Archive by Master Admin');

    eventBus.publishEvent(
      context,
      'dbk.restored.v1',
      {
        dbkId,
        previousStatus: 'ARCHIVED',
        newStatus: 'ACTIVE',
        reason,
      },
      'v1.0'
    );

    return updated;
  }

  /**
   * Asserts that a DBK is in ACTIVE status before permitting normal business operations.
   */
  public async assertDbkOperational(context: SecurityContext, dbkId: string): Promise<void> {
    const dbk = await dbkRegistry.getDbk(context, dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK '${dbkId}' not found`, 404, context.requestId);
    }

    if (dbk.status !== 'ACTIVE') {
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        `Operational access denied: DBK '${dbkId}' is currently in '${dbk.status}' state`,
        403,
        context.requestId
      );
    }
  }
}

export const dbkLifecycleManager = DbkLifecycleManagerService.getInstance();
