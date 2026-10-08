import { describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { eventBus } from '../../orchestration/events/eventBus';

describe('Retail POS M-Pesa authoritative payment lifecycle', () => {
  it('moves a completed sale from PENDING to PAID only after posted provider truth and creates a receipt', async () => {
    const tenantId = 'tenant_retail_mpesa_01';
    const branchId = 'branch_retail_mpesa_01';
    const saleId = 'sale-retail-mpesa-001';
    const checkoutRequestId = 'CO_RETAIL_E2E_001';
    const transactionId = `mpesa_${checkoutRequestId}`;
    const now = new Date().toISOString();

    await firestoreClient.set(`/tenants/${tenantId}/entities/sales_counter/records/${saleId}`, {
      id: saleId,
      entityType: 'sale',
      primaryIdentifier: saleId,
      status: 'COMPLETED',
      branchId,
      tenantId,
      attributes: { totalAmountKes: 500, currency: 'KES', paymentStatus: 'PENDING' },
      createdAt: now,
      updatedAt: now,
    });

    await firestoreClient.set(`/tenants/${tenantId}/entities/payment_intents/records/${saleId}`, {
      paymentIntentId: `sale_payment_${saleId}`,
      tenantId,
      saleId,
      branchId,
      status: 'PENDING',
      amountKes: 500,
      currency: 'KES',
      transactionId,
      providerReference: checkoutRequestId,
      createdAt: now,
      updatedAt: now,
    });

    await firestoreClient.set(`/tenants/${tenantId}/financialTransactions/${transactionId}`, {
      transactionId,
      tenantId,
      branchId,
      source: 'MPESA',
      providerReference: checkoutRequestId,
      providerReceiptReference: 'QWE123MPESA',
      amount: 500,
      currency: 'KES',
      status: 'POSTED',
      description: `TDBK POS sale ${saleId}`,
      correlationId: 'corr_retail_mpesa_01',
      createdAt: now,
      postedAt: now,
      reversedAt: null,
    });

    const event = {
      eventId: `evt_pos_mpesa_confirmed_${saleId}`,
      eventType: 'payment.confirmed.v1',
      eventVersion: 'v1',
      occurredAt: now,
      tenantId,
      branchId,
      principalId: 'cashier-retail-e2e',
      correlationId: 'corr_retail_mpesa_01',
      source: 'MpesaBridge',
      payload: {
        transactionId,
        checkoutRequestId,
        providerReference: 'QWE123MPESA',
        amount: 500,
        currency: 'KES',
        status: 'SUCCESS',
      },
      metadata: { paymentMethod: 'MPESA_STK_PUSH' },
    } as any;

    await eventBus.publish(event);
    await eventBus.publish(event);

    const sale = await firestoreClient.get<any>(`/tenants/${tenantId}/entities/sales_counter/records/${saleId}`);
    const intent = await firestoreClient.get<any>(`/tenants/${tenantId}/entities/payment_intents/records/${saleId}`);
    const receipts = await firestoreClient.listCollection<any>(`/tenants/${tenantId}/receipts`);

    expect(sale?.attributes?.paymentStatus).toBe('PAID');
    expect(sale?.attributes?.paymentTransactionId).toBe(transactionId);
    expect(intent?.status).toBe('CONFIRMED');
    expect(receipts.filter((receipt) => receipt.transactionId === transactionId)).toHaveLength(1);
  });

  it('does not mark the sale paid from an unposted financial transaction', async () => {
    const tenantId = 'tenant_retail_mpesa_02';
    const branchId = 'branch_retail_mpesa_02';
    const saleId = 'sale-retail-mpesa-002';
    const checkoutRequestId = 'CO_RETAIL_E2E_002';
    const transactionId = `mpesa_${checkoutRequestId}`;
    const now = new Date().toISOString();

    await firestoreClient.set(`/tenants/${tenantId}/entities/sales_counter/records/${saleId}`, {
      id: saleId, entityType: 'sale', primaryIdentifier: saleId, status: 'COMPLETED', branchId, tenantId,
      attributes: { totalAmountKes: 750, currency: 'KES', paymentStatus: 'PENDING' }, createdAt: now, updatedAt: now,
    });
    await firestoreClient.set(`/tenants/${tenantId}/entities/payment_intents/records/${saleId}`, {
      paymentIntentId: `sale_payment_${saleId}`, tenantId, saleId, branchId, status: 'PENDING',
      amountKes: 750, currency: 'KES', transactionId, providerReference: checkoutRequestId, createdAt: now, updatedAt: now,
    });
    await firestoreClient.set(`/tenants/${tenantId}/financialTransactions/${transactionId}`, {
      transactionId, tenantId, branchId, source: 'MPESA', providerReference: checkoutRequestId,
      amount: 750, currency: 'KES', status: 'PENDING', description: `TDBK POS sale ${saleId}`,
      correlationId: 'corr_retail_mpesa_02', createdAt: now, postedAt: null, reversedAt: null,
    });

    await eventBus.publish({
      eventId: `evt_pos_mpesa_unposted_${saleId}`,
      eventType: 'payment.confirmed.v1',
      eventVersion: 'v1',
      occurredAt: now,
      tenantId,
      branchId,
      principalId: 'cashier-retail-e2e',
      correlationId: 'corr_retail_mpesa_02',
      source: 'MpesaBridge',
      payload: { transactionId, checkoutRequestId, providerReference: 'UNPOSTED', amount: 750, currency: 'KES', status: 'SUCCESS' },
      metadata: { paymentMethod: 'MPESA_STK_PUSH' },
    } as any);

    const sale = await firestoreClient.get<any>(`/tenants/${tenantId}/entities/sales_counter/records/${saleId}`);
    expect(sale?.attributes?.paymentStatus).toBe('PENDING');
  });
});
