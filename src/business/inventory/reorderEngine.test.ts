import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { reorderEngine } from './reorderEngine';

const tenantId = 'reorder-test-tenant';
const branchId = 'reorder-test-branch';
const inventoryRecordId = 'reorder-stock-001';

const saleEvent = {
  eventId: 'sale-reorder-test-001',
  eventType: 'pos.sale.completed.v1',
  eventVersion: 'v1',
  occurredAt: '2026-10-08T10:00:00.000Z',
  tenantId,
  branchId,
  principalId: 'cashier-001',
  correlationId: 'sale-reorder-correlation',
  causationId: 'sale-reorder-command',
  source: 'SaleTransactionService',
  payload: {
    saleId: 'sale-reorder-001',
    items: [{ inventoryRecordId, quantity: 2 }],
    totalAmountKes: 500,
  },
  metadata: {},
} as any;

describe('ReorderEngine', () => {
  beforeEach(async () => {
    await firestoreClient.clearAllForTesting();
  });

  it('creates a durable reorder decision and procurement intent at/below threshold', async () => {
    await firestoreClient.set(
      `/tenants/${tenantId}/entities/stock_control/records/${inventoryRecordId}`,
      {
        id: inventoryRecordId,
        entityType: 'stock_control',
        primaryIdentifier: inventoryRecordId,
        secondaryIdentifier: 'Canonical Test Item',
        status: 'ACTIVE',
        branchId,
        attributes: {
          skuCode: 'CANONICAL-001',
          itemName: 'Canonical Test Item',
          quantityOnHand: 3,
          reorderLevel: 3,
          targetStockLevel: 8,
          unitPrice: 250,
        },
        createdAt: saleEvent.occurredAt,
        updatedAt: saleEvent.occurredAt,
      },
    );

    const first = await reorderEngine.evaluateSaleEvent(saleEvent);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      status: 'CREATED',
      currentQuantity: 3,
      reorderLevel: 3,
      reorderQuantity: 5,
      procurementStatus: 'SUPPLIER_SELECTION_REQUIRED',
      idempotent: false,
    });

    const decision = await firestoreClient.get<any>(
      `/tenants/${tenantId}/entities/reorder_decisions/records/${first[0].decisionId}`,
    );
    const intent = await firestoreClient.get<any>(
      `/tenants/${tenantId}/entities/procurement_intents/records/${first[0].procurementIntentId}`,
    );
    const outbox = await outboxRepository.getOutbox(
      tenantId,
      `reorder-${first[0].decisionId}`,
    );

    expect(decision?.attributes?.status).toBe('CREATED');
    expect(intent?.attributes?.status).toBe('SUPPLIER_SELECTION_REQUIRED');
    expect(intent?.attributes?.quantity).toBe(5);
    expect(outbox?.status).toBe('PENDING');
    expect(outbox?.eventType).toBe('inventory.reorder.triggered.v1');

    const second = await reorderEngine.evaluateSaleEvent(saleEvent);
    expect(second[0]?.idempotent).toBe(true);

    const intents = await firestoreClient.listCollection<any>(
      `/tenants/${tenantId}/entities/procurement_intents`,
    );
    expect(intents).toHaveLength(1);
  });

  it('does not create procurement when stock remains above the reorder level', async () => {
    await firestoreClient.set(
      `/tenants/${tenantId}/entities/stock_control/records/${inventoryRecordId}`,
      {
        id: inventoryRecordId,
        entityType: 'stock_control',
        primaryIdentifier: inventoryRecordId,
        status: 'ACTIVE',
        branchId,
        attributes: {
          skuCode: 'CANONICAL-002',
          quantityOnHand: 10,
          reorderLevel: 3,
        },
        createdAt: saleEvent.occurredAt,
        updatedAt: saleEvent.occurredAt,
      },
    );

    const result = await reorderEngine.evaluateSaleEvent(saleEvent);
    expect(result[0]?.status).toBe('NO_REORDER_REQUIRED');
    expect(await firestoreClient.listCollection<any>(`/tenants/${tenantId}/entities/procurement_intents`)).toHaveLength(0);
  });
});
