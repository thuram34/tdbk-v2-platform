import { beforeEach, describe, expect, it } from 'vitest';
import { experienceResolver } from '../experienceResolver';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import type { SecurityContext } from '../../kernel/types';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { provisioningService } from '../../platform/provisioning/provisioningService';

const tenantId = 'tenant_resolver_sale_test';
const branchId = `${tenantId}_hq`;
const inventoryRecordId = 'stock_item_001';

function makeContext(
  overrides: Partial<SecurityContext> = {},
): SecurityContext {
  return {
    requestId: `req-${Date.now()}-${Math.random()}`,
    correlationId: `corr-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    principal: {
      id: 'cashier_resolver_001',
      email: 'cashier@test.local',
      isMaster: false,
      tenantId,
      branchId,
      roles: ['CASHIER'],
      permissions: ['execute:sales'],
      authTime: Date.now(),
      tokenSource: 'JWT',
    },
    tenantContext: {
      tenantId,
      name: 'Resolver Sale Test Tenant',
      blueprintId: 'hardware_v1',
      status: 'ACTIVE',
    },
    branchContext: {
      branchId,
      name: 'Main Branch',
      isHeadquarters: true,
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

async function seedInventory(
  quantityOnHand = 10,
  price = 100,
) {
  await firestoreClient.set(
    `/tenants/${tenantId}/entities/stock_control/records/${inventoryRecordId}`,
    {
      id: inventoryRecordId,
      entityType: 'stock_control',
      primaryIdentifier: inventoryRecordId,
      status: 'ACTIVE',
      branchId,
      attributes: {
        quantityOnHand,
        unitPrice: price,
        productName: 'Resolver Test Product',
        sku: 'RESOLVER-001',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );
}

describe('ExperienceResolver EXECUTE_SALE binding', () => {
  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
    dbkCapabilityManager.clearStoreForTesting();
    provisioningService.clearStoreForTesting();

    await provisioningService.provisionDbk({
      requestId: `resolver-provision-${Date.now()}`,
      correlationId: `resolver-provision-${Date.now()}`,
      timestamp: new Date().toISOString(),
      principal: {
        id: 'resolver_test_master',
        tenantId: 'master',
        branchId: null,
        roles: ['TDBK_MASTER_ADMIN'],
        permissions: ['*'],
        authTime: Date.now(),
        tokenSource: 'TEST',
        isMaster: true,
      },
      tenantContext: null,
      branchContext: null,
    }, {
      dbkId: tenantId,
      legalName: 'Resolver Sale Test Tenant',
      displayName: 'Resolver Sale Test Tenant',
      blueprintId: 'hardware_v1',
      subscriptionTier: 'FOUNDATION',
      primaryBranchName: 'Main Branch',
    });

    dbkCapabilityManager.saveDbkCapabilityRecord(makeContext(), {
      dbkId: tenantId,
      capabilityId: 'sales_counter',
      capabilityVersion: '1.0.0',
      state: 'ENABLED',
      entitlement: 'ENTITLED',
      configurationState: { isConfigured: true },
      updatedAt: new Date().toISOString(),
    });
  });

  it('BIND_01: dispatches EXECUTE_SALE to SaleTransactionService and completes the transaction', async () => {
    await seedInventory(10, 100);

    const context = makeContext();

    const response = await experienceResolver.dispatchCommand(context, {
      commandType: 'EXECUTE_SALE',
      targetDbkId: tenantId,
      payload: {
        saleId: 'resolver_sale_001',
        branchId,
        items: [
          {
            inventoryRecordId,
            quantity: 2,
          },
        ],
        paymentStatus: 'PAID',
      },
    });

    expect(response.success).toBe(true);
    expect(response.commandType).toBe('EXECUTE_SALE');
    expect(response.targetDbkId).toBe(tenantId);

    const result = response.result as Record<string, unknown>;

    expect(result.saleId).toBe('resolver_sale_001');
    expect(result.totalAmountKes).toBe(200);
    expect(result.currency).toBe('KES');
    expect(result.status).toBe('COMPLETED');
    expect(result.idempotent).toBe(false);
    expect(typeof result.eventId).toBe('string');
  });

  it('BIND_02: returns a structured authorization failure when caller lacks execute:sales permission', async () => {
    await seedInventory(10, 100);

    const baseContext = makeContext();

    const context = makeContext({
      principal: {
        ...baseContext.principal,
        permissions: ['read:pos'],
      },
    });

    const response = await experienceResolver.dispatchCommand(context, {
      commandType: 'EXECUTE_SALE',
      targetDbkId: tenantId,
      payload: {
        saleId: 'resolver_sale_unauthorized',
        branchId,
        items: [
          {
            inventoryRecordId,
            quantity: 1,
          },
        ],
      },
    });

    expect(response.success).toBe(false);
    expect(response.commandType).toBe('EXECUTE_SALE');
    expect(response.targetDbkId).toBe(tenantId);
    expect(response.error?.code).toBe('AUTHORIZATION_ERROR');
    expect(response.error?.message).toContain('execute:sales');
  });
});
