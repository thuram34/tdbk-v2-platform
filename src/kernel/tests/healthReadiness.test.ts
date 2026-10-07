import { beforeEach, describe, expect, it } from 'vitest';
import { healthMonitoring } from '../observability/health';
import { eventBus } from '../../orchestration/events/eventBus';
import { bridgeRegistry } from '../../orchestration/bridge/registry';
import '../../orchestration/bridge/productionBridgeBootstrap';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';

describe('runtime readiness gate', () => {
  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
    await healthMonitoring.initializeReadinessMarker();
  });

  it('reports degraded readiness when the durable marker is missing', async () => {
    await firestoreClient.clearAllForTesting();
    const status = await healthMonitoring.getReadyStatus();
    expect(status.status).toBe('DEGRADED');
    expect(status.components.firestore).toBe(false);
  });

  it('reports the core production dependencies as ready', async () => {
    const status = await healthMonitoring.getReadyStatus();

    expect(status.status).toBe('HEALTHY');
    expect(status.components.firestore).toBe(true);
    expect(status.components.eventBus).toBe(true);
    expect(status.components.bridgeAdapters).toBe(true);
    expect(eventBus.isReady()).toBe(true);
    expect(bridgeRegistry.getBridgeInstance('bridge_mpesa')).toBeDefined();
    expect(bridgeRegistry.getBridgeInstance('bridge_etims')).toBeDefined();
    expect(bridgeRegistry.getBridgeInstance('bridge_whatsapp')).toBeDefined();
    expect(bridgeRegistry.getBridgeInstance('bridge_sms')).toBeDefined();
    expect(bridgeRegistry.getBridgeInstance('bridge_email')).toBeDefined();
    expect(bridgeRegistry.getBridgeInstance('bridge_bank')).toBeDefined();
  });
});
