/**
 * TDBK V2 — BUSINESS STATE / DIGITAL TWIN ENGINE
 * Canonical machine-readable DBK state used by runtime, intelligence, automation and control plane.
 */

import { SecurityContext } from '../../kernel/types';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { dbkRegistry } from '../dbkRegistry';
import { branchManager } from '../branch/branchManager';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { workspaceManager } from '../workspace/workspaceManager';
import { businessDnaRepository } from '../../persistence/firestore/repositories/businessDnaRepository';
import { businessStateRepository } from '../../persistence/firestore/repositories/businessStateRepository';
import { eventBus } from '../../orchestration/events/eventBus';
import { BusinessStateSnapshot } from './types';

export class BusinessStateEngine {
  private static instance: BusinessStateEngine;
  private constructor() {
    eventBus.registerEventType(
      'business.state.projected.v1',
      'v1',
      'Canonical DBK business state projection refreshed',
    );
  }

  public static getInstance(): BusinessStateEngine {
    if (!BusinessStateEngine.instance) BusinessStateEngine.instance = new BusinessStateEngine();
    return BusinessStateEngine.instance;
  }

  public async project(context: SecurityContext, dbkId: string): Promise<BusinessStateSnapshot> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'projectBusinessState');

    const [identity, branches, workspace, dna, capabilities] = await Promise.all([
      dbkRegistry.getDbk(context, dbkId),
      branchManager.listPersistentBranches(context, dbkId),
      workspaceManager.compileWorkspaceState(context, dbkId),
      businessDnaRepository.getDna(dbkId),
      dbkCapabilityManager.hydratePersistentCapabilities(context, dbkId),
    ]);

    if (!identity) throw new Error(`DBK '${dbkId}' does not exist.`);

    const enabledCapabilities = capabilities
      .filter((record) => record.state === 'ENABLED' || record.state === 'CONFIGURED')
      .map((record) => record.capabilityId);

    const current = await businessStateRepository.getCurrent(dbkId);
    const snapshot: BusinessStateSnapshot = {
      snapshotId: '',
      tenantId: dbkId,
      dbkId,
      version: current?.version ?? 0,
      generatedAt: new Date().toISOString(),
      source: 'TDBK_BUSINESS_STATE_ENGINE',
      identity,
      branches,
      workspace,
      enabledCapabilities,
      discoverableCapabilities: workspace.discoverableCapabilities,
      businessDna: dna,
      health: {
        lifecycleStatus: identity.status,
        activeBranchCount: branches.filter((branch) => branch.status === 'ACTIVE').length,
        enabledCapabilityCount: enabledCapabilities.length,
        configurationVersion: identity.configurationVersion,
        workspaceVersion: identity.workspaceVersion,
      },
      metadata: {
        previousVersion: current?.version ?? 0,
        projectedFrom: ['dbkRegistry', 'branches', 'workspace', 'businessDna', 'capabilities'],
      },
    };

    const persisted = await businessStateRepository.saveNextVersion(snapshot, current?.version ?? null);

    await eventBus.publish({
      eventId: `evt_business_state_${dbkId}_${persisted.version}`,
      eventType: 'business.state.projected.v1',
      eventVersion: 'v1',
      occurredAt: persisted.generatedAt,
      tenantId: dbkId,
      branchId: null,
      principalId: context.principal.id,
      correlationId: context.correlationId || `corr_state_${persisted.version}`,
      causationId: context.requestId || null,
      source: 'TDBK_BUSINESS_STATE_ENGINE',
      payload: {
        dbkId,
        snapshotId: persisted.snapshotId,
        version: persisted.version,
        configurationVersion: persisted.health.configurationVersion,
        workspaceVersion: persisted.health.workspaceVersion,
      },
      metadata: {},
    });

    return persisted;
  }

  public async getCurrent(context: SecurityContext, dbkId: string): Promise<BusinessStateSnapshot | null> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'getBusinessState');
    return businessStateRepository.getCurrent(dbkId);
  }
}

export const businessStateEngine = BusinessStateEngine.getInstance();
