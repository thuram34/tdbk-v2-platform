import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EtimsBridge } from '../bridge/adapters/etimsBridge';
import { WhatsappBridge } from '../bridge/adapters/whatsappBridge';
import { connectorConnectionRepository } from '../../persistence/firestore/repositories/connectorConnectionRepository';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';

const etimsTenant = 'tenant_etims_hardening';
const whatsappTenant = 'tenant_whatsapp_hardening';

function context(tenantId: string) {
  return {
    requestId: 'req_bridge_hardening',
    correlationId: 'corr_bridge_hardening',
    principal: { id: 'usr_bridge_hardening', tenantId, isMaster: false },
    tenantContext: { tenantId },
    branchContext: { branchId: 'HQ' },
  } as any;
}

function etimsConnection() {
  return {
    connectionId: 'conn_bridge_etims',
    tenantId: etimsTenant,
    bridgeId: 'bridge_etims',
    provider: 'KRA_ETIMS',
    status: 'CONFIGURED',
    enabled: true,
    configurationVersion: 1,
    parameters: {
      ETIMS_PIN: 'A123456789Z',
      ETIMS_DEVICE_SERIAL: 'DVC-001',
      ETIMS_BRANCH_CODE: '00',
      ETIMS_VSCU_BASE_URL: 'http://127.0.0.1:8088',
    },
    secretRefs: {},
    configuredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastHealthCheckAt: null,
    lastHealthStatus: 'HEALTHY',
    lastErrorCode: null,
  };
}

function whatsappConnection() {
  return {
    connectionId: 'conn_bridge_whatsapp',
    tenantId: whatsappTenant,
    bridgeId: 'bridge_whatsapp',
    provider: 'META_WHATSAPP',
    status: 'CONFIGURED',
    enabled: true,
    configurationVersion: 1,
    parameters: {
      WHATSAPP_PHONE_NUMBER_ID: 'phone-123',
      WHATSAPP_WABA_ID: 'waba-123',
    },
    secretRefs: {
      WHATSAPP_ACCESS_TOKEN: { name: 'TDBK_TEST_WA_ACCESS_TOKEN', provider: 'CLOUD_RUN_ENV' as const },
      WHATSAPP_APP_SECRET: { name: 'TDBK_TEST_WA_APP_SECRET', provider: 'CLOUD_RUN_ENV' as const },
      WHATSAPP_VERIFY_TOKEN: { name: 'TDBK_TEST_WA_VERIFY_TOKEN', provider: 'CLOUD_RUN_ENV' as const },
    },
    configuredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastHealthCheckAt: null,
    lastHealthStatus: 'HEALTHY',
    lastErrorCode: null,
  };
}

const etimsPayload = (amount = 1160) => ({
  invoiceNumber: 'INV-1001',
  totalAmount: amount,
  taxAmount: 160,
  idempotencyKey: 'sale-1001',
  items: [{
    itemCode: 'ITEM-1',
    itemName: 'Test item',
    quantity: 1,
    unitPrice: amount - 160,
    taxTypeCode: 'A',
    taxRate: 16,
    taxAmount: 160,
    taxableAmount: amount - 160,
  }],
});

