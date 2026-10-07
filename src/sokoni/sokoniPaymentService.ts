import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { KernelError } from '../kernel/errors/kernelErrors';
import { mpesaBridge } from '../orchestration/bridge/adapters/mpesaBridge';
import { Principal, SecurityContext } from '../kernel/types';
import { auditLogger } from '../kernel/audit/auditLogger';
import { getSokoniCommercialOffering } from './sokoniCommercialConfig';

export type SokoniPaymentIntentState = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface SokoniPaymentIntent {
  intentId: string;
  participantId: string;
  ownerUid: string;
  offeringCode: string;
  amount: number;
  currency: 'KES';
  provider: 'SAFARICOM_MPESA';
  providerReference: string;
  state: SokoniPaymentIntentState;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
}

const participantPath = (id: string) => `/system/sokoni/participants/${id}`;
const intentPath = (id: string) => `/system/sokoni/paymentIntents/${id}`;

const SOKONI_PAYMENT_SERVICE_ROLE = 'TDBK_SYSTEM_SOKONI_PAYMENT';

function systemPaymentContext(context: SecurityContext, tenantId: string): SecurityContext {
  const principal: Principal = {
    ...context.principal,
    id: 'tdbk-system-sokoni-payment',
    tenantId,
    branchId: null,
    roles: [SOKONI_PAYMENT_SERVICE_ROLE],
    isMaster: false,
  };
  return {
    ...context,
    principal,
    tenantContext: { tenantId },
    branchContext: null,
  };
}

export class SokoniPaymentService {
  public async initiate(context: SecurityContext, participantId: string, offeringCode: string, phoneNumber: string): Promise<SokoniPaymentIntent> {
    const participant = await firestoreClient.get<any>(participantPath(participantId));
    if (!participant) throw new KernelError('NOT_FOUND', 'Sokoni participant not found.', 404, context.requestId);
    if (participant.ownerUid !== context.principal.id) throw new KernelError('AUTHORIZATION_ERROR', 'Only the participant owner can initiate its payment.', 403, context.requestId);
    if (participant.commercial?.offeringCode !== offeringCode || participant.commercial?.state !== 'PAYMENT_REQUIRED') {
      throw new KernelError('CONFLICT', 'Participant is not awaiting payment for this offering.', 409, context.requestId);
    }

    const offering = getSokoniCommercialOffering(offeringCode);
    if (!offering) throw new KernelError('VALIDATION_ERROR', 'Sokoni commercial offering is not configured.', 400, context.requestId);

    const systemTenantId = process.env.SOKONI_PAYMENT_TENANT_ID;
    if (!systemTenantId) throw new KernelError('INTEGRATION_UNAVAILABLE', 'Sokoni payment merchant tenant is not configured.', 503, context.requestId);

    const intentId = `sokpay_${crypto.randomUUID()}`;
    const payment = await mpesaBridge.executeSystemPayment(systemPaymentContext(context, systemTenantId), 'STK_PUSH', {
      phoneNumber,
      amount: offering.amount,
      accountReference: `SOKONI-${participantId}-${intentId}`,
      transactionDesc: `Sokoni ${offering.name}`,
    });

    if (!payment.providerReference) throw new KernelError('INTEGRATION_UNAVAILABLE', 'M-Pesa did not return a provider reference.', 503, context.requestId);

    const now = new Date().toISOString();
    const intent: SokoniPaymentIntent = {
      intentId, participantId, ownerUid: context.principal.id, offeringCode,
      amount: offering.amount, currency: 'KES', provider: 'SAFARICOM_MPESA',
      providerReference: payment.providerReference, state: 'PENDING',
      createdAt: now, updatedAt: now, confirmedAt: null,
    };
    await firestoreClient.set(intentPath(intentId), intent);
    await firestoreClient.update(participantPath(participantId), {
      commercial: { offeringCode, state: 'PAYMENT_PENDING' },
      publicationStatus: 'DRAFT',
      updatedAt: now,
    });
    return intent;
  }

  public async confirm(context: SecurityContext, intentId: string): Promise<{ intent: SokoniPaymentIntent; state: 'PENDING' | 'CONFIRMED' | 'FAILED' }> {
    const intent = await firestoreClient.get<SokoniPaymentIntent>(intentPath(intentId));
    if (!intent) throw new KernelError('NOT_FOUND', 'Sokoni payment intent not found.', 404, context.requestId);
    if (intent.ownerUid !== context.principal.id) throw new KernelError('AUTHORIZATION_ERROR', 'Only the payment owner can confirm this intent.', 403, context.requestId);
    if (intent.state !== 'PENDING') return { intent, state: intent.state };

    const systemTenantId = process.env.SOKONI_PAYMENT_TENANT_ID;
    if (!systemTenantId) throw new KernelError('INTEGRATION_UNAVAILABLE', 'Sokoni payment merchant tenant is not configured.', 503, context.requestId);

    const result = await mpesaBridge.executeSystemPayment(systemPaymentContext(context, systemTenantId), 'STK_QUERY', {
      phoneNumber: '',
      amount: intent.amount,
      accountReference: `SOKONI-${intent.participantId}-${intent.intentId}`,
      transactionDesc: 'Sokoni payment confirmation',
      checkoutRequestId: intent.providerReference,
      providerReference: intent.providerReference,
    });

    const now = new Date().toISOString();
    if (result.status === 'SUCCESS') {
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'SOKONI_PAYMENT_CONFIRM', `sokoni:payment:${intentId}`, 'ALLOWED', {
        requestId: context.requestId,
        tenantId: systemTenantId,
        details: { participantId: intent.participantId, provider: intent.provider, providerReference: intent.providerReference },
      });
      const confirmed = { ...intent, state: 'CONFIRMED' as const, updatedAt: now, confirmedAt: now };
      await firestoreClient.set(intentPath(intentId), confirmed);
      await firestoreClient.update(participantPath(intent.participantId), {
        commercial: { offeringCode: intent.offeringCode, state: 'PAYMENT_CONFIRMED' },
        publicationStatus: 'ACTIVE',
        updatedAt: now,
      });
      return { intent: confirmed, state: 'CONFIRMED' };
    }
    if (result.status === 'FAILED') {
      const failed = { ...intent, state: 'FAILED' as const, updatedAt: now };
      await firestoreClient.set(intentPath(intentId), failed);
      await firestoreClient.update(participantPath(intent.participantId), {
        commercial: { offeringCode: intent.offeringCode, state: 'PAYMENT_FAILED' },
        publicationStatus: 'DRAFT',
        updatedAt: now,
      });
      return { intent: failed, state: 'FAILED' };
    }
    return { intent, state: 'PENDING' };
  }
}

export const sokoniPaymentService = new SokoniPaymentService();
