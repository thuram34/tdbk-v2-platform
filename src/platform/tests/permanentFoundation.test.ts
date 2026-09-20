import { describe, expect, it } from 'vitest';
import { eventBus } from '../../orchestration/events/eventBus';
import { BusinessStateSnapshot } from '../businessState/types';

describe('TDBK permanent foundation contracts', () => {
  it('registers the canonical business-state projection event', () => {
    const event = {
      eventId: 'evt_foundation_contract',
      eventType: 'business.state.projected.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId: 'dbk_test',
      branchId: null,
      principalId: 'system',
      correlationId: 'corr_foundation_contract',
      causationId: null,
      source: 'TDBK_TEST',
      payload: { dbkId: 'dbk_test', snapshotId: 'state_dbk_test_1', version: 1 },
      metadata: {},
    };
    expect(eventBus.validateEnvelope(event)).toEqual({ valid: true });
  });

  it('defines an immutable-shaped canonical business snapshot', () => {
    const snapshot: BusinessStateSnapshot = {
      snapshotId: 'state_dbk_test_1',
      tenantId: 'dbk_test',
      dbkId: 'dbk_test',
      version: 1,
      generatedAt: new Date().toISOString(),
      source: 'TDBK_BUSINESS_STATE_ENGINE',
      identity: {} as BusinessStateSnapshot['identity'],
      branches: [],
      workspace: {} as BusinessStateSnapshot['workspace'],
      enabledCapabilities: [],
      discoverableCapabilities: [],
      businessDna: null,
      health: {
        lifecycleStatus: 'ACTIVE',
        activeBranchCount: 0,
        enabledCapabilityCount: 0,
        configurationVersion: 1,
        workspaceVersion: 1,
      },
      metadata: {},
    };
    expect(snapshot.tenantId).toBe(snapshot.dbkId);
    expect(snapshot.version).toBe(1);
  });
});
