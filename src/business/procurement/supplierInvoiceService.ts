import type { SecurityContext } from '../../kernel/types';
import type { ExperienceEntityRecord } from '../../experience/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';

export type SupplierInvoiceStatus = 'SUBMITTED' | 'MATCHED' | 'APPROVED' | 'PARTIALLY_PAID' | 'PAID' | 'DISPUTED';

export interface SupplierInvoiceLineInput {
  description: string;
  quantity: number;
  unitCostKes: number;
  skuCode?: string;
  inventoryRecordId?: string;
}
export interface SupplierInvoiceInput {
  invoiceId: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  lines: SupplierInvoiceLineInput[];
  taxAmountKes?: number;
  notes?: string;
}
export interface SupplierInvoiceResult {
  invoiceId: string;
  supplierInvoiceNumber: string;
  totalAmountKes: number;
  status: SupplierInvoiceStatus;
  matched: boolean;
  idempotent: boolean;
  eventId: string;
}

const CAPABILITY = 'supplier_invoices';
const PO_ENTITY = 'purchase_orders';
const GRN_ENTITY = 'goods_receipts';

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
function numberField(value: unknown, field: string, requestId: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(`Invalid numeric field: ${field}.`, requestId);
  return value;
}

export function validateSupplierInvoiceInput(input: SupplierInvoiceInput, requestId: string): void {
  if (!input?.invoiceId || !/^[A-Za-z0-9_-]{3,120}$/.test(input.invoiceId)) fail('invoiceId must be 3-120 characters using letters, numbers, "_" or "-".', requestId);
  if (!input.supplierId) fail('supplierId is required.', requestId);
  if (!input.supplierInvoiceNumber?.trim()) fail('supplierInvoiceNumber is required.', requestId);
  if (!input.invoiceDate || Number.isNaN(Date.parse(input.invoiceDate))) fail('invoiceDate must be a valid date.', requestId);
  if (input.dueDate && Number.isNaN(Date.parse(input.dueDate))) fail('dueDate must be a valid date.', requestId);
  if (!Array.isArray(input.lines) || input.lines.length === 0) fail('A supplier invoice must contain at least one line.', requestId);
  for (const line of input.lines) {
    if (!line?.description?.trim()) fail('Each invoice line requires a description.', requestId);
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) fail('Each invoice line quantity must be a positive integer.', requestId);
    numberField(line.unitCostKes, 'unitCostKes', requestId);
  }
  if (input.taxAmountKes !== undefined) numberField(input.taxAmountKes, 'taxAmountKes', requestId);
}

