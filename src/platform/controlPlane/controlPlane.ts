/**
 * TDBK V2 — PRODUCTION CONTROL PLANE
 * Read-only operational snapshot for the TDBK master/operator surface.
 */

import { SecurityContext } from '../../kernel/types';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { healthMonitoring } from '../../kernel/observability/health';
import { dbkRegistry } from '../dbkRegistry';
import { businessStateRepository } from '../../persistence/firestore/repositories/businessStateRepository';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { workflowInstanceRepository } from '../../persistence/firestore/repositories/workflowInstanceRepository';
import { DbkIdentity } from '../types';

export interface TdbkControlPlaneSnapshot {
  generatedAt: string;
  platform: {
    health: Awaited<ReturnType<typeof healthMonitoring.getReadyStatus>>;
    environment: string;
    version: string;
  };
  dbks: Array<{
    dbkId: string;
    displayName: string;
    status: DbkIdentity['status'];
    stateVersion: number | null;
    workflowCount: number;
    outbox: Awaited<ReturnType<typeof outboxEngine.getMetrics>>;
  }>;
}

export class TdbkControlPlane {
  public async getSnapshot(context: SecurityContext): Promise<TdbkControlPlaneSnapshot> {
    masterAuthority.assertMasterAuthority(context.principal, 'controlPlane.snapshot', context.requestId);
    const dbks = await dbkRegistry.listAllDbks(context);
    const health = await healthMonitoring.getReadyStatus();

    const details = await Promise.all(dbks.map(async (dbk) => {
      const [state, workflows, outbox] = await Promise.all([
        businessStateRepository.getCurrent(dbk.dbkId),
        workflowInstanceRepository.listWorkflows(dbk.dbkId),
        outboxEngine.getMetrics(dbk.dbkId),
      ]);
      return {
        dbkId: dbk.dbkId,
        displayName: dbk.displayName,
        status: dbk.status,
        stateVersion: state?.version ?? null,
        workflowCount: workflows.length,
        outbox,
      };
    }));

    return {
      generatedAt: new Date().toISOString(),
      platform: {
        health,
        environment: process.env.NODE_ENV || 'production',
        version: '2.0.0',
      },
      dbks: details,
    };
  }
}

export const tdbkControlPlane = new TdbkControlPlane();
