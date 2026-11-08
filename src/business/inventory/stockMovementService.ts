import type { SecurityContext } from '../../kernel/types';
import type { ExperienceEntityRecord } from '../../experience/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';

export type StockMovementType = 'RECEIVE' | 'ISSUE' | 'ADJUST' | 'TRANSFER';
export type StockAdjustmentDirection = 'INCREASE' | 'DECREASE';

export interface RecordStockMovementInput {
  movementId: string;
  movementType: StockMovementType;
  inventoryRecordId: string;
  quantity: number;
  reason: string;
  reference?: string;
  adjustmentDirection?: StockAdjustmentDirection;
  destinationBranchId?: string;
  destinationInventoryRecordId?: string;
}

export interface StockMovementResult {
  movementId: string;
  movementType: StockMovementType;
  quantity: number;
  sourceBalance: number;
  destinationBalance?: number;
  status: 'POSTED';
  idempotent: boolean;
  eventId: string;
}

const CAPABILITY = 'stock_control';
const MOVEMENT_ENTITY = 'stock_movements';

function entityPath(tenantId: string, entityType: string, recordId: string): string {
  return `/tenants/${tenantId}/entities/${entityType}/records/${recordId}`;
}

function fail(message: string, requestId: string): never {
  throw new KernelError('VALIDATION_ERROR', message, 400, requestId);
}

function asRecord(value: unknown): ExperienceEntityRecord {
  if (!value || typeof value !== 'object') throw new Error('Expected an ExperienceEntityRecord');
  return value as ExperienceEntityRecord;
}

function readQuantity(record: ExperienceEntityRecord, requestId: string): number {
  const value = record.attributes?.quantityOnHand;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(`Inventory item '${record.id}' has an invalid quantityOnHand.`, requestId);
  }
  return value;
}

export function validateStockMovementInput(input: RecordStockMovementInput, requestId: string): void {
  if (!input?.movementId || !/^[A-Za-z0-9_-]{3,120}$/.test(input.movementId)) {
    fail('movementId must be 3-120 characters using letters, numbers, "_" or "-".', requestId);
  }
  if (!['RECEIVE', 'ISSUE', 'ADJUST', 'TRANSFER'].includes(input.movementType)) {
    fail('Unsupported stock movement type.', requestId);
  }
  if (typeof input.inventoryRecordId !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(input.inventoryRecordId)) {
    fail('inventoryRecordId is required and must be a valid record identifier.', requestId);
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    fail('quantity must be a positive safe integer.', requestId);
  }
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) {
    fail('A reason of 1-500 characters is required for every stock movement.', requestId);
  }
  if (input.reference && input.reference.length > 120) fail('reference must not exceed 120 characters.', requestId);
  if (input.movementType === 'ADJUST' && !['INCREASE', 'DECREASE'].includes(String(input.adjustmentDirection))) {
    fail('ADJUST movements require adjustmentDirection INCREASE or DECREASE.', requestId);
  }
  if (input.movementType === 'TRANSFER') {
    if (typeof input.destinationBranchId !== 'string' || !input.destinationBranchId.trim() || typeof input.destinationInventoryRecordId !== 'string' || !input.destinationInventoryRecordId.trim()) {
      fail('TRANSFER requires destinationBranchId and destinationInventoryRecordId.', requestId);
    }
    if (input.destinationInventoryRecordId === input.inventoryRecordId) {
      fail('A transfer must use distinct source and destination inventory records.', requestId);
    }
  }
}

function requestFingerprint(input: RecordStockMovementInput): string {
  return JSON.stringify({
    movementType: input.movementType,
    inventoryRecordId: input.inventoryRecordId,
    quantity: input.quantity,
    reason: input.reason.trim(),
    reference: input.reference ?? null,
    adjustmentDirection: input.adjustmentDirection ?? null,
    destinationBranchId: input.destinationBranchId ?? null,
    destinationInventoryRecordId: input.destinationInventoryRecordId ?? null,
  });
}