export class SupplierInvoiceService {
  async submitInvoice(context: SecurityContext, dbkId: string, input: SupplierInvoiceInput): Promise<SupplierInvoiceResult> {
    const tenantId = context.tenantContext?.tenantId ?? dbkId;
    const branchId = context.branchContext?.branchId;
    if (!branchId) fail('An active branch is required to submit a supplier invoice.', context.requestId);
    if (tenantId !== dbkId) fail('Supplier invoice tenant does not match the target business.', context.requestId);

    const authorization = await rbacEngine.authorizeAsync(context.principal, 'execute', 'purchasing:supplier_invoice', {
      tenantId, branchId, requiredPermission: 'manage:purchasing', requestId: context.requestId,
    });
    if (!authorization.allowed) throw new KernelError('AUTHORIZATION_ERROR', authorization.reason, 403, context.requestId);

    await dbkCapabilityManager.assertCapabilityOperational(context, dbkId, CAPABILITY, 'SUBMIT_SUPPLIER_INVOICE');
    validateSupplierInvoiceInput(input, context.requestId);

    const eventId = `supplier-invoice-${input.invoiceId}`;
    const invoicePath = entityPath(tenantId, CAPABILITY, input.invoiceId);

    return firestoreClient.runTransaction(async (transaction) => {
      const existing = await transaction.get(invoicePath);
      if (existing) {
        const record = asRecord(existing);
        const attrs = record.attributes ?? {};
        return {
          invoiceId: input.invoiceId,
          supplierInvoiceNumber: String(attrs.supplierInvoiceNumber ?? input.supplierInvoiceNumber),
          totalAmountKes: Number(attrs.totalAmountKes ?? 0),
          status: (record.status as SupplierInvoiceStatus) || 'SUBMITTED',
          matched: Boolean(attrs.matched),
          idempotent: true,
          eventId,
        };
      }

      let subtotalKes = 0;
      const lines = input.lines.map((line) => {
        const lineTotalKes = line.quantity * line.unitCostKes;
        subtotalKes += lineTotalKes;
        return { ...line, lineTotalKes };
      });
      const taxAmountKes = input.taxAmountKes ?? 0;
      const totalAmountKes = subtotalKes + taxAmountKes;
      const now = new Date().toISOString();
      let matched = true;

      if (input.purchaseOrderId) {
        const po = await transaction.get(entityPath(tenantId, PO_ENTITY, input.purchaseOrderId));
        if (!po) fail(`Purchase order '${input.purchaseOrderId}' was not found.`, context.requestId);
        const poRecord = asRecord(po);
        const poTotal = Number(poRecord.attributes?.totalAmountKes ?? poRecord.attributes?.total ?? NaN);
        if (Number.isFinite(poTotal) && Math.abs(poTotal - totalAmountKes) > 0.01) matched = false;
      }
      if (input.goodsReceiptId) {
        const grn = await transaction.get(entityPath(tenantId, GRN_ENTITY, input.goodsReceiptId));
        if (!grn) fail(`Goods receipt '${input.goodsReceiptId}' was not found.`, context.requestId);
      }

      const status: SupplierInvoiceStatus = matched ? 'MATCHED' : 'DISPUTED';
      const invoiceRecord: ExperienceEntityRecord = {
        id: input.invoiceId, entityType: CAPABILITY, primaryIdentifier: input.supplierInvoiceNumber,
        secondaryIdentifier: input.supplierId, status, branchId,
        attributes: {
          supplierId: input.supplierId, supplierInvoiceNumber: input.supplierInvoiceNumber,
          invoiceDate: input.invoiceDate, dueDate: input.dueDate ?? null,
          purchaseOrderId: input.purchaseOrderId ?? null, goodsReceiptId: input.goodsReceiptId ?? null,
          lines, subtotalKes, taxAmountKes, totalAmountKes, currency: 'KES', matched,
          accountsPayableStatus: matched ? 'OPEN' : 'DISPUTED', notes: input.notes ?? null, submittedAt: now,
        },
        createdAt: now, updatedAt: now,
      };
      await transaction.set(invoicePath, invoiceRecord);
      await outboxEngine.enqueueEvent(tenantId, {
        eventId,
        eventType: matched ? 'procurement.supplier_invoice.matched' : 'procurement.supplier_invoice.disputed',
        eventVersion: 'v1', occurredAt: now, tenantId, branchId, principalId: context.principal.id,
        correlationId: context.correlationId, causationId: context.requestId, source: 'SupplierInvoiceService',
        payload: {
          invoiceId: input.invoiceId, supplierId: input.supplierId,
          supplierInvoiceNumber: input.supplierInvoiceNumber, totalAmountKes, taxAmountKes,
          currency: 'KES', status, matched, purchaseOrderId: input.purchaseOrderId ?? null,
          goodsReceiptId: input.goodsReceiptId ?? null,
        },
        metadata: { requestId: context.requestId, command: 'SUBMIT_SUPPLIER_INVOICE' },
      }, transaction, context.principal.id);

      return { invoiceId: input.invoiceId, supplierInvoiceNumber: input.supplierInvoiceNumber, totalAmountKes, status, matched, idempotent: false, eventId };
    });
  }
  async approveInvoice(context: SecurityContext, dbkId: string, invoiceId: string): Promise<SupplierInvoiceResult> {
    const tenantId = context.tenantContext?.tenantId ?? dbkId;
    const branchId = context.branchContext?.branchId;
    if (!branchId) fail('An active branch is required to approve a supplier invoice.', context.requestId);
    if (tenantId !== dbkId) fail('Supplier invoice tenant does not match the target business.', context.requestId);
    const authorization = await rbacEngine.authorizeAsync(context.principal, 'approve', 'purchasing:supplier_invoice', { tenantId, branchId, requiredPermission: 'approve:purchasing', requestId: context.requestId });
    if (!authorization.allowed) throw new KernelError('AUTHORIZATION_ERROR', authorization.reason, 403, context.requestId);
    await dbkCapabilityManager.assertCapabilityOperational(context, dbkId, CAPABILITY, 'APPROVE_SUPPLIER_INVOICE');
    const eventId = `supplier-invoice-approved-${invoiceId}`;
    const invoicePath = entityPath(tenantId, CAPABILITY, invoiceId);
    return firestoreClient.runTransaction(async (transaction) => {
      const existing = await transaction.get(invoicePath);
      if (!existing) throw new KernelError('NOT_FOUND', `Supplier invoice '${invoiceId}' was not found.`, 404, context.requestId);
      const record = asRecord(existing); const attrs = record.attributes ?? {};
      if (record.status === 'APPROVED' || record.status === 'PARTIALLY_PAID' || record.status === 'PAID') return { invoiceId, supplierInvoiceNumber: String(attrs.supplierInvoiceNumber ?? ''), totalAmountKes: Number(attrs.totalAmountKes ?? 0), status: record.status as SupplierInvoiceStatus, matched: Boolean(attrs.matched), idempotent: true, eventId };
      if (record.status !== 'MATCHED') throw new KernelError('CONFLICT', `Supplier invoice '${invoiceId}' cannot be approved from status '${record.status}'.`, 409, context.requestId);
      const now = new Date().toISOString();
      await transaction.update(invoicePath, { status: 'APPROVED', updatedAt: now, attributes: { ...attrs, accountsPayableStatus: 'OPEN', approvedAt: now, approvedBy: context.principal.id } });
      await outboxEngine.enqueueEvent(tenantId, { eventId, eventType: 'procurement.supplier_invoice.approved', eventVersion: 'v1', occurredAt: now, tenantId, branchId, principalId: context.principal.id, correlationId: context.correlationId, causationId: context.requestId, source: 'SupplierInvoiceService', payload: { invoiceId, supplierId: attrs.supplierId, supplierInvoiceNumber: attrs.supplierInvoiceNumber, totalAmountKes: attrs.totalAmountKes, currency: 'KES', status: 'APPROVED' }, metadata: { requestId: context.requestId, command: 'APPROVE_SUPPLIER_INVOICE' } }, transaction, context.principal.id);
      return { invoiceId, supplierInvoiceNumber: String(attrs.supplierInvoiceNumber ?? ''), totalAmountKes: Number(attrs.totalAmountKes ?? 0), status: 'APPROVED', matched: true, idempotent: false, eventId };
    });
  }

}
export const supplierInvoiceService = new SupplierInvoiceService();
