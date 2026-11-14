import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionHub } from './connectionHub';
import { bridgeRegistry } from './registry';
import { connectorConnectionRepository } from '../../persistence/firestore/repositories/connectorConnectionRepository';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { Bridge } from './types';

const tenantId = 'tenant_shared_bridge_execution';

function context(forTenant = tenantId) {
  return {
    requestId: 'req_shared_bridge_execution',
    correlationId: 'corr_shared_bridge_execution',
    principal: {
      id: 'usr_shared_bridge_execution',
      tenantId: forTenant,
      branchId: 'HQ',
      roles: ['BUSINESS_OWNER'],
      permissions: [],
      isMaster: false,
    },
    tenantContext: { tenantId: forTenant },
    branchContext: { branchId: 'HQ' },
  } as any;
}

function connection(forTenant = tenantId) {
  return {
    connectionId: 'conn_bridge_mpesa',
    tenantId: forTenant,
    bridgeId: 'bridge_mpesa',
    provider: 'SAFARICOM_MPESA',
    status: 'CONFIGURED',
    enabled: true,
    configurationVersion: 3,
    parameters: { MPESA_SHORTCODE: '174379' },
    secretRefs: {},
    configuredAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    lastHealthCheckAt: '2026-11-10T00:00:00.000Z',
    lastHealthStatus: 'HEALTHY',
    lastErrorCode: null,
  };
}

describe('ConnectionHubService.execute', () => {
  const execute = vi.fn();

  beforeEach(async () => {
    firestoreClient.clearAllForTesting();
    execute.mockReset();
    execute.mockResolvedValue({
      status: 'PENDING',
      provider: 'SAFARICOM_MPESA',
      providerReference: 'ws_CO_TEST_001',
      amount: 100,
      currency: 'KES',
      occurredAt: '2026-11-10T00:00:00.000Z',
      correlationId: 'corr_shared_bridge_execution',
    });
    const adapter = {
      bridgeId: 'bridge_mpesa',
      provider: 'SAFARICOM_MPESA',
      capabilityId: 'mpesa_bridge',
      version: 'v1.0',
      sideEffectCapabilities: {
        providerIdempotency: false,
        providerReconciliation: false,
        automaticUnknownReplay: false,
        providerOperationIdentityRequired: true,
      },
      health: vi.fn(),
      execute,
      handleCallback: vi.fn(),
      verifyCallback: vi.fn(),
      normalizeResponse: vi.fn(),
    } as unknown as Bridge;
    bridgeRegistry.registerBridgeInstance(adapter);
    await connectorConnectionRepository.saveConnection(tenantId, 'conn_bridge_mpesa', connection() as any);
  });

  it('resolves and executes an enabled, healthy tenant connector through one boundary', async () => {
    const payload = {
      phoneNumber: '0712345678',
      amount: 100,
      accountReference: 'ORDER-001',
      transactionDesc: 'Order payment',
    };

    const result = await connectionHub.execute(context(), 'bridge_mpesa', 'STK_PUSH', payload);

    expect(result.status).toBe('PENDING');
    expect(result.providerReference).toBe('ws_CO_TEST_001');
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(context(), 'STK_PUSH', payload);
  });

  it('rejects operations not declared by the platform bridge contract', async () => {
    await expect(
      connectionHub.execute(context(), 'bridge_mpesa', 'QUERY_TRANSACTION', {}),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not resolve another tenant connection when the caller tenant differs', async () => {
    await expect(
      connectionHub.execute(context('tenant_other_business'), 'bridge_mpesa', 'STK_PUSH', {}),
    ).rejects.toMatchObject({ code: 'INTEGRATION_UNAVAILABLE' });
    expect(execute).not.toHaveBeenCalled();
  });
});
