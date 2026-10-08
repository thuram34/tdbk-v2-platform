import { beforeEach, describe, expect, it } from 'vitest';
import type { SecurityContext } from '../../kernel/types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { dbkRegistry } from '../../platform/dbkRegistry';
import { provisioningService } from '../../platform/provisioning/provisioningService';
import { experienceResolver } from '../../experience/experienceResolver';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { subscriptionService } from '../../platform/subscription/subscriptionService';
import { handleSubscriptionPaymentConfirmed } from '../../platform/subscription/subscriptionPaymentHandler';
import { spaceMembershipRepository } from '../../persistence/firestore/repositories/spaceMembershipRepository';
import { connectorConnectionRepository } from '../../persistence/firestore/repositories/connectorConnectionRepository';
import { connectorReadinessService } from '../../platform/connectors/connectorReadinessService';
import { connectionHub } from '../../orchestration/bridge/connectionHub';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { eventBus } from '../../orchestration/events/eventBus';

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

function tenantOwnerContext(branchId: string): SecurityContext {
  return {
    requestId: 'canonical-owner-runtime-request',
    correlationId: 'canonical-owner-runtime-correlation',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'canonical-owner',
      email: 'owner@tdbk.test',
      isMaster: false,
      tenantId: dbkId,
      branchId,
      roles: ['OWNER_OPERATOR'],
      permissions: ['TENANT_ADMIN', 'BRANCH_MANAGE', 'STAFF_MANAGE', 'DBK_MANAGE', 'connectors:write'],
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

    const ownerMemberships = await spaceMembershipRepository.listMemberships(dbkId, 'canonical-owner');
    expect(ownerMemberships.some((membership) => membership.role === 'OWNER_OPERATOR' && membership.status === 'ACTIVE')).toBe(true);

    const ownerAuthorized = await rbacEngine.authorizeAsync(
      ownerContext().principal,
      'READ_WORKSPACE',
      'dbk:' + dbkId,
      { tenantId: dbkId, requiredPermission: 'TENANT_ADMIN' },
    );
    expect(ownerAuthorized.allowed).toBe(true);

    const branchId = provisioned.branches[0].branchId;
    await spaceMembershipRepository.saveMembership({ membershipId: `mem_${dbkId}_cashier`, userId: 'canonical-cashier', spaceId: branchId, tenantId: dbkId, role: 'CASHIER', roleTitle: 'Cashier', status: 'ACTIVE', joinedAt: new Date().toISOString(), permissions: ['execute:sales', 'read:pos'] });
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
    expect(preSubscriptionEnable.success).toBe(false);
    expect(preSubscriptionEnable.error?.code).toBe('AUTHORIZATION_ERROR');

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

    await connectorConnectionRepository.saveConnection(dbkId, 'conn_mpesa', {
      connectionId: 'conn_mpesa',
      tenantId: dbkId,
      bridgeId: 'bridge_mpesa',
      provider: 'SAFARICOM_MPESA',
      status: 'CONFIGURED',
      enabled: true,
      configurationVersion: 1,
      parameters: {
        MPESA_SHORTCODE: '174379',
        MPESA_CALLBACK_URL: 'https://example.test/mpesa/callback',
      },
      secretRefs: {
        MPESA_CONSUMER_KEY: { provider: 'GCP_SECRET_MANAGER', name: 'tdbk/test/mpesa/consumer-key' },
        MPESA_CONSUMER_SECRET: { provider: 'GCP_SECRET_MANAGER', name: 'tdbk/test/mpesa/consumer-secret' },
        MPESA_PASSKEY: { provider: 'GCP_SECRET_MANAGER', name: 'tdbk/test/mpesa/passkey' },
      },
      configuredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastHealthCheckAt: null,
      lastHealthStatus: 'UNKNOWN',
      lastErrorCode: null,
    });

    const connectorHealth = await connectionHub.health(tenantOwnerContext(branchId), 'bridge_mpesa');
    expect(connectorHealth.status).toBe('HEALTHY');

    const connectorReport = await connectorReadinessService.inspect(tenantOwnerContext(branchId), dbkId);
    const mpesa = connectorReport.items.find((item) => item.bridgeId === 'bridge_mpesa');
    expect(mpesa?.connectionStatus).toBe('CONFIGURED');
    expect(mpesa?.enabled).toBe(true);
    expect(mpesa?.healthStatus).toBe('HEALTHY');
    expect(mpesa?.ready).toBe(true);
    expect(mpesa?.blockers).toEqual([]);

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
    expect((persistedStock as any)?.attributes?.quantityOnHand).toBe(3);
    expect(persistedOutbox).toBeTruthy();
    expect(persistedOutbox?.status).toBe('PENDING');
    expect(persistedOutbox?.eventType).toBe('pos.sale.completed.v1');

    const delivery = await outboxEngine.processTenantOutbox(
      dbkId,
      'canonical-journey-worker',
      30000,
      async (event) => eventBus.publish(event),
    );

    expect(delivery.succeeded).toBeGreaterThanOrEqual(1);

    const deliveredOutbox = await outboxRepository.getOutbox(
      dbkId,
      'sale-canonical-sale-001',
    );
    expect(deliveredOutbox?.status).toBe('DELIVERED');

    const workflows = await (await import('../../persistence/firestore/repositories/workflowInstanceRepository')).workflowInstanceRepository.listWorkflows(dbkId);
    const checkoutWorkflow = workflows.find((candidate) => candidate.workflowType === 'wf_execute_checkout');
    expect(checkoutWorkflow).toBeDefined();
    expect(checkoutWorkflow?.status).toBe('COMPLETED');
    expect(checkoutWorkflow?.metadata.triggerEventId).toBe('sale-canonical-sale-001');
    expect(checkoutWorkflow?.steps[0].status).toBe('COMPLETED');
    expect(checkoutWorkflow?.steps[0].output).toMatchObject({
      operation: 'POS_CHECKOUT',
      saleId: 'canonical-sale-001',
      branchId,
      saleStatus: 'COMPLETED',
      totalAmountKes: 500,
      reconciledAgainstPersistedSale: true,
    });
  });
});
