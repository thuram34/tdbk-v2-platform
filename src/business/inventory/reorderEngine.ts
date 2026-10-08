import type { EventEnvelope } from '../../orchestration/events/types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import type { ExperienceEntityRecord } from '../../experience/types';

const INVENTORY_ENTITY = 'stock_control';
const DECISION_ENTITY = 'reorder_decisions';
const PROCUREMENT_ENTITY = 'procurement_intents';

function inventoryPath(tenantId: string, recordId: string): string {
  return `/tenants/${tenantId}/entities/${INVENTORY_ENTITY}/records/${recordId}`;
}

function decisionPath(tenantId: string, decisionId: string): string {
  return `/tenants/${tenantId}/entities/${DECISION_ENTITY}/records/${decisionId}`;
}

function procurementPath(tenantId: string, intentId: string): string {
  return `/tenants/${tenantId}/entities/${PROCUREMENT_ENTITY}/records/${intentId}`;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export interface ReorderDecisionResult {
  decisionId: string;
  procurementIntentId: string;
  inventoryRecordId: string;
  status: 'CREATED' | 'NO_REORDER_REQUIRED';
  currentQuantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  procurementStatus?: 'READY_FOR_PURCHASE_ORDER' | 'SUPPLIER_SELECTION_REQUIRED';
  idempotent: boolean;
}

export class ReorderEngine {
  /**
   * Evaluates authoritative post-sale stock and creates a durable
   * replenishment intent when stock is at/below the configured reorder level.
   *
   * Policy:
   * - reorderLevel is the minimum trigger threshold.
   * - targetStockLevel is optional; when absent, target = reorderLevel * 2.
   * - reorderQuantity is optional; when present it is respected.
   * - supplierId is optional; without it the intent remains
   *   SUPPLIER_SELECTION_REQUIRED rather than inventing a supplier.
   */
  async evaluateSaleEvent(event: EventEnvelope): Promise<ReorderDecisionResult[]> {
    const tenantId = event.tenantId;
    if (!tenantId) {
      throw new Error('Cannot evaluate reorder without an authoritative tenantId.');
    }

    const items = Array.isArray((event.payload as any)?.items)
      ? (event.payload as any).items
      : [];

    const results: ReorderDecisionResult[] = [];

    for (const item of items) {
      const inventoryRecordId = String(item?.inventoryRecordId || '');
      const soldQuantity = finiteNumber(item?.quantity);
      if (!inventoryRecordId || soldQuantity <= 0) continue;

      const decisionId = `reorder_${inventoryRecordId}_${event.eventId}`;
      const procurementIntentId = `procure_${inventoryRecordId}_${event.eventId}`;

      const result = await firestoreClient.runTransaction(async (transaction) => {
        const existingDecision = await transaction.get(decisionPath(tenantId, decisionId));
        if (existingDecision) {
          const existing = existingDecision as any;
          return {
            decisionId,
            procurementIntentId: String(existing.attributes?.procurementIntentId || procurementIntentId),
            inventoryRecordId,
            status: existing.attributes?.status || 'CREATED',
            currentQuantity: finiteNumber(existing.attributes?.currentQuantity),
            reorderLevel: finiteNumber(existing.attributes?.reorderLevel),
            reorderQuantity: finiteNumber(existing.attributes?.reorderQuantity),
            procurementStatus: existing.attributes?.procurementStatus,
            idempotent: true,
          } as ReorderDecisionResult;
        }

        const rawInventory = await transaction.get(inventoryPath(tenantId, inventoryRecordId));
        if (!rawInventory) {
          return {
            decisionId,
            procurementIntentId,
            inventoryRecordId,
            status: 'NO_REORDER_REQUIRED',
            currentQuantity: 0,
            reorderLevel: 0,
            reorderQuantity: 0,
            idempotent: false,
          } as ReorderDecisionResult;
        }

        const inventory = rawInventory as ExperienceEntityRecord;
        const attributes = inventory.attributes ?? {};
        const currentQuantity = finiteNumber(attributes.quantityOnHand);
        const reorderLevel = finiteNumber(attributes.reorderLevel, -1);

        if (reorderLevel < 0 || currentQuantity > reorderLevel) {
          return {
            decisionId,
            procurementIntentId,
            inventoryRecordId,
            status: 'NO_REORDER_REQUIRED',
            currentQuantity,
            reorderLevel: Math.max(reorderLevel, 0),
            reorderQuantity: 0,
            idempotent: false,
          } as ReorderDecisionResult;
        }

        const explicitReorderQuantity = finiteNumber(attributes.reorderQuantity);
        const targetStockLevel = finiteNumber(
          attributes.targetStockLevel,
          reorderLevel * 2,
        );
        const reorderQuantity = explicitReorderQuantity > 0
          ? Math.ceil(explicitReorderQuantity)
          : Math.max(1, Math.ceil(targetStockLevel - currentQuantity));

        const supplierId = typeof attributes.supplierId === 'string' && attributes.supplierId.trim()
          ? attributes.supplierId.trim()
          : null;
        const supplierName = typeof attributes.supplierName === 'string' && attributes.supplierName.trim()
          ? attributes.supplierName.trim()
          : null;
        const procurementStatus = supplierId
          ? 'READY_FOR_PURCHASE_ORDER'
          : 'SUPPLIER_SELECTION_REQUIRED';
        const now = new Date().toISOString();

        const decision: ExperienceEntityRecord = {
          id: decisionId,
          entityType: DECISION_ENTITY,
          primaryIdentifier: decisionId,
          secondaryIdentifier: String(attributes.skuCode || inventory.primaryIdentifier || inventoryRecordId),
          status: 'ACTIVE',
          branchId: inventory.branchId || event.branchId || null,
          attributes: {
            inventoryRecordId,
            skuCode: attributes.skuCode ?? inventory.primaryIdentifier,
            itemName: attributes.itemName ?? inventory.secondaryIdentifier ?? inventoryRecordId,
            currentQuantity,
            soldQuantity,
            reorderLevel,
            targetStockLevel,
            reorderQuantity,
            supplierId,
            supplierName,
            procurementIntentId,
            status: 'CREATED',
            procurementStatus,
            triggerEventId: event.eventId,
            triggerEventType: event.eventType,
          },
          createdAt: now,
          updatedAt: now,
        };

        const procurementIntent: ExperienceEntityRecord = {
          id: procurementIntentId,
          entityType: PROCUREMENT_ENTITY,
          primaryIdentifier: procurementIntentId,
          secondaryIdentifier: String(attributes.skuCode || inventory.primaryIdentifier || inventoryRecordId),
          status: 'PENDING',
          branchId: inventory.branchId || event.branchId || null,
          attributes: {
            inventoryRecordId,
            skuCode: attributes.skuCode ?? inventory.primaryIdentifier,
            itemName: attributes.itemName ?? inventory.secondaryIdentifier ?? inventoryRecordId,
            quantity: reorderQuantity,
            currentQuantity,
            reorderLevel,
            supplierId,
            supplierName,
            status: procurementStatus,
            source: 'REORDER_ENGINE',
            triggerEventId: event.eventId,
            triggerEventType: event.eventType,
          },
          createdAt: now,
          updatedAt: now,
        };

        await transaction.set(decisionPath(tenantId, decisionId), decision);
        await transaction.set(procurementPath(tenantId, procurementIntentId), procurementIntent);

        await outboxEngine.enqueueEvent(
          tenantId,
          {
            eventId: `reorder-${decisionId}`,
            eventType: 'inventory.reorder.triggered.v1',
            eventVersion: 'v1',
            occurredAt: now,
            tenantId,
            branchId: inventory.branchId || event.branchId || null,
            principalId: event.principalId || 'SYSTEM_REORDER_ENGINE',
            correlationId: event.correlationId,
            causationId: event.eventId,
            source: 'ReorderEngine',
            payload: {
              decisionId,
              procurementIntentId,
              inventoryRecordId,
              skuCode: attributes.skuCode ?? inventory.primaryIdentifier,
              currentQuantity,
              reorderLevel,
              reorderQuantity,
              procurementStatus,
            },
            metadata: { sourceEventId: event.eventId },
          },
          transaction,
          event.principalId || 'SYSTEM_REORDER_ENGINE',
        );

        return {
          decisionId,
          procurementIntentId,
          inventoryRecordId,
          status: 'CREATED',
          currentQuantity,
          reorderLevel,
          reorderQuantity,
          procurementStatus,
          idempotent: false,
        } as ReorderDecisionResult;
      });

      results.push(result);
    }

    return results;
  }
}

export const reorderEngine = new ReorderEngine();

export async function handlePosSaleCompletedForReorder(event: EventEnvelope): Promise<void> {
  await reorderEngine.evaluateSaleEvent(event);
}
