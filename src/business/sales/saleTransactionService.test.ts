import { beforeEach, describe, expect, it } from 'vitest';
import { saleTransactionService } from './saleTransactionService';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import type { SecurityContext } from '../../kernel/types';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { branchRepository } from '../../persistence/firestore/repositories/branchRepository';
import { spaceMembershipRepository } from '../../persistence/firestore/repositories/spaceMembershipRepository';

const tenantId = 'tenant_sale_test';
const branchId = 'branch_main';
const inventoryRecordId = 'stock_item_001';

function makeContext(
  overrides: Partial<SecurityContext> = {},
): SecurityContext {
  return {
    requestId: `req-${Date.now()}-${Math.random()}`,
    correlationId: `corr-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    principal: {
      id: 'cashier_001',
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
      name: 'Sale Test Tenant',
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
  tenant = tenantId,
  branch = branchId,
) {
  await firestoreClient.set(
    `/tenants/${tenant}/entities/stock_control/records/${inventoryRecordId}`,
    {
      id: inventoryRecordId,
      entityType: 'stock_control',
      primaryIdentifier: inventoryRecordId,
      status: 'ACTIVE',
      branchId: branch,
      attributes: {
        quantityOnHand,
        unitPrice: price,
        productName: 'Test Product',
        sku: 'TEST-001',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );
}

async function seedSalesCapability(tenant = tenantId) {
  const record = dbkCapabilityManager.saveDbkCapabilityRecord(makeContext({
    principal: {
      ...makeContext().principal,
      tenantId: tenant,
      permissions: ['execute:sales'],
      roles: ['CASHIER'],
    },
    tenantContext: {
      tenantId: tenant,
      name: 'Sale Test Tenant',
      blueprintId: 'hardware_v1',
      status: 'ACTIVE',
    },
    branchContext: {
      branchId,
      name: 'Main Branch',
      isHeadquarters: true,
      status: 'ACTIVE',
    },
  }), {
    dbkId: tenant,
    capabilityId: 'sales_counter',
    capabilityVersion: '1.0.0',
    state: 'ENABLED',
    entitlement: 'ENTITLED',
    configurationState: { isConfigured: true },
    updatedAt: new Date().toISOString(),
  });
  await dbkCapabilityManager.persistCapabilityRecord(makeContext({
    principal: {
      ...makeContext().principal,
      tenantId: tenant,
      permissions: ['execute:sales'],
      roles: ['CASHIER'],
    },
    tenantContext: {
      tenantId: tenant,
      name: 'Sale Test Tenant',
      blueprintId: 'hardware_v1',
      status: 'ACTIVE',
    },
    branchContext: {
      branchId,
      name: 'Main Branch',
      isHeadquarters: true,
      status: 'ACTIVE',
    },
  }), record);
}

describe('SaleTransactionService', () => {
  it('SALE_00: rejects a sale when the sales capability is not entitled or operational', async () => {
    await seedInventory(10, 100);
    dbkCapabilityManager.saveDbkCapabilityRecord(makeContext(), {
      dbkId: tenantId,
      capabilityId: 'sales_counter',
      capabilityVersion: '1.0.0',
      state: 'DISCOVERABLE',
      entitlement: 'UPGRADE_REQUIRED',
      configurationState: { isConfigured: false },
      updatedAt: new Date().toISOString(),
    });

    await expect(
      saleTransactionService.executeSale(
        makeContext(),
        tenantId,
        {
          saleId: 'sale_000',
          items: [{ inventoryRecordId, quantity: 1 }],
          paymentStatus: 'PAID',
        },
      ),
    ).rejects.toThrow(/not entitled|not operational/i);
  });

  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
    dbkCapabilityManager.clearStoreForTesting();
    await branchRepository.saveBranch(tenantId, branchId, {
      branchId,
      dbkId: tenantId,
      name: 'Main Branch',
      type: 'RETAIL_OUTLET',
      status: 'ACTIVE',
      isHeadquarters: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await spaceMembershipRepository.saveMembership({ membershipId: `mem_${tenantId}_cashier`, userId: 'cashier_001', spaceId: branchId, tenantId, role: 'CASHIER', roleTitle: 'Cashier', status: 'ACTIVE', joinedAt: new Date().toISOString(), permissions: ['execute:sales'] });
    await seedSalesCapability();
  });

  it('SALE_01: completes a sale, decrements stock, persists the sale and creates the outbox event', async () => {
    await seedInventory(10, 100);

    const context = makeContext();

    const result = await saleTransactionService.executeSale(
      context,
      tenantId,
      {
        saleId: 'sale_001',
        items: [
          {
            inventoryRecordId,
            quantity: 2,
          },
        ],
        paymentStatus: 'PAID',
        customerName: 'Test Customer',
      },
    );

    expect(result).toMatchObject({
      saleId: 'sale_001',
      totalAmountKes: 200,
      currency: 'KES',
      status: 'COMPLETED',
      idempotent: false,
      eventId: 'sale-sale_001',
    });

    const stock: any = await firestoreClient.get(
      `/tenants/${tenantId}/entities/stock_control/records/${inventoryRecordId}`,
    );

    expect(stock.attributes.quantityOnHand).toBe(8);

    const sale: any = await firestoreClient.get(
      `/tenants/${tenantId}/entities/sales_counter/records/sale_001`,
    );

    expect(sale).not.toBeNull();
    expect(sale.attributes.totalAmountKes).toBe(200);
    expect(sale.attributes.paymentStatus).toBe('PAID');
    expect(sale.branchId).toBe(branchId);

    const outbox = await outboxRepository.getOutbox(
      tenantId,
      'sale-sale_001',
    );

    expect(outbox).not.toBeNull();
    expect(outbox?.status).toBe('PENDING');
    expect(outbox?.eventType).toBe('pos.sale.completed.v1');
    expect(outbox?.eventVersion).toBe('v1');
    expect(outbox?.tenantId).toBe(tenantId);
    expect(outbox?.branchId).toBe(branchId);
    expect(outbox?.correlationId).toBe(context.correlationId);
    expect(outbox?.causationId).toBe(context.requestId);
  });

  it('SALE_02: insufficient stock rolls back stock, sale and outbox', async () => {
    await seedInventory(1, 100);

    const context = makeContext();

    await expect(
      saleTransactionService.executeSale(
        context,
        tenantId,
        {
          saleId: 'sale_002',
          items: [
            {
              inventoryRecordId,
              quantity: 2,
            },
          ],
        },
      ),
    ).rejects.toThrow(/Insufficient stock/i);

    const stock: any = await firestoreClient.get(
      `/tenants/${tenantId}/entities/stock_control/records/${inventoryRecordId}`,
    );

    expect(stock.attributes.quantityOnHand).toBe(1);

    const sale = await firestoreClient.get(
      `/tenants/${tenantId}/entities/sales_counter/records/sale_002`,
    );

    expect(sale).toBeNull();

    const outbox = await outboxRepository.getOutbox(
      tenantId,
      'sale-sale_002',
    );

    expect(outbox).toBeNull();
  });

  it('SALE_03: rejects stock belonging to another branch', async () => {
    await seedInventory(10, 100, tenantId, 'branch_other');

    const context = makeContext();

    await expect(
      saleTransactionService.executeSale(
        context,
        tenantId,
        {
          saleId: 'sale_003',
          items: [
            {
              inventoryRecordId,
              quantity: 1,
            },
          ],
        },
      ),
    ).rejects.toThrow(/branch/i);

    const sale = await firestoreClient.get(
      `/tenants/${tenantId}/entities/sales_counter/records/sale_003`,
    );

    expect(sale).toBeNull();

    const outbox = await outboxRepository.getOutbox(
      tenantId,
      'sale-sale_003',
    );

    expect(outbox).toBeNull();
  });

  it('SALE_04: rejects a principal without execute:sales permission', async () => {
    await seedInventory();

    const context = makeContext({
      principal: {
        ...makeContext().principal,
        permissions: [],
      },
    });

    await expect(
      saleTransactionService.executeSale(
        context,
        tenantId,
        {
          saleId: 'sale_004',
          items: [
            {
              inventoryRecordId,
              quantity: 1,
            },
          ],
        },
      ),
    ).rejects.toThrow();

    const stock: any = await firestoreClient.get(
      `/tenants/${tenantId}/entities/stock_control/records/${inventoryRecordId}`,
    );

    expect(stock.attributes.quantityOnHand).toBe(10);

    const sale = await firestoreClient.get(
      `/tenants/${tenantId}/entities/sales_counter/records/sale_004`,
    );

    expect(sale).toBeNull();
  });

  it('SALE_05: duplicate saleId is idempotent and does not deduct stock twice', async () => {
    await seedInventory(10, 100);

    const context = makeContext();

    const first = await saleTransactionService.executeSale(
      context,
      tenantId,
      {
        saleId: 'sale_005',
        items: [
          {
            inventoryRecordId,
            quantity: 3,
          },
        ],
        paymentStatus: 'PAID',
      },
    );

    const second = await saleTransactionService.executeSale(
      context,
      tenantId,
      {
        saleId: 'sale_005',
        items: [
          {
            inventoryRecordId,
            quantity: 3,
          },
        ],
        paymentStatus: 'PAID',
      },
    );

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.saleId).toBe(first.saleId);
    expect(second.eventId).toBe(first.eventId);

    const stock: any = await firestoreClient.get(
      `/tenants/${tenantId}/entities/stock_control/records/${inventoryRecordId}`,
    );

    expect(stock.attributes.quantityOnHand).toBe(7);

    const outbox = await outboxRepository.getOutbox(
      tenantId,
      'sale-sale_005',
    );

    expect(outbox).not.toBeNull();
  });

  it('SALE_06: sale, stock and outbox survive simulated process restart', async () => {
    await seedInventory(10, 100);

    const context = makeContext();

    await saleTransactionService.executeSale(
      context,
      tenantId,
      {
        saleId: 'sale_006',
        items: [
          {
            inventoryRecordId,
            quantity: 2,
          },
        ],
      },
    );

    await firestoreClient.simulateServerRestart();

    const stock: any = await firestoreClient.get(
      `/tenants/${tenantId}/entities/stock_control/records/${inventoryRecordId}`,
    );

    const sale: any = await firestoreClient.get(
      `/tenants/${tenantId}/entities/sales_counter/records/sale_006`,
    );

    const outbox = await outboxRepository.getOutbox(
      tenantId,
      'sale-sale_006',
    );

    expect(stock.attributes.quantityOnHand).toBe(8);
    expect(sale).not.toBeNull();
    expect(sale.attributes.totalAmountKes).toBe(200);
    expect(outbox).not.toBeNull();
    expect(outbox?.status).toBe('PENDING');
  });
});

export {};
