import type { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { mpesaBridge } from '../../orchestration/bridge/adapters/mpesaBridge';

export interface InitiatePosMpesaPaymentInput {
  saleId: string;
  phoneNumber: string;
}

export interface InitiatePosMpesaPaymentResult {
  saleId: string;
  amountKes: number;
  status: 'PENDING';
  provider: 'SAFARICOM_MPESA';
  providerReference: string;
  checkoutRequestId: string;
}

export class PosPaymentService {
  async initiateMpesaPayment(
    context: SecurityContext,
    dbkId: string,
    input: InitiatePosMpesaPaymentInput,
  ): Promise<InitiatePosMpesaPaymentResult> {
    const tenantId = context.tenantContext?.tenantId ?? dbkId;
    const branchId = context.branchContext?.branchId;

    if (!branchId) throw new KernelError('VALIDATION_ERROR', 'An active branch is required for a POS payment.', 400, context.requestId);
    if (tenantId !== dbkId) throw new KernelError('VALIDATION_ERROR', 'Payment tenant does not match the target business.', 400, context.requestId);
    if (!input?.saleId || !input.phoneNumber) throw new KernelError('VALIDATION_ERROR', 'saleId and phoneNumber are required.', 400, context.requestId);

    const salePath = '/tenants/' + tenantId + '/entities/sales_counter/records/' + input.saleId;
    const sale = await firestoreClient.get<any>(salePath);
    if (!sale) throw new KernelError('VALIDATION_ERROR', 'Sale ' + input.saleId + ' was not found.', 404, context.requestId);
    if (sale.status !== 'COMPLETED' || sale.branchId !== branchId) {
      throw new KernelError('VALIDATION_ERROR', 'Payment can only be initiated for a completed sale in the active branch.', 400, context.requestId);
    }

    const amountKes = Number(sale.attributes?.totalAmountKes);
    const currentPaymentStatus = sale.attributes?.paymentStatus;
    if (!Number.isFinite(amountKes) || amountKes <= 0) {
      throw new KernelError('VALIDATION_ERROR', 'Sale has no valid payable total.', 400, context.requestId);
    }
    if (currentPaymentStatus === 'PAID') {
      throw new KernelError('CONFLICT', 'Sale is already marked as paid.', 409, context.requestId);
    }

    const paymentContext: SecurityContext = { ...context, correlationId: input.saleId };
    const result = await mpesaBridge.execute(paymentContext, 'STK_PUSH', {
      phoneNumber: input.phoneNumber,
      amount: amountKes,
      accountReference: 'SALE-' + input.saleId,
      transactionDesc: 'TDBK POS sale ' + input.saleId,
    });

    if (result.status !== 'PENDING' || !result.providerReference) {
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'M-Pesa did not create a pending payment.', 503, context.requestId);
    }

    return {
      saleId: input.saleId,
      amountKes,
      status: 'PENDING',
      provider: 'SAFARICOM_MPESA',
      providerReference: result.providerReference,
      checkoutRequestId: String(result.data?.checkoutRequestId || result.providerReference),
    };
  }
}

export const posPaymentService = new PosPaymentService();
