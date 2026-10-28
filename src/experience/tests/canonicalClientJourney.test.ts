import { beforeEach, describe, expect, it } from 'vitest';
import type { SecurityContext } from '../../kernel/types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { dbkRegistry } from '../../platform/dbkRegistry';
import { provisioningService } from '../../platform/provisioning/provisioningService';
import { experienceResolver } from '../../experience/experienceResolver';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { subscriptionService } from '../../platform/subscription/subscriptionService';
import { handleSubscriptionPaymentConfirmed } from '../../platform/subscription/subscriptionPaymentHandler';

const dbkId = 'canonical_journey_hardware_01';
const inventoryRecordId = 'canonical_stock_001';

function masterContext(): SecurityContext {
  return {
    requestId: 'canonical-provision-request',
    correlationId: 'canonical-provision-correlation',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'canonical-master',
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


function ownerContext(): SecurityContext {
  return {
    requestId: 'canonical-owner-provision-request',
    correlationId: 'canonical-owner-provision-correlation',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'canonical-owner',
      email: 'owner@tdbk.test',
      isMaster: false,
      tenantId: null,
      branchId: null,
      roles: ['BUSINESS_OWNER'],
      permissions: ['PORTFOLIO_READ', 'PORTFOLIO_WRITE', 'DBK_PROVISION'],
      authTime: Date.now(),
      tokenSource: 'JWT',
    },
    tenantContext: null,
    branchContext: null,
  };
}

function cashierContext(branchId: string): SecurityContext {
  return {
    requestId: 'canonical-sale-request',
    correlationId: 'canonical-sale-correlation',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'canonical-cashier',
      email: 'cashier@tdbk.test',
      isMaster: false,
      tenantId: dbkId,
      branchId,
      roles: ['CASHIER'],
      permissions: ['execute:sales', 'read:pos'],
      authTime: Date.now(),
      tokenSource: 'JWT',
    },
    tenantContext: {
      tenantId: dbkId,
      name: 'Canonical Hardware Test',
      blueprintId: 'hardware_v1',
      status: 'ACTIVE',
    },
    branchContext: {
      branchId,
      name: 'Mombasa HQ',
      isHeadquarters: true,
      status: 'ACTIVE',
    },
  };
}