export class StockMovementService {
  async recordMovement(
    context: SecurityContext,
    dbkId: string,
    input: RecordStockMovementInput,
  ): Promise<StockMovementResult> {
    const tenantId = context.tenantContext?.tenantId ?? dbkId;
    const branchId = context.branchContext?.branchId;
    if (!branchId) fail('An active source branch is required to record stock movement.', context.requestId);
    if (tenantId !== dbkId || context.principal.tenantId !== tenantId) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'Stock movement tenant does not match the authenticated business.', 403, context.requestId);
    }
    validateStockMovementInput(input, context.requestId);

    const authorization = await rbacEngine.authorizeAsync(
      context.principal,
      'manage',
      'inventory:movement',
      { tenantId, branchId, requiredPermission: 'manage:inventory', requestId: context.requestId },
    );
    if (!authorization.allowed) {
      throw new KernelError('AUTHORIZATION_ERROR', authorization.reason, 403, context.requestId);
    }
    await dbkCapabilityManager.assertCapabilityOperational(context, dbkId, CAPABILITY, 'RECORD_STOCK_MOVEMENT');

    if (input.movementType === 'TRANSFER' && input.destinationBranchId === branchId) {
      fail('A stock transfer must target a different branch.', context.requestId);
    }
    if (input.movementType === 'TRANSFER') {
      const destinationAuthorization = await rbacEngine.authorizeAsync(
        context.principal,
        'manage',
        'inventory:movement',
        { tenantId, branchId: input.destinationBranchId!, requiredPermission: 'manage:inventory', requestId: context.requestId },
      );
      if (!destinationAuthorization.allowed) {
        throw new KernelError('AUTHORIZATION_ERROR', 'The principal is not authorized to receive stock in the destination branch.', 403, context.requestId);
      }
    }

    const eventId = `stock-movement-${input.movementId}`;
    const movementPath = entityPath(tenantId, MOVEMENT_ENTITY, input.movementId);
    const sourcePath = entityPath(tenantId, CAPABILITY, input.inventoryRecordId);
    const fingerprint = requestFingerprint(input);

    return firestoreClient.runTransaction(async (transaction) => {
      const existing = await transaction.get(movementPath);
      if (existing) {
        const record = asRecord(existing);
        if (record.attributes?.requestFingerprint !== fingerprint) {
          throw new KernelError('CONFLICT', 'movementId has already been used for a different stock movement.', 409, context.requestId);
        }
        return {
          movementId: input.movementId,
          movementType: input.movementType,
          quantity: input.quantity,
          sourceBalance: Number(record.attributes?.sourceBalanceAfter ?? 0),
          destinationBalance: typeof record.attributes?.destinationBalanceAfter === 'number'
            ? Number(record.attributes.destinationBalanceAfter)
            : undefined,
          status: 'POSTED',
          idempotent: true,
          eventId,
        };
      }

      const sourceRaw = await transaction.get(sourcePath);
      if (!sourceRaw) throw new KernelError('NOT_FOUND', `Inventory item '${input.inventoryRecordId}' was not found.`, 404, context.requestId);
      const source = asRecord(sourceRaw);
      if (source.branchId !== branchId) {
        throw new KernelError('AUTHORIZATION_ERROR', 'Source inventory item does not belong to the active branch.', 403, context.requestId);
      }
      const sourceBefore = readQuantity(source, context.requestId);
      let sourceAfter = sourceBefore;
      let destinationAfter: number | undefined;
      let destinationPath: string | undefined;
      let destination: ExperienceEntityRecord | undefined;

      if (input.movementType === 'RECEIVE' || (input.movementType === 'ADJUST' && input.adjustmentDirection === 'INCREASE')) {
        sourceAfter += input.quantity;
      } else if (input.movementType === 'ISSUE' || (input.movementType === 'ADJUST' && input.adjustmentDirection === 'DECREASE')) {
        sourceAfter -= input.quantity;
      } else if (input.movementType === 'TRANSFER') {
        sourceAfter -= input.quantity;
        destinationPath = entityPath(tenantId, CAPABILITY, input.destinationInventoryRecordId!);
        const destinationRaw = await transaction.get(destinationPath);
        if (!destinationRaw) throw new KernelError('NOT_FOUND', `Destination inventory item '${input.destinationInventoryRecordId}' was not found.`, 404, context.requestId);
        destination = asRecord(destinationRaw);
        if (destination.branchId !== input.destinationBranchId) {
          throw new KernelError('CONFLICT', 'Destination inventory item does not belong to the requested destination branch.', 409, context.requestId);
        }
        const sourceSku = source.attributes?.skuCode ?? source.primaryIdentifier;
        const destinationSku = destination.attributes?.skuCode ?? destination.primaryIdentifier;
        if (sourceSku !== destinationSku) fail('Source and destination inventory records must represent the same SKU.', context.requestId);
        destinationAfter = readQuantity(destination, context.requestId) + input.quantity;
      }

      if (sourceAfter < 0) {
        throw new KernelError('CONFLICT', `Insufficient stock: requested ${input.quantity}, available ${sourceBefore}.`, 409, context.requestId);
      }
      if (!Number.isSafeInteger(sourceAfter) || (destinationAfter !== undefined && !Number.isSafeInteger(destinationAfter))) {
        fail('Stock movement would exceed the supported integer quantity range.', context.requestId);
      }

      const now = new Date().toISOString();
      await transaction.set(sourcePath, {
        ...source,
        updatedAt: now,
        attributes: { ...source.attributes, quantityOnHand: sourceAfter },
      });
      if (destination && destinationPath && destinationAfter !== undefined) {
        await transaction.set(destinationPath, {
          ...destination,
          updatedAt: now,
          attributes: { ...destination.attributes, quantityOnHand: destinationAfter },
        });
      }

      const movement: ExperienceEntityRecord = {
        id: input.movementId,
        entityType: MOVEMENT_ENTITY,
        primaryIdentifier: input.movementId,
        secondaryIdentifier: input.reference ?? input.inventoryRecordId,
        status: 'POSTED',
        branchId,
        attributes: {
          movementType: input.movementType,
          inventoryRecordId: input.inventoryRecordId,
          sourceBranchId: branchId,
          destinationBranchId: input.destinationBranchId ?? null,
          destinationInventoryRecordId: input.destinationInventoryRecordId ?? null,
          quantity: input.quantity,
          sourceBalanceBefore: sourceBefore,
          sourceBalanceAfter: sourceAfter,
          destinationBalanceAfter: destinationAfter ?? null,
          reason: input.reason.trim(),
          reference: input.reference ?? null,
          adjustmentDirection: input.adjustmentDirection ?? null,
          requestFingerprint: fingerprint,
          postedBy: context.principal.id,
          postedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };
      await transaction.set(movementPath, movement);

      await outboxEngine.enqueueEvent(tenantId, {
        eventId,
        eventType: 'inventory.stock.movement_posted',
        eventVersion: 'v1',
        occurredAt: now,
        tenantId,
        branchId,
        principalId: context.principal.id,
        correlationId: context.correlationId,
        causationId: context.requestId,
        source: 'StockMovementService',
        payload: {
          movementId: input.movementId,
          movementType: input.movementType,
          inventoryRecordId: input.inventoryRecordId,
          sourceBranchId: branchId,
          destinationBranchId: input.destinationBranchId ?? null,
          quantity: input.quantity,
          sourceBalanceAfter: sourceAfter,
          destinationBalanceAfter: destinationAfter ?? null,
          reference: input.reference ?? null,
        },
        metadata: { requestId: context.requestId, command: 'RECORD_STOCK_MOVEMENT' },
      }, transaction, context.principal.id);

      return {
        movementId: input.movementId,
        movementType: input.movementType,
        quantity: input.quantity,
        sourceBalance: sourceAfter,
        destinationBalance: destinationAfter,
        status: 'POSTED',
        idempotent: false,
        eventId,
      };
    });
  }
}

export const stockMovementService = new StockMovementService();