describe('external bridge hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    process.env.NODE_ENV = 'production';
    process.env.TDBK_PERSISTENCE_DRIVER = 'test_memory';
    process.env.TDBK_TEST_WA_ACCESS_TOKEN = 'test-access-token';
    process.env.TDBK_TEST_WA_APP_SECRET = 'test-app-secret';
    process.env.TDBK_TEST_WA_VERIFY_TOKEN = 'test-verify-token';
    firestoreClient.clearAllForTesting();
    await connectorConnectionRepository.saveConnection(etimsTenant, 'conn_bridge_etims', etimsConnection() as any);
    await connectorConnectionRepository.saveConnection(whatsappTenant, 'conn_bridge_whatsapp', whatsappConnection() as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.TDBK_PERSISTENCE_DRIVER;
    delete process.env.TDBK_TEST_WA_ACCESS_TOKEN;
    delete process.env.TDBK_TEST_WA_APP_SECRET;
    delete process.env.TDBK_TEST_WA_VERIFY_TOKEN;
    vi.restoreAllMocks();
  });

  it('reuses the durable eTIMS result for the same invoice key without a second provider call', async () => {
    const response = {
      resultCd: '000',
      resultMsg: 'SUCCESS',
      data: { invcNo: 1001, rcptNo: 'KRA-1001', totAmt: 1160 },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);

    const bridge = new EtimsBridge();
    const first = await bridge.execute(context(etimsTenant), 'SAVE_SALES', etimsPayload());
    const second = await bridge.execute(context(etimsTenant), 'SAVE_SALES', etimsPayload());

    expect(first.status).toBe('SUCCESS');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects conflicting reuse of an eTIMS idempotency key', async () => {
    const response = { resultCd: '000', resultMsg: 'SUCCESS', data: { invcNo: 1001, rcptNo: 'KRA-1001' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response }));

    const bridge = new EtimsBridge();
    await bridge.execute(context(etimsTenant), 'SAVE_SALES', etimsPayload());

    await expect(
      bridge.execute(context(etimsTenant), 'SAVE_SALES', etimsPayload(1200)),
    ).rejects.toThrow('already used for a different request');
  });

  it('blocks blind eTIMS replay when the provider outcome is ambiguous', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('socket closed after provider request'));
    vi.stubGlobal('fetch', fetchMock);

    const bridge = new EtimsBridge();
    await expect(
      bridge.execute(context(etimsTenant), 'SAVE_SALES', etimsPayload()),
    ).rejects.toThrow('socket closed after provider request');

    const second = await bridge.execute(context(etimsTenant), 'SAVE_SALES', etimsPayload());
    expect(second.status).toBe('REQUIRES_RECONCILIATION');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the durable WhatsApp result for the same outbound key without a second message', async () => {
    const response = { messages: [{ id: 'wamid.TEST.001' }] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);

    const bridge = new WhatsappBridge();
    const payload = {
      recipientPhone: '0712345678',
      messageText: 'Your TDBK receipt is ready.',
      idempotencyKey: 'receipt-1001',
    };

    const first = await bridge.execute(context(whatsappTenant), 'SEND_TEXT', payload);
    const second = await bridge.execute(context(whatsappTenant), 'SEND_TEXT', payload);

    expect(first.status).toBe('SUCCESS');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('suppresses duplicate WhatsApp inbound webhook delivery by wamid', async () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-123',
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-123', display_phone_number: '+254700000000' },
            messages: [{
              id: 'wamid.INBOUND.001',
              from: '254712345678',
              timestamp: '1760000000',
              type: 'text',
              text: { body: 'Hello TDBK' },
            }],
          },
        }],
      }],
    });

    const { createHmac } = await import('node:crypto');
    const signature = 'sha256=' + createHmac('sha256', 'test-app-secret').update(body, 'utf8').digest('hex');

    const bridge = new WhatsappBridge();
    const callback = {
      rawBody: body,
      headers: { 'x-hub-signature-256': signature },
      entry: JSON.parse(body).entry,
    } as any;

    const first = await bridge.handleCallback(context(whatsappTenant), callback);
    const second = await bridge.handleCallback(context(whatsappTenant), callback);

    expect(first.status).toBe('SUCCESS');
    expect(second.status).toBe('SUCCESS');
    expect(second.data?.eventType).toBe('MESSAGE_RECEIVED_DUPLICATE_SUPPRESSED');

    const incoming = await firestoreClient.get<any>(
      '/tenants/' + whatsappTenant + '/idempotency/whatsapp:webhook:wamid.INBOUND.001',
    );
    expect(incoming?.status).toBe('COMPLETED');
  });
});
