import { beforeEach, describe, expect, it } from 'vitest';
import { connectorConnectionRepository } from '../firestore/repositories/connectorConnectionRepository';
import { firestoreClient } from '../firestore/firestoreClient';
import { ConnectorConnection } from '../types';

describe('ConnectorConnectionRepository', () => {
  const tenantId = 'tenant_connector_persistence';
  const connectionId = 'conn_mpesa';

  const connection = (): ConnectorConnection => ({
    connectionId,
    tenantId,
    bridgeId: 'bridge_mpesa',
    provider: 'Safaricom',
    status: 'CONFIGURED',
    enabled: true,
    configurationVersion: 4,
    parameters: { environment: 'production', shortcode: '174379' },
    secretRefs: {
      consumerKey: { provider: 'GCP_SECRET_MANAGER', name: 'tdbk-mpesa-consumer-key' },
    },
    configuredAt: '2026-09-23T01:00:00.000Z',
    updatedAt: '2026-09-23T01:00:00.000Z',
    lastHealthCheckAt: null,
    lastHealthStatus: 'UNKNOWN',
    lastErrorCode: null,
  });

  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('updates only health state without clobbering durable connector configuration', async () => {
    await connectorConnectionRepository.saveConnection(tenantId, connectionId, connection());

    await connectorConnectionRepository.updateHealth(tenantId, connectionId, 'HEALTHY');

    const persisted = await connectorConnectionRepository.getConnection(tenantId, connectionId);
    expect(persisted).toMatchObject({
      tenantId,
      connectionId,
      bridgeId: 'bridge_mpesa',
      provider: 'Safaricom',
      enabled: true,
      configurationVersion: 4,
      parameters: { environment: 'production', shortcode: '174379' },
      secretRefs: {
        consumerKey: { provider: 'GCP_SECRET_MANAGER', name: 'tdbk-mpesa-consumer-key' },
      },
      lastHealthStatus: 'HEALTHY',
      lastErrorCode: null,
    });
  });

  it('preserves configuration across simulated restart before applying health state', async () => {
    await connectorConnectionRepository.saveConnection(tenantId, connectionId, connection());
    firestoreClient.simulateServerRestart();

    await connectorConnectionRepository.updateHealth(tenantId, connectionId, 'ERROR', 'PROVIDER_UNAVAILABLE');

    const persisted = await connectorConnectionRepository.getConnection(tenantId, connectionId);
    expect(persisted?.configurationVersion).toBe(4);
    expect(persisted?.parameters).toEqual({ environment: 'production', shortcode: '174379' });
    expect(persisted?.secretRefs).toEqual({
      consumerKey: { provider: 'GCP_SECRET_MANAGER', name: 'tdbk-mpesa-consumer-key' },
    });
    expect(persisted?.lastHealthStatus).toBe('ERROR');
    expect(persisted?.lastErrorCode).toBe('PROVIDER_UNAVAILABLE');
  });
});
