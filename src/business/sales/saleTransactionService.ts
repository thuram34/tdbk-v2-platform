import type { SecurityContext } from '../../kernel/types';
import type { ExperienceEntityRecord } from '../../experience/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';

export interface SaleItemInput {
  inventoryRecordId: string;
  quantity: number;
}

export interface ExecuteSaleInput {
  saleId: string;
  items: SaleItemInput[];
  paymentStatus?: 'PAID' | 'PENDING' | 'CREDIT';
  customerName?: string;
  notes?: string;
}

export interface ExecuteSaleResult {
  saleId: string;
  totalAmountKes: number;
  currency: 'KES';
  status: 'COMPLETED';
  idempotent: boolean;
  eventId: string;
}

const INVENTORY_CAPABILITY = 'stock_control';
const SALE_CAPABILITY = 'sales_counter';

function entityPath(
  tenantId: string,
  capabilityId: string,
  recordId: string,
): string {
  return `/tenants/${tenantId}/entities/${capabilityId}/records/${recordId}`;
}

function fail(message: string, requestId: string): never {
  throw new KernelError('VALIDATION_ERROR', message, 400, requestId);
}

function asRecord(value: unknown): ExperienceEntityRecord {
  if (!value || typeof value !== 'object') {
    throw new Error('Expected an ExperienceEntityRecord');
  }

  return value as ExperienceEntityRecord;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric field: ${field}`);
  }

  return value;
}

export class SaleTransactionService {
  async executeSale(
    context: SecurityContext,
    dbkId: string,
    input: ExecuteSaleInput,
  ): Promise<ExecuteSaleResult> {
    const tenantId = context.tenantContext?.tenantId ?? dbkId;
    const branchId = context.branchContext?.branchId;

    if (!branchId) {
      fail(
        'An active branch is required to execute a sale.',
        context.requestId,
      );
    }

    if (tenantId !== dbkId) {
      fail(
        'Sale tenant does not match the target business.',
        context.requestId,
      );
    }

    rbacEngine.assertAuthorization(
      context.principal,
      'execute',
      'sales:transaction',
      {
        tenantId,
        branchId,
        requiredPermission: 'execute:sales',
        requestId: context.requestId,
      },
    );

    if (
      !input?.saleId ||
      !/^[A-Za-z0-9_-]{3,120}$/.test(input.saleId)
    ) {
      fail(
        'saleId must be 3-120 characters using letters, numbers, "_" or "-".',
        context.requestId,
      );
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      fail(
        'A sale must contain at least one item.',
        context.requestId,
      );
    }

    const uniqueItems = new Map<string, number>();

    for (const item of input.items) {
      if (!item?.inventoryRecordId) {
        fail(
          'Each sale item requires inventoryRecordId.',
          context.requestId,
        );
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        fail(
          'Each sale item quantity must be a positive integer.',
          context.requestId,
        );
      }

      uniqueItems.set(
        item.inventoryRecordId,
        (uniqueItems.get(item.inventoryRecordId) ?? 0) +
          item.quantity,
      );
    }

    const paymentStatus = input.paymentStatus ?? 'PENDING';
    const salePath = entityPath(
      tenantId,
      SALE_CAPABILITY,
      input.saleId,
    );
    const eventId = `sale-${input.saleId}`;

    return firestoreClient.runTransaction(async (transaction) => {
      /*
       * The sale ID is the idempotency key.
       *
       * If the same command is retried after a successful transaction,
       * the existing sale is returned and stock is NOT deducted again.
       */
      const existing = await transaction.get(salePath);

      if (existing) {
        const existingRecord = asRecord(existing);
        const existingTotal = Number(
          existingRecord.attributes?.totalAmountKes ?? 0,
        );

        return {
          saleId: input.saleId,
          totalAmountKes: existingTotal,
          currency: 'KES',
          status: 'COMPLETED',
          idempotent: true,
          eventId,
        };
      }

      const now = new Date().toISOString();
      const lines: Array<Record<string, unknown>> = [];
      let totalAmountKes = 0;

      /*
       * Every inventory read happens INSIDE the same Firestore
       * transaction that performs the stock decrement.
       *
       * This prevents two concurrent sales from both spending
       * the same stock balance.
       */
      for (const [inventoryRecordId, quantity] of uniqueItems) {
        const inventoryPath = entityPath(
          tenantId,
          INVENTORY_CAPABILITY,
          inventoryRecordId,
        );

        const rawInventory = await transaction.get(inventoryPath);

        if (!rawInventory) {
          fail(
            `Inventory item '${inventoryRecordId}' was not found.`,
            context.requestId,
          );
        }

        const inventory = asRecord(rawInventory);

        if (inventory.branchId !== branchId) {
          fail(
            `Inventory item '${inventoryRecordId}' belongs to another branch.`,
            context.requestId,
          );
        }

        const attributes = inventory.attributes ?? {};

        const quantityOnHand = asNumber(
          attributes.quantityOnHand,
          'quantityOnHand',
        );

        const unitPrice = asNumber(
          attributes.unitPrice,
          'unitPrice',
        );

        if (
          !Number.isInteger(quantityOnHand) ||
          quantityOnHand < 0
        ) {
          fail(
            `Inventory item '${inventoryRecordId}' has invalid quantityOnHand.`,
            context.requestId,
          );
        }

        if (unitPrice < 0) {
          fail(
            `Inventory item '${inventoryRecordId}' has invalid unitPrice.`,
            context.requestId,
          );
        }

        if (quantityOnHand < quantity) {
          fail(
            `Insufficient stock for '${inventoryRecordId}': requested ${quantity}, available ${quantityOnHand}.`,
            context.requestId,
          );
        }

        const lineTotal = quantity * unitPrice;
        totalAmountKes += lineTotal;

        lines.push({
          inventoryRecordId,
          skuCode:
            attributes.skuCode ??
            inventory.primaryIdentifier,
          itemName:
            attributes.itemName ??
            inventory.secondaryIdentifier ??
            inventory.primaryIdentifier,
          quantity,
          unitPriceKes: unitPrice,
          lineTotalKes: lineTotal,
        });

        const updatedInventory: ExperienceEntityRecord = {
          ...inventory,
          updatedAt: now,
          attributes: {
            ...attributes,
            quantityOnHand:
              quantityOnHand - quantity,
          },
        };

        await transaction.set(
          inventoryPath,
          updatedInventory,
        );
      }

      const saleRecord: ExperienceEntityRecord = {
        id: input.saleId,
        entityType: 'sale',
        primaryIdentifier: input.saleId,
        secondaryIdentifier: input.customerName,
        status: 'COMPLETED',
        branchId,
        attributes: {
          items: lines,
          totalAmountKes,
          currency: 'KES',
          paymentStatus,
          customerName: input.customerName ?? null,
          notes: input.notes ?? null,
          completedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };

      /*
       * Sale record + stock changes + outbox record are committed
       * as one Firestore transaction.
       */
      await transaction.set(
        salePath,
        saleRecord,
      );

      await outboxEngine.enqueueEvent(
        tenantId,
        {
          eventId,
          eventType: 'pos.sale.completed',
          eventVersion: 'v1',
          occurredAt: now,
          tenantId,
          branchId,
          principalId: context.principal.id,
          correlationId: context.correlationId,
          causationId: context.requestId,
          source: 'SaleTransactionService',
          payload: {
            saleId: input.saleId,
            branchId,
            items: lines,
            totalAmountKes,
            currency: 'KES',
            paymentStatus,
            completedAt: now,
          },
          metadata: {
            requestId: context.requestId,
            command: 'EXECUTE_SALE',
          },
        },
        transaction,
        context.principal.id,
      );

      return {
        saleId: input.saleId,
        totalAmountKes,
        currency: 'KES',
        status: 'COMPLETED',
        idempotent: false,
        eventId,
      };
    });
  }
}

export const saleTransactionService =
  new SaleTransactionService();