describe('TDBK canonical client journey acceptance', () => {
  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
    dbkRegistry.clearStoreForTesting();
    provisioningService.clearStoreForTesting();
  });

  it('CJ_01: provisions a business, resolves its workspace, then completes an authoritative sale', async () => {
    const provisioned = await provisioningService.provisionDbk(ownerContext(), {
      dbkId,
      legalName: 'Canonical Hardware Test',
      displayName: 'Canonical Hardware',
      blueprintId: 'hardware_v1',
      subscriptionTier: 'FREE',
      primaryBranchName: 'Mombasa HQ',
      idempotencyKey: 'canonical-client-journey-v1',
    });

    expect(provisioned.success).toBe(true);
    expect(provisioned.status).toBe('ACTIVE');
    expect(provisioned.dbkId).toBe(dbkId);
    expect(provisioned.branches.length).toBeGreaterThan(0);
    expect(provisioned.subscriptionTier).toBe('FREE');

    const branchId = provisioned.branches[0].branchId;
    const preSubscriptionSale = await experienceResolver.dispatchCommand(
      cashierContext(branchId),
      {
        commandType: 'EXECUTE_SALE',
        targetDbkId: dbkId,
        payload: {
          saleId: 'canonical-sale-before-entitlement',
          branchId,
          items: [{ inventoryRecordId, quantity: 1 }],
          paymentStatus: 'PAID',
        },
      },
    );
    expect(preSubscriptionSale.success).toBe(false);
    expect(preSubscriptionSale.error?.code).toBe('AUTHORIZATION_ERROR');

    const preSubscriptionEnable = await experienceResolver.dispatchCommand(
      ownerContext(),
      {
        commandType: 'ENABLE_CAPABILITY',
        targetDbkId: dbkId,
        payload: { capabilityId: 'sales_counter' },
      },
    );
    expect(preSubscriptionEnable.success).toBe(true);

    // FREE tier must support a real sale, not just registration and workspace viewing.
    const freeSale = await experienceResolver.dispatchCommand(
      cashierContext(branchId),
      {
        commandType: 'EXECUTE_SALE',
        targetDbkId: dbkId,
        payload: {
          saleId: 'canonical-free-sale-001',
          branchId,
          items: [{ inventoryRecordId, quantity: 1 }],
          paymentStatus: 'PAID',
        },
      },
    );
    expect(freeSale.success).toBe(true);
    expect(freeSale.result).toMatchObject({
      saleId: 'canonical-free-sale-001',
      totalAmountKes: 250,
      currency: 'KES',
      status: 'COMPLETED',
    });

    await subscriptionService.createSubscription(masterContext(), {
      dbkId,
      tier: 'FOUNDATION',
      amount: 2500,
      currency: 'KES',
      interval: 'MONTHLY',
      paymentReference: 'canonical-subscription-payment-001',
      provider: 'SAFARICOM_MPESA',
      status: 'TRIAL',
      paymentStatus: 'PENDING',
      correlationId: 'canonical-subscription-correlation',
    });

    await handleSubscriptionPaymentConfirmed({
      eventId: 'canonical-subscription-payment-event',
      eventType: 'payment.confirmed.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId: dbkId,
      branchId,
      principalId: 'canonical-owner',
      correlationId: 'canonical-subscription-correlation',
      causationId: 'canonical-subscription-payment-001',
      source: 'CanonicalJourneyTest',
      payload: {
        provider: 'SAFARICOM_MPESA',
        data: { checkoutRequestId: 'canonical-subscription-payment-001' },
      },
      metadata: {},
    });

    const upgradedDbk = await dbkRegistry.getDbkInternal(dbkId);
    expect(upgradedDbk?.subscriptionTier).toBe('FOUNDATION');

    const enableSales = await experienceResolver.dispatchCommand(
      ownerContext(),
      {
        commandType: 'ENABLE_CAPABILITY',
        targetDbkId: dbkId,
        payload: { capabilityId: 'sales_counter' },
      },
    );
    expect(enableSales.success).toBe(true);

    const resolved = await experienceResolver.resolveExperience(
      cashierContext(branchId),
      dbkId,
    );

    expect(resolved.dbkId).toBe(dbkId);
    expect(resolved.operationalState).toBe('ACTIVE');
    expect(resolved.activeBranch.branchId).toBe(branchId);

    await firestoreClient.set(
      `/tenants/${dbkId}/entities/stock_control/records/${inventoryRecordId}`,
      {
        id: inventoryRecordId,
        entityType: 'stock_control',
        primaryIdentifier: inventoryRecordId,
        status: 'ACTIVE',
        branchId,
        attributes: {
          quantityOnHand: 5,
          unitPrice: 250,
          itemName: 'Canonical Test Item',
          skuCode: 'CANONICAL-001',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    );

    const sale = await experienceResolver.dispatchCommand(
      cashierContext(branchId),
      {
        commandType: 'EXECUTE_SALE',
        targetDbkId: dbkId,
        payload: {
          saleId: 'canonical-sale-001',
          branchId,
          items: [{ inventoryRecordId, quantity: 2 }],
          paymentStatus: 'PAID',
        },
      },
    );

    expect(sale.success).toBe(true);
    expect(sale.result).toMatchObject({
      saleId: 'canonical-sale-001',
      totalAmountKes: 500,
      currency: 'KES',
      status: 'COMPLETED',
      idempotent: false,
      eventId: 'sale-canonical-sale-001',
    });

    const persistedSale = await firestoreClient.get(
      `/tenants/${dbkId}/entities/sales_counter/records/canonical-sale-001`,
    );
    const persistedStock = await firestoreClient.get(
      `/tenants/${dbkId}/entities/stock_control/records/${inventoryRecordId}`,
    );
    const persistedOutbox = await outboxRepository.getOutbox(
      dbkId,
      'sale-canonical-sale-001',
    );

    expect(persistedSale).toBeTruthy();
    expect((persistedStock as any)?.attributes?.quantityOnHand).toBe(2);
    expect(persistedOutbox).toBeTruthy();
  });
});
