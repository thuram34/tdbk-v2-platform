import { beforeEach, describe, expect, it } from 'vitest';
import { connectorReadinessService } from './connectorReadinessService';
import { connectorConnectionRepository } from '../../persistence/firestore/repositories/connectorConnectionRepository';
import { bridgeRegistry } from '../../orchestration/bridge/registry';
import '../../orchestration/bridge/productionBridgeBootstrap';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import type { SecurityContext } from '../../kernel/types';

const tenantId = 'tenant_connector_readiness_gate';

function masterContext(): SecurityContext {
  return {
    requestId: 'connector-readiness-test',
    correlationId: 'connector-readiness-correlation',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'connector-readiness-master',
      email: 'master@tdbk.test',
      isMaster: true,
      tenantId: 'master',
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      authTime: Date.now(),
      tokenSource: 'JWT',
    },
    tenantContext: null,
    branchContext: null,
  };
}

describe('tenant connector readiness gate', () => {
  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
  });

  it('fails closed when a priority connector has no tenant connection', async () => {
    const report = await connectorReadinessService.inspect(masterContext(), tenantId);
    const mpesa = report.items.find((item) => item.bridgeId === 'bridge_mpesa');

    expect(mpesa).toBeDefined();
    expect(mpesa?.adapterRegistered).toBe(true);
    expect(mpesa?.ready).toBe(false);
    expect(mpesa?.blockers).toContain('CONNECTION_NOT_CONFIGURED');
  });

  it('requires a healthy configured tenant connection before declaring readiness', async () => {
    await connectorConnectionRepository.saveConnection(tenantId, 'conn_mpesa', {
      connectionId: 'conn_mpesa',
      tenantId,
      bridgeId: 'bridge_mpesa',
      provider: 'SAFARICOM_MPESA',
      status: 'CONFIGURED',
      enabled: true,
      configurationVersion: 1,
      parameters: {
        MPESA_CONSUMER_KEY: 'configured-via-test-ref',
        MPESA_CONSUMER_SECRET: 'configured-via-test-ref',
        MPESA_PASSKEY: 'configured-via-test-ref',
        MPESA_SHORTCODE: '174379',
        MPESA_CALLBACK_URL: 'https://example.test/mpesa/callback',
      },
      secretRefs: {},
      configuredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastHealthCheckAt: null,
      lastHealthStatus: 'UNKNOWN',
      lastErrorCode: null,
    });

    const report = await connectorReadinessService.inspect(masterContext(), tenantId);
    const mpesa = report.items.find((item) => item.bridgeId === 'bridge_mpesa');

    expect(mpesa?.ready).toBe(false);
    expect(mpesa?.blockers).toContain('HEALTH_UNKNOWN');
  });

  it('keeps the required priority adapters registered in the platform bridge registry', () => {
    expect(bridgeRegistry.getBridgeInstance('bridge_mpesa')).toBeDefined();
    expect(bridgeRegistry.getBridgeInstance('bridge_etims')).toBeDefined();
    expect(bridgeRegistry.getBridgeInstance('bridge_whatsapp')).toBeDefined();
  });
});
