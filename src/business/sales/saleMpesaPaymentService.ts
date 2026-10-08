import type { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { mpesaBridge } from '../../orchestration/bridge/adapters/mpesaBridge';

export interface InitiateSaleMpesaPaymentInput {
  saleId: string;
  phoneNumber: string;
}

export interface SaleMpesaPaymentResult {
  saleId: string;
  paymentIntentId: string;
  transactionId: string | null;
  providerReference: string | null;
  status: 'PENDING' | 'FAILED' | 'RECONCILIATION_REQUIRED';
  amountKes: number;
  currency: 'KES';
}

function intentPath(tenantId: string, saleId: string): string {
  return `/tenants/${tenantId}/entities/payment_intents/records/${saleId}`;
}

function salePath(tenantId: string, saleId: string): string {
  return `/tenants/${tenantId}/entities/sales_counter/records/${saleId}`;
}

export class SaleMpesaPaymentService {
  public async initiate(
    context: SecurityContext,
    dbkId: string,
    input: InitiateSaleMpesaPaymentInput,
  ): Promise<SaleMpesaPaymentResult> {
    const tenantId = context.tenantContext?.tenantId ?? dbkId;
    const branchId = context.branchContext?.branchId;
    if (tenantId !== dbkId) throw new KernelError('TENANT_ISOLATION_ERROR', 'Payment tenant does not match the target business.', 403, context.requestId);
    if (!branchId) throw new KernelError('VALIDATION_ERROR', 'An active branch is required to initiate a sale payment.', 400, context.requestId);

    const authorization = await rbacEngine.authorizeAsync(context.principal, 'execute', 'sales:payment', {
      tenantId, branchId, requiredPermission: 'execute:sales', requestId: context.requestId,
    });
    if (!authorization.allowed) throw new KernelError('AUTHORIZATION_ERROR', authorization.reason, 403, context.requestId);

    await dbkCapabilityManager.assertCapabilityOperational(context, dbkId, 'capability_payments', 'INITIATE_SALE_MPESA_PAYMENT');

    const sale = await firestoreClient.get<any>(salePath(tenantId, input.saleId));
    if (!sale) throw new KernelError('NOT_FOUND', `Sale '${input.saleId}' was not found.`, 404, context.requestId);
    if (sale.tenantId && sale.tenantId !== tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'Sale tenant does not match the target business.', 403, context.requestId);
    if (sale.branchId !== branchId) throw new KernelError('AUTHORIZATION_ERROR', 'Sale belongs to another branch.', 403, context.requestId);
    if (sale.status !== 'COMPLETED') throw new KernelError('VALIDATION_ERROR', 'Only a completed sale can receive a payment.', 400, context.requestId);
    if (sale.attributes?.paymentStatus === 'PAID') throw new KernelError('CONFLICT', 'Sale is already paid.', 409, context.requestId);

    const amountKes = Number(sale.attributes?.totalAmountKes);
    if (!Number.isFinite(amountKes) || amountKes <= 0) throw new KernelError('VALIDATION_ERROR', 'Sale has no valid payable amount.', 400, context.requestId);

    const path = intentPath(tenantId, input.saleId);
    const paymentIntentId = `sale_payment_${input.saleId}`;
    const existing = await firestoreClient.get<any>(path);
    if (existing) {
      if (existing.tenantId !== tenantId || existing.saleId !== input.saleId) throw new KernelError('TENANT_ISOLATION_ERROR', 'Payment intent identity conflict.', 403, context.requestId);
      if (existing.status === 'PENDING' || existing.status === 'RECONCILIATION_REQUIRED') {
        return { saleId: input.saleId, paymentIntentId: existing.paymentIntentId, transactionId: existing.transactionId ?? null, providerReference: existing.providerReference ?? null, status: existing.status, amountKes: Number(existing.amountKes), currency: 'KES' };
      }
      if (existing.status === 'INITIATING') throw new KernelError('CONFLICT', 'A sale payment initiation is already in progress.', 409, context.requestId);
    }

    const now = new Date().toISOString();
    await firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<any>(path);
      if (current && ['PENDING', 'RECONCILIATION_REQUIRED', 'INITIATING'].includes(current.status)) return;
      await tx.set(path, {
        id: input.saleId,
        entityType: 'payment_intent',
        primaryIdentifier: paymentIntentId,
        secondaryIdentifier: input.saleId,
        status: 'INITIATING',
        branchId,
        tenantId,
        saleId: input.saleId,
        paymentMethod: 'MPESA_STK_PUSH',
        amountKes,
        currency: 'KES',
        phoneNumber: input.phoneNumber,
        paymentIntentId,
        transactionId: null,
        providerReference: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    try {
      const bridgeResult = await mpesaBridge.execute(context, 'STK_PUSH', {
        phoneNumber: input.phoneNumber,
        amount: amountKes,
        accountReference: `SALE-${input.saleId}`,
        transactionDesc: `TDBK POS sale ${input.saleId}`,
      });
      const providerReference = bridgeResult.providerReference ?? null;
      const transactionId = providerReference ? `mpesa_${providerReference}` : null;
      const status = bridgeResult.status === 'PENDING' ? 'PENDING' : bridgeResult.status === 'FAILED' ? 'FAILED' : 'RECONCILIATION_REQUIRED';

      await firestoreClient.runTransaction(async (tx) => {
        const current = await tx.get<any>(path);
        if (!current) throw new Error('Sale payment intent disappeared during provider initiation');
        await tx.update<any>(path, { status, transactionId, providerReference, updatedAt: new Date().toISOString() });
        await outboxEngine.enqueueEvent(tenantId, {
          eventId: `sale-payment-initiated-${input.saleId}`,
          eventType: 'payment.initiated.v1',
          eventVersion: 'v1',
          occurredAt: new Date().toISOString(),
          tenantId,
          branchId,
          principalId: context.principal.id,
          correlationId: context.correlationId || context.requestId,
          causationId: context.requestId,
          source: 'SaleMpesaPaymentService',
          payload: { saleId: input.saleId, paymentIntentId, transactionId, providerReference, amountKes, currency: 'KES', status },
          metadata: { paymentMethod: 'MPESA_STK_PUSH' },
        }, tx, context.principal.id);
      });

      return { saleId: input.saleId, paymentIntentId, transactionId, providerReference, status, amountKes, currency: 'KES' };
    } catch (error: any) {
      const financialCandidates = await firestoreClient.listCollection<any>(`/tenants/${tenantId}/financialTransactions`).catch(() => []);
      const recovered = financialCandidates.find((record) =>
        record?.tenantId === tenantId &&
        record?.branchId === branchId &&
        Number(record?.amount) === amountKes &&
        ['PENDING', 'RECONCILIATION_REQUIRED'].includes(record?.status) &&
        String(record?.description || '').includes(input.saleId)
      );
      await firestoreClient.runTransaction(async (tx) => {
        const current = await tx.get<any>(path);
        if (!current) return;
        await tx.update<any>(path, {
          status: recovered ? 'RECONCILIATION_REQUIRED' : 'FAILED',
          transactionId: recovered?.transactionId ?? null,
          providerReference: recovered?.providerReference ?? null,
          lastError: error?.message || 'M-Pesa payment initiation failed',
          updatedAt: new Date().toISOString(),
        });
      });
      if (recovered) return { saleId: input.saleId, paymentIntentId, transactionId: recovered.transactionId, providerReference: recovered.providerReference, status: 'RECONCILIATION_REQUIRED', amountKes, currency: 'KES' };
      throw error;
    }
  }
}

export const saleMpesaPaymentService = new SaleMpesaPaymentService();
