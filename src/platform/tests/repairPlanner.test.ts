import { describe, expect, it } from 'vitest';
import { AgentRepairPlanner } from '../agent/repairPlanner';

describe('TDBK repair planner', () => {
  it('detects missing canonical business state and assigns the owning engine', () => {
    const planner = new AgentRepairPlanner();
    const result = planner.planFromSnapshot({
      generatedAt: new Date().toISOString(),
      platform: {
        health: {} as any,
        environment: 'test',
        version: '2.0.0',
      },
      dbks: [
        {
          dbkId: 'shop_mombasa',
          displayName: 'Shop Mombasa',
          status: 'ACTIVE',
          stateVersion: null,
          workflowCount: 0,
          outbox: {} as any,
        },
      ],
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      tenantId: 'shop_mombasa',
      issue: 'MISSING_BUSINESS_STATE',
      owningService: 'BusinessStateEngine',
    });
    expect(result.findings[0].proposedAction.kind).toBe('REBUILD_BUSINESS_STATE');
  });

  it('does not propose a repair when canonical state exists', () => {
    const planner = new AgentRepairPlanner();
    const result = planner.planFromSnapshot({
      generatedAt: new Date().toISOString(),
      platform: {
        health: {} as any,
        environment: 'test',
        version: '2.0.0',
      },
      dbks: [
        {
          dbkId: 'shop_mombasa',
          displayName: 'Shop Mombasa',
          status: 'ACTIVE',
          stateVersion: 3,
          workflowCount: 0,
          outbox: {} as any,
        },
      ],
    });

    expect(result.findings).toHaveLength(0);
    expect(result.safeToExecute).toBe(false);
  });
});
