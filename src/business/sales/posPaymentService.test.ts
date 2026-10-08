import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { posPaymentService } from './posPaymentService';
import { mpesaBridge } from '../../orchestration/bridge/adapters/mpesaBridge';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { eventBus } from '../../orchestration/events/eventBus';

const tenantId = 'tenant_pos_mpesa_e2e';
const branchId = 'branch_main';
const saleId = 'sale-mpesa-e2e-001';

function context() {
  return {
    requestId: 'req-pos-mpesa-e2e',
    correlationId: 'corr-pos-mpesa-e2e',
    principal: {
      id: 'usr_cashier',
      tenantId,
      branchId,
      roles: ['CASHIER'],
      permissions: ['execute:sales'],
      isMaster: false,
    },
    tenantContext: { tenantId },
    branchContext: { branchId },
  } as any;
}

describe('Retail POS -> M-Pesa end-to-end operation', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
    eventBus.clearStoreForTesting();
    process.env.NODE_ENV = 'test';
    process.env.TDBK_PERSISTENCE_DRIVER = 'test_memory';
  });

  it('keeps sale, payment initiation, provider callback and confirmed sale state connected', async () => {
    await firestoreClient.set('/tenants/' + tenantId + '/entities/sales_counter/records/' + saleId, {
      id: saleId,
      entityType: 'sale',
      primaryIdentifier: saleId,
      status: 'COMPLETED',
      branchId,
      attributes: {
        totalAmountKes: 500,
        currency: 'KES',
        paymentStatus: 'PENDING',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const initiated = await posPaymentService.initiateMpesaPayment(context(), tenantId, {
      saleId,
      phoneNumber: '0712345678',
    });

    expect(initiated.status).toBe('PENDING');
    expect(initiated.amountKes).toBe(500);

    const pending = await firestoreClient.listCollection<any>('/tenants/' + tenantId + '/financialTransactions');
    const payment = pending.find((item) => item.providerReference === initiated.checkoutRequestId);
    expect(payment?.status).toBe('PENDING');
    expect(payment?.correlationId).toBe(saleId);

    await mpesaBridge.handleCallback(context(), {
      Body: {
        stkCallback: {
          MerchantRequestID: 'MR_POS_E2E',
          CheckoutRequestID: initiated.checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 500 },
              { Name: 'MpesaReceiptNumber', Value: 'QABPOS001' },
            ],
          },
        },
      },
      signature: 'VALID_SIG',
      tenantId,
      correlationId: 'ignored-provider-correlation',
    });

    const callbackOutbox = await firestoreClient.get<any>(
      '/tenants/' + tenantId + '/outbox/evt_callback_' + initiated.checkoutRequestId,
    );
    expect(callbackOutbox?.eventType).toBe('payment.confirmed.v1');
    expect(callbackOutbox?.status).toBe('PENDING');

    await outboxEngine.processTenantOutbox(
      tenantId,
      'worker-pos-mpesa-e2e',
      30000,
      async (event) => eventBus.publish(event as any),
    );

    const persistedSale = await firestoreClient.get<any>(
      '/tenants/' + tenantId + '/entities/sales_counter/records/' + saleId,
    );
    const financial = await firestoreClient.get<any>(
      '/tenants/' + tenantId + '/financialTransactions/mpesa_' + initiated.checkoutRequestId,
    );

    expect(financial?.status).toBe('POSTED');
    expect(financial?.providerReceiptReference).toBe('QABPOS001');
    expect(persistedSale?.attributes?.paymentStatus).toBe('PAID');
    expect(persistedSale?.attributes?.paymentProvider).toBe('SAFARICOM_MPESA');
    expect(persistedSale?.attributes?.paymentProviderReference).toBe(initiated.checkoutRequestId);
  });
});
