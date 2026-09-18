import { describe, expect, it, beforeEach } from 'vitest';
import { MpesaBridge } from '../bridge/adapters/mpesaBridge';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { financialLedgerRepository } from '../../persistence/firestore/repositories/financialLedgerRepository';

const tenantId = 'tenant_mpesa_atomic';
const checkoutRequestId = 'ws_CO_ATOMIC_001';

function context() {
  return {
    requestId: 'req_mpesa_atomic',
    correlationId: 'corr_mpesa_atomic',
    principal: { id: 'usr_test', tenantId, isMaster: false },
    tenantContext: { tenantId },
    branchContext: { branchId: 'branch_hq' },
  } as any;
}

function callback() {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: 'MR_ATOMIC_001',
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 1000 },
            { Name: 'MpesaReceiptNumber', Value: 'QAB123XYZ' },
          ],
        },
      },
    },
    signature: 'VALID_SIG',
    tenantId,
    correlationId: 'corr_mpesa_atomic',
  };
}

describe('M-Pesa callback financial atomicity', () => {
  beforeEach(async () => {
    firestoreClient.clearAllForTesting();
    await financialLedgerRepository.savePendingTransaction({
      transactionId: `mpesa_${checkoutRequestId}`,
      tenantId,
      branchId: 'branch_hq',
      source: 'MPESA',
      providerReference: checkoutRequestId,
      amount: 1000,
      currency: 'KES',
      status: 'PENDING',
      description: 'Test M-Pesa initiation',
      correlationId: 'corr_mpesa_atomic',
      createdAt: new Date().toISOString(),
      postedAt: null,
      reversedAt: null,
    });
  });

  it('creates one financial transaction, ledger posting and outbox event for duplicate callbacks', async () => {
    const bridge = new MpesaBridge();
    await bridge.handleCallback(context(), callback());
    await bridge.handleCallback(context(), callback());

    const tx = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/mpesa_${checkoutRequestId}`
    );
    const ledger = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/ledgerTransactions/mpesa_${checkoutRequestId}/entries`
    );
    const outbox = await firestoreClient.get<any>(
      `/tenants/${tenantId}/outbox/evt_callback_${checkoutRequestId}`
    );

    expect(tx?.status).toBe('POSTED');
    expect(ledger).toHaveLength(2);
    expect(outbox?.eventType).toBe('payment.confirmed.v1');
  });

  it('serializes concurrent duplicate callbacks to one financial posting', async () => {
    const bridge = new MpesaBridge();
    const results = await Promise.allSettled([
      bridge.handleCallback(context(), callback()),
      bridge.handleCallback(context(), callback()),
    ]);

    const tx = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/mpesa_${checkoutRequestId}`
    );
    const ledger = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/ledgerTransactions/mpesa_${checkoutRequestId}/entries`
    );
    const outbox = await firestoreClient.get<any>(
      `/tenants/${tenantId}/outbox/evt_callback_${checkoutRequestId}`
    );

    expect(tx?.status).toBe('POSTED');
    expect(ledger).toHaveLength(2);
    expect(outbox?.eventId).toBe(`evt_callback_${checkoutRequestId}`);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('reconstructs the payment after a simulated server restart', async () => {
    const bridge = new MpesaBridge();
    await bridge.handleCallback(context(), callback());

    firestoreClient.simulateServerRestart();

    const tx = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/mpesa_${checkoutRequestId}`
    );
    const outbox = await firestoreClient.get<any>(
      `/tenants/${tenantId}/outbox/evt_callback_${checkoutRequestId}`
    );

    expect(tx?.status).toBe('POSTED');
    expect(outbox?.status).toBe('PENDING');
  });
});
