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
    expect(tx?.providerReceiptReference).toBe('QAB123XYZ');
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
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
  });




  it('rejects a reused callback idempotency key when the provider result changes', async () => {
    const bridge = new MpesaBridge();
    await bridge.handleCallback(context(), callback());

    const conflicting = callback();
    conflicting.Body.stkCallback.ResultCode = 1032;
    conflicting.Body.stkCallback.ResultDesc = 'Conflicting provider result';

    await expect(bridge.handleCallback(context(), conflicting)).rejects.toThrow(
      'idempotency key conflicts with a different provider result'
    );

    const tx = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/mpesa_${checkoutRequestId}`
    );
    expect(tx?.status).toBe('POSTED');
    expect(tx?.providerReceiptReference).toBe('QAB123XYZ');
  });

  it('rejects provider-supplied tenant metadata that conflicts with authoritative request tenant', async () => {
    const bridge = new MpesaBridge();
    const crossTenant = callback();
    crossTenant.tenantId = 'tenant_attacker';

    await expect(bridge.handleCallback(context(), crossTenant)).rejects.toThrow(
      'Cross-Tenant Mutation Denied'
    );

    const attackerTransaction = await firestoreClient.get<any>(
      `/tenants/tenant_attacker/financialTransactions/mpesa_${checkoutRequestId}`
    );
    expect(attackerTransaction).toBeNull();

    const authoritativeTransaction = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/mpesa_${checkoutRequestId}`
    );
    expect(authoritativeTransaction?.status).toBe('PENDING');
  });

  it('persists a failed provider callback as FAILED without creating ledger entries', async () => {
    const bridge = new MpesaBridge();
    const failed = callback();
    failed.Body.stkCallback.ResultCode = 1032;
    failed.Body.stkCallback.ResultDesc = 'Request cancelled by user';

    await bridge.handleCallback(context(), failed);

    const tx = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/mpesa_${checkoutRequestId}`
    );
    const ledger = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/ledgerTransactions/mpesa_${checkoutRequestId}/entries`
    );

    expect(tx?.status).toBe('FAILED');
    expect(ledger).toHaveLength(0);
  });

  it('preserves POSTED state and receipt reference across restart and duplicate replay', async () => {
    const bridge = new MpesaBridge();
    await bridge.handleCallback(context(), callback());

    firestoreClient.simulateServerRestart();

    await bridge.handleCallback(context(), callback());

    const tx = await firestoreClient.get<any>(
      `/tenants/${tenantId}/financialTransactions/mpesa_${checkoutRequestId}`
    );
    const ledger = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/ledgerTransactions/mpesa_${checkoutRequestId}/entries`
    );

    expect(tx?.status).toBe('POSTED');
    expect(tx?.providerReceiptReference).toBe('QAB123XYZ');
    expect(ledger).toHaveLength(2);
  });

  it('repairs a callback replay after financial truth committed but callback claim was lost', async () => {
    const bridge = new MpesaBridge();
    await bridge.handleCallback(context(), callback());

    await firestoreClient.delete(
      `/tenants/${tenantId}/idempotency/mpesa_callback_${checkoutRequestId}`
    );

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
    expect(tx?.providerReceiptReference).toBe('QAB123XYZ');
    expect(ledger).toHaveLength(2);
    expect(outbox?.eventType).toBe('payment.confirmed.v1');
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
