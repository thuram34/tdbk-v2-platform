import { SecurityContext } from '../../kernel/types';
import { tdbkControlPlane, TdbkControlPlaneSnapshot } from '../controlPlane/controlPlane';
import { AgentAction } from './types';

export interface AgentRepairFinding {
  tenantId: string;
  issue: 'MISSING_BUSINESS_STATE';
  severity: 'HIGH';
  owningService: 'BusinessStateEngine';
  proposedAction: AgentAction;
}

export interface AgentRepairPlan {
  generatedAt: string;
  findings: AgentRepairFinding[];
  safeToExecute: boolean;
  summary: string;
}

export class AgentRepairPlanner {
  public async plan(context: SecurityContext): Promise<AgentRepairPlan> {
    const snapshot = await tdbkControlPlane.getSnapshot(context);
    return this.planFromSnapshot(snapshot);
  }

  public planFromSnapshot(snapshot: TdbkControlPlaneSnapshot): AgentRepairPlan {
    const findings: AgentRepairFinding[] = snapshot.dbks
      .filter((dbk) => dbk.status !== 'ARCHIVED' && dbk.stateVersion === null)
      .map((dbk, index) => ({
        tenantId: dbk.dbkId,
        issue: 'MISSING_BUSINESS_STATE',
        severity: 'HIGH',
        owningService: 'BusinessStateEngine',
        proposedAction: {
          actionId: `repair_${dbk.dbkId}_${index + 1}`,
          kind: 'REBUILD_BUSINESS_STATE',
          authority: 'SAFE_REPAIR',
          tenantId: dbk.dbkId,
          description: `Project canonical business state for DBK ${dbk.dbkId} using BusinessStateEngine.`,
          requiresAuthorization: true,
        },
      }));

    return {
      generatedAt: new Date().toISOString(),
      findings,
      safeToExecute: findings.length > 0,
      summary: findings.length === 0
        ? 'No missing canonical business-state projections were detected.'
        : `Found ${findings.length} DBK(s) with missing canonical business-state projections.`,
    };
  }
}

export const agentRepairPlanner = new AgentRepairPlanner();
