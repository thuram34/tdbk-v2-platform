import { afterEach, describe, expect, it, vi } from 'vitest';
import { MpesaBridge } from '../bridge/adapters/mpesaBridge';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { financialLedgerRepository } from '../../persistence/firestore/repositories/financialLedgerRepository';

describe('M-Pesa production callback verification gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not mutate financial truth when a production callback cannot be authenticated', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TDBK_PERSISTENCE_DRIVER', 'test_memory');
    await firestoreClient.clearAllForTesting();
    const tenantId = 'tenant_mpesa_callback_gate';
    const checkoutRequestId = 'ws_CO_CALLBACK_GATE_001';
    await financialLedgerRepository.savePendingTransaction({
      transactionId: `mpesa_${checkoutRequestId}`,
      tenantId,
      branchId: 'HQ',
      source: 'MPESA',
      providerReference: checkoutRequestId,
      amount: 500,
      currency: 'KES',
      status: 'PENDING',
      description: 'Callback verification gate test',
      correlationId: 'corr_callback_gate',
      createdAt: new Date().toISOString(),
      postedAt: null,
      reversedAt: null,
    });

    const bridge = new MpesaBridge();
    await expect(bridge.handleCallback({
      requestId: 'req_callback_gate',
      correlationId: 'corr_callback_gate',
      principal: { id: 'usr_callback_gate', tenantId, isMaster: false },
      tenantContext: { tenantId },
      branchContext: { branchId: 'HQ' },
    } as any, {
      Body: { stkCallback: {
        MerchantRequestID: 'MR_CALLBACK_GATE_001',
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: { Item: [
          { Name: 'Amount', Value: 500 },
          { Name: 'MpesaReceiptNumber', Value: 'QAB-CALLBACK-GATE' },
        ] },
      } },
      signature: 'VALID_SIG',
      timestamp: new Date().toISOString(),
    })).rejects.toThrow('PRODUCTION_CALLBACK_VERIFICATION_UNAVAILABLE');

    const transaction = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/mpesa_${checkoutRequestId}`,
    );
    const entries = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/ledgerTransactions/mpesa_${checkoutRequestId}/entries`,
    );
    expect(transaction?.status).toBe('PENDING');
    expect(entries).toHaveLength(0);
  });

  it('rejects production callbacks even when callers supply a plausible signature and timestamp', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const bridge = new MpesaBridge();
    const result = await bridge.verifyCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: 'MR_FORGED_001',
          CheckoutRequestID: 'ws_CO_FORGED_001',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
        },
      },
      signature: 'VALID_SIG',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant_untrusted',
      correlationId: 'corr_untrusted',
    }, 'VALID_SIG');

    expect(result.verified).toBe(false);
    expect(result.replayProtectionPassed).toBe(false);
    expect(result.reason).toContain('PRODUCTION_CALLBACK_VERIFICATION_UNAVAILABLE');
  });

  it('keeps explicit invalid callback markers rejected outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const bridge = new MpesaBridge();
    const result = await bridge.verifyCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: 'MR_INVALID_001',
          CheckoutRequestID: 'ws_CO_INVALID_001',
          ResultCode: 0,
          ResultDesc: 'Test',
        },
      },
      signature: 'INVALID_SIG',
    });

    expect(result.verified).toBe(false);
  });
});
