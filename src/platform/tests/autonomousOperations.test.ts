import { describe, expect, it } from 'vitest';
import { AutonomousOperationsEngine } from '../operations/autonomousOperations';
import { TdbkControlPlaneSnapshot } from '../controlPlane/controlPlane';

const baseSnapshot = (): TdbkControlPlaneSnapshot => ({
  generatedAt: new Date().toISOString(),
  platform: {
    health: { status: 'READY' } as any,
    environment: 'test',
    version: '2.0.0',
  },
  dbks: [],
});

describe('TDBK autonomous operations', () => {
  it('reports a healthy control plane without signals', () => {
    const result = new AutonomousOperationsEngine().evaluate(baseSnapshot());
    expect(result.status).toBe('HEALTHY');
    expect(result.productionMutationRequiresAuthorization).toBe(true);
  });

  it('classifies missing business state as a safe-action signal', () => {
    const snapshot = baseSnapshot();
    snapshot.dbks.push({
      dbkId: 'dbk_test',
      displayName: 'Test',
      status: 'ACTIVE',
      stateVersion: null,
      workflowCount: 0,
      outbox: {} as any,
    });

    const result = new AutonomousOperationsEngine().evaluate(snapshot);
    expect(result.status).toBe('ACTION_REQUIRED');
    expect(result.signals[0].operationClass).toBe('AUTO_SAFE');
  });
});
