/**
 * TDBK V2 WORKSPACE MANAGER & VERSIONING
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Compiles server-authoritative workspace state projections for DBK instances.
 */

import { DbkWorkspaceState, DbkIdentity, DbkShellReadiness, DbkProvisioningStage } from '../types';
import { SecurityContext } from '../../kernel/types';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { dbkRegistry } from '../dbkRegistry';
import { branchManager } from '../branch/branchManager';
import { blueprintRegistry } from '../../blueprint/registry';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { discoveryEngine } from '../../capability/discovery';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { connectorReadinessService } from '../connectors/connectorReadinessService';

export class WorkspaceManagerService {
  private static instance: WorkspaceManagerService;

  private constructor() {}

  public static getInstance(): WorkspaceManagerService {
    if (!WorkspaceManagerService.instance) {
      WorkspaceManagerService.instance = new WorkspaceManagerService();
    }
    return WorkspaceManagerService.instance;
  }

  /**
   * Compiles the authoritative workspace state for a given DBK.
   */
  public async compileWorkspaceState(context: SecurityContext, dbkId: string): Promise<DbkWorkspaceState> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'compileWorkspaceState');

    const dbk = await dbkRegistry.getDbkInternal(dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK with ID '${dbkId}' does not exist`, 404, context.requestId);
    }

    const blueprint = blueprintRegistry.getBlueprint(dbk.blueprintId, dbk.blueprintVersion);
    const branches = await branchManager.listPersistentBranches(context, dbkId);

    // Get enabled and discoverable capabilities
    const capabilityRecords = await dbkCapabilityManager.hydratePersistentCapabilities(context, dbkId);
    const enabledCapabilities = capabilityRecords
      .filter((r) => r.state === 'ENABLED' || r.state === 'CONFIGURED')
      .map((r) => r.capabilityId);

    let discoverableCapabilities: string[];
    try {
      const discoverySurface = await discoveryEngine.discoverPersistentCapabilitiesForDbk(context, dbkId);
      discoverableCapabilities = discoverySurface.availableCapabilities.map((c) => c.capabilityId);
    } catch (error) {
      // An unbound Business DNA record is a valid pre-composition state; operational
      // discovery failures must still propagate rather than becoming an empty UI.
      if (error instanceof KernelError && error.code === 'NOT_FOUND') {
        discoverableCapabilities = [];
      } else {
        throw error;
      }
    }

    const terminology = blueprint?.terminology || {};
    // Connector state is part of the authoritative workspace projection so the
    // DBK experience does not maintain a separate integrations surface/state.
    const connectorReport = await connectorReadinessService.inspect(context, dbkId);

    const provisioningStage = (dbk.provisioningStage || dbk.metadata?.provisioningStage) as DbkProvisioningStage | undefined;
    const shellReadiness: DbkShellReadiness =
      dbk.status === 'ARCHIVED'
        ? 'ARCHIVED'
        : dbk.status === 'SUSPENDED'
          ? 'SUSPENDED'
          : dbk.status === 'PROVISIONING_FAILED'
            ? 'BLOCKED'
            : dbk.status === 'PROVISIONING'
              ? 'BUILDING'
              : provisioningStage === 'ACTIVATION_VERIFIED'
                ? 'READY'
                : provisioningStage
                  ? 'BUILDING'
                  : 'NOT_READY';

    return {
      dbkId: dbk.dbkId,
      displayName: dbk.displayName,
      legalName: dbk.legalName,
      sector: dbk.sector,
      blueprintId: dbk.blueprintId,
      blueprintVersion: dbk.blueprintVersion,
      subscriptionTier: dbk.subscriptionTier,
      status: dbk.status,
      workspaceVersion: dbk.workspaceVersion,
      configurationVersion: dbk.configurationVersion,
      activeBranches: branches.filter((b) => b.status === 'ACTIVE'),
      currentBranchContext: context.branchContext,
      enabledCapabilities,
      discoverableCapabilities,
      connections: connectorReport.items.map((item) => ({
        bridgeId: item.bridgeId,
        provider: item.provider,
        capabilityId: item.capabilityId,
        status: item.connectionStatus,
        enabled: item.enabled,
        healthStatus: item.healthStatus,
        ready: item.ready,
        blockers: item.blockers,
        minimumTier: item.minimumTier,
        entitlementStatus: item.entitlementStatus,
      })),
      provisioningStage,
      shellReadiness,
      terminology,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  /**
   * Increments workspace version upon configuration changes.
   */
  public async incrementWorkspaceVersion(context: SecurityContext, dbkId: string): Promise<DbkIdentity> {
    const dbk = await dbkRegistry.getDbk(context, dbkId);
    if (!dbk) {
      throw new KernelError('NOT_FOUND', `DBK '${dbkId}' not found`, 404, context.requestId);
    }

    dbk.workspaceVersion += 1;
    dbk.configurationVersion += 1;
    dbk.updatedAt = new Date().toISOString();

    await dbkRegistry.saveDbk(context, dbk);
    return dbk;
  }
}

export const workspaceManager = WorkspaceManagerService.getInstance();
