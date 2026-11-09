import { beforeEach, describe, expect, it } from 'vitest';
import { stockMovementService, validateStockMovementInput } from './stockMovementService';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { branchRepository } from '../../persistence/firestore/repositories/branchRepository';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import type { SecurityContext } from '../../kernel/types';

const tenantId = 'tenant_stock_movement_test';
const sourceBranchId = 'branch_main';
const destinationBranchId = 'branch_second';
const sourceItemId = 'sku_test_source';
const destinationItemId = 'sku_test_destination';

function makeContext(overrides: Partial<SecurityContext> = {}): SecurityContext {
  return {
    requestId: `req-${Date.now()}-${Math.random()}`,
    correlationId: `corr-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    principal: {
      id: 'inventory_manager',
      email: 'inventory@test.local',
      isMaster: false,
      tenantId,
      branchId: sourceBranchId,
      roles: ['STORE_OWNER'],
      permissions: ['manage:inventory', 'manage:stock'],
      authTime: Date.now(),
      tokenSource: 'JWT',
    },
    tenantContext: {
      tenantId,
      name: 'Stock Movement Test Tenant',
      blueprintId: 'hardware_v1',
      status: 'ACTIVE',
    },
    branchContext: {
      branchId: sourceBranchId,
      name: 'Main Branch',
      isHeadquarters: true,
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

async function seedCapability(): Promise<void> {
  const context = makeContext();
  const record = dbkCapabilityManager.saveDbkCapabilityRecord(context, {
    dbkId: tenantId,
    capabilityId: 'stock_control',
    capabilityVersion: '1.0.0',
    state: 'ENABLED',
    entitlement: 'ENTITLED',
    configurationState: { isConfigured: true },
    updatedAt: new Date().toISOString(),
  });
  await dbkCapabilityManager.persistCapabilityRecord(context, record);
}

async function seedItem(
  id: string,
  branchId: string,
  quantityOnHand: number,
): Promise<void> {
  await firestoreClient.set(
    `/tenants/${tenantId}/entities/stock_control/records/${id}`,
    {
      id,
      entityType: 'stock_control',
      primaryIdentifier: 'SKU-001',
      secondaryIdentifier: 'Test Product',
      status: 'ACTIVE',
      branchId,
      attributes: { skuCode: 'SKU-001', quantityOnHand, unitPrice: 100, itemName: 'Test Product' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );
}

describe('StockMovementService', () => {
  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
    dbkCapabilityManager.clearStoreForTesting();
    await branchRepository.saveBranch(tenantId, sourceBranchId, {
      branchId: sourceBranchId, dbkId: tenantId, name: 'Main Branch', type: 'RETAIL_OUTLET',
      status: 'ACTIVE', isHeadquarters: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await branchRepository.saveBranch(tenantId, destinationBranchId, {
      branchId: destinationBranchId, dbkId: tenantId, name: 'Second Branch', type: 'RETAIL_OUTLET',
      status: 'ACTIVE', isHeadquarters: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await seedCapability();
  });

  it('validates identifiers, quantities, reasons and transfer destinations', () => {
    expect(() => validateStockMovementInput({
      movementId: 'move_001', movementType: 'RECEIVE', inventoryRecordId: sourceItemId,
      quantity: 2, reason: 'Supplier delivery',
    }, 'req')).not.toThrow();
    expect(() => validateStockMovementInput({
      movementId: 'move_002', movementType: 'ISSUE', inventoryRecordId: sourceItemId,
      quantity: 0, reason: 'Issue',
    }, 'req')).toThrow(/positive safe integer/i);
    expect(() => validateStockMovementInput({
      movementId: 'move_003', movementType: 'TRANSFER', inventoryRecordId: sourceItemId,
      quantity: 1, reason: 'Transfer',
    }, 'req')).toThrow(/destinationBranchId/i);
  });

  it('posts a receipt atomically, appends a movement record and emits an outbox event', async () => {
    await seedItem(sourceItemId, sourceBranchId, 5);
    const result = await stockMovementService.recordMovement(makeContext(), tenantId, {
      movementId: 'move_receive_001', movementType: 'RECEIVE', inventoryRecordId: sourceItemId,
      quantity: 4, reason: 'Supplier delivery', reference: 'GRN-001',
    });
    expect(result).toMatchObject({ movementId: 'move_receive_001', sourceBalance: 9, status: 'POSTED', idempotent: false });
    const item: any = await firestoreClient.get(`/tenants/${tenantId}/entities/stock_control/records/${sourceItemId}`);
    expect(item.attributes.quantityOnHand).toBe(9);
    const movement: any = await firestoreClient.get(`/tenants/${tenantId}/entities/stock_movements/records/move_receive_001`);
    expect(movement.attributes.reason).toBe('Supplier delivery');
    const outbox = await outboxRepository.getOutbox(tenantId, 'stock-movement-move_receive_001');
    expect(outbox?.eventType).toBe('inventory.stock.movement_posted');
    expect(outbox?.branchId).toBe(sourceBranchId);
  });

  it('prevents negative stock and leaves no movement or outbox record', async () => {
    await seedItem(sourceItemId, sourceBranchId, 2);
    await expect(stockMovementService.recordMovement(makeContext(), tenantId, {
      movementId: 'move_issue_001', movementType: 'ISSUE', inventoryRecordId: sourceItemId,
      quantity: 3, reason: 'Counter issue',
    })).rejects.toThrow(/Insufficient stock/i);
    const item: any = await firestoreClient.get(`/tenants/${tenantId}/entities/stock_control/records/${sourceItemId}`);
    expect(item.attributes.quantityOnHand).toBe(2);
    expect(await firestoreClient.get(`/tenants/${tenantId}/entities/stock_movements/records/move_issue_001`)).toBeNull();
    expect(await outboxRepository.getOutbox(tenantId, 'stock-movement-move_issue_001')).toBeNull();
  });

  it('makes identical retries idempotent and rejects movement ID reuse with different data', async () => {
    await seedItem(sourceItemId, sourceBranchId, 5);
    const input = {
      movementId: 'move_retry_001', movementType: 'RECEIVE' as const, inventoryRecordId: sourceItemId,
      quantity: 2, reason: 'Supplier delivery',
    };
    const first = await stockMovementService.recordMovement(makeContext(), tenantId, input);
    const retry = await stockMovementService.recordMovement(makeContext(), tenantId, input);
    expect(first.idempotent).toBe(false);
    expect(retry.idempotent).toBe(true);
    await expect(stockMovementService.recordMovement(makeContext(), tenantId, {
      ...input, quantity: 3,
    })).rejects.toThrow(/different stock movement/i);
    const item: any = await firestoreClient.get(`/tenants/${tenantId}/entities/stock_control/records/${sourceItemId}`);
    expect(item.attributes.quantityOnHand).toBe(7);
  });

  it('transfers stock between branch-owned records in one atomic transaction for an authorised tenant-wide stock manager', async () => {
    await seedItem(sourceItemId, sourceBranchId, 8);
    await seedItem(destinationItemId, destinationBranchId, 1);
    const tenantWideContext = makeContext({
      principal: {
        ...makeContext().principal,
        roles: ['TENANT_ADMIN', 'STORE_OWNER'],
      },
    });
    const result = await stockMovementService.recordMovement(tenantWideContext, tenantId, {
      movementId: 'move_transfer_001', movementType: 'TRANSFER', inventoryRecordId: sourceItemId,
      destinationBranchId, destinationInventoryRecordId: destinationItemId, quantity: 3,
      reason: 'Rebalance branch stock',
    });
    expect(result).toMatchObject({ sourceBalance: 5, destinationBalance: 4, status: 'POSTED' });
    const source: any = await firestoreClient.get(`/tenants/${tenantId}/entities/stock_control/records/${sourceItemId}`);
    const destination: any = await firestoreClient.get(`/tenants/${tenantId}/entities/stock_control/records/${destinationItemId}`);
    expect(source.attributes.quantityOnHand).toBe(5);
    expect(destination.attributes.quantityOnHand).toBe(4);
  });

  it('rejects inventory from another source branch and mismatched destination SKU', async () => {
    await seedItem(sourceItemId, destinationBranchId, 5);
    await expect(stockMovementService.recordMovement(makeContext(), tenantId, {
      movementId: 'move_wrong_branch', movementType: 'ISSUE', inventoryRecordId: sourceItemId,
      quantity: 1, reason: 'Wrong branch',
    })).rejects.toThrow(/active branch/i);
    await seedItem(sourceItemId, sourceBranchId, 5);
    await seedItem(destinationItemId, destinationBranchId, 1);
    await firestoreClient.update(`/tenants/${tenantId}/entities/stock_control/records/${destinationItemId}`, {
      attributes: { skuCode: 'OTHER-SKU', quantityOnHand: 1 },
    });
    const tenantWideContext = makeContext({
      principal: {
        ...makeContext().principal,
        roles: ['TENANT_ADMIN', 'STORE_OWNER'],
      },
    });
    await expect(stockMovementService.recordMovement(tenantWideContext, tenantId, {
      movementId: 'move_wrong_sku', movementType: 'TRANSFER', inventoryRecordId: sourceItemId,
      destinationBranchId, destinationInventoryRecordId: destinationItemId, quantity: 1,
      reason: 'Wrong SKU',
    })).rejects.toThrow(/same SKU/i);
  });
});
