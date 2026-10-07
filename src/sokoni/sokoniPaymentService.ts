import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { KernelError } from '../kernel/errors/kernelErrors';
import { mpesaBridge } from '../orchestration/bridge/adapters/mpesaBridge';
import { Principal, SecurityContext } from '../kernel/types';
import { auditLogger } from '../kernel/audit/auditLogger';
import { outboxEngine } from '../orchestration/outbox/outboxEngine';
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
  providerReceiptReference?: string | null;
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
      createdAt: now, updatedAt: now, confirmedAt: null, providerReceiptReference: null,
    };

    await firestoreClient.runTransaction(async (tx) => {
      const currentParticipant = await tx.get<any>(participantPath(participantId));
      if (!currentParticipant || currentParticipant.ownerUid !== context.principal.id) {
        throw new KernelError('AUTHORIZATION_ERROR', 'Participant ownership changed during payment initiation.', 403, context.requestId);
      }
      if (
        currentParticipant.commercial?.offeringCode !== offeringCode ||
        currentParticipant.commercial?.state !== 'PAYMENT_REQUIRED' ||
        currentParticipant.publicationStatus !== 'DRAFT'
      ) {
        throw new KernelError('CONFLICT', 'Participant is no longer awaiting payment.', 409, context.requestId);
      }

      await tx.set(intentPath(intentId), intent);
      await tx.update<any>(participantPath(participantId), {
        commercial: { offeringCode, state: 'PAYMENT_PENDING' },
        publicationStatus: 'DRAFT',
        updatedAt: now,
      });
      await outboxEngine.enqueueEvent(systemTenantId, {
        eventId: `evt_sokoni_payment_initiated_${intentId}`,
        eventType: 'payment.initiated.v1',
        eventVersion: 'v1',
        occurredAt: now,
        tenantId: systemTenantId,
        branchId: null,
        principalId: context.principal.id,
        correlationId: context.correlationId || context.requestId,
        causationId: intentId,
        source: 'SokoniPaymentService',
        payload: {
          intentId,
          participantId,
          offeringCode,
          amount: offering.amount,
          currency: 'KES',
          provider: 'SAFARICOM_MPESA',
          providerReference: payment.providerReference,
          status: 'PENDING',
        },
        metadata: {},
      }, tx, context.principal.id);
    });

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'SOKONI_PAYMENT_INITIATED', `sokoni:payment:${intentId}`, 'ALLOWED', {
      tenantId: systemTenantId,
      requestId: context.requestId,
      details: { participantId, offeringCode, amount: offering.amount, providerReference: payment.providerReference },
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
    if (result.status === 'PENDING') return { intent, state: 'PENDING' };

    const nextState = result.status === 'SUCCESS' ? 'CONFIRMED' as const : 'FAILED' as const;
    const participantState = result.status === 'SUCCESS' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_FAILED';
    const publicationStatus = result.status === 'SUCCESS' ? 'ACTIVE' : 'DRAFT';

    const finalized = await firestoreClient.runTransaction(async (tx) => {
      const latestIntent = await tx.get<SokoniPaymentIntent>(intentPath(intentId));
      if (!latestIntent) throw new KernelError('NOT_FOUND', 'Sokoni payment intent disappeared during confirmation.', 404, context.requestId);
      if (latestIntent.ownerUid !== context.principal.id) throw new KernelError('AUTHORIZATION_ERROR', 'Payment ownership changed during confirmation.', 403, context.requestId);
      if (latestIntent.state !== 'PENDING') return latestIntent;

      const participant = await tx.get<any>(participantPath(latestIntent.participantId));
      if (!participant || participant.ownerUid !== context.principal.id) {
        throw new KernelError('AUTHORIZATION_ERROR', 'Sokoni participant ownership changed during confirmation.', 403, context.requestId);
      }
      if (participant.commercial?.offeringCode !== latestIntent.offeringCode) {
        throw new KernelError('CONFLICT', 'Sokoni participant offering no longer matches payment intent.', 409, context.requestId);
      }

      const confirmedIntent: SokoniPaymentIntent = {
        ...latestIntent,
        state: nextState,
        updatedAt: now,
        confirmedAt: result.status === 'SUCCESS' ? now : null,
        providerReceiptReference: result.status === 'SUCCESS'
          ? String((result.data as any)?.MpesaReceiptNumber || (result.data as any)?.mpesaReceiptNumber || result.providerReference || latestIntent.providerReference)
          : latestIntent.providerReceiptReference || null,
      };

      await tx.set(intentPath(intentId), confirmedIntent);
      await tx.update<any>(participantPath(latestIntent.participantId), {
        commercial: { offeringCode: latestIntent.offeringCode, state: participantState },
        publicationStatus,
        updatedAt: now,
      });

      await outboxEngine.enqueueEvent(systemTenantId, {
        eventId: `evt_sokoni_payment_${nextState.toLowerCase()}_${intentId}`,
        eventType: result.status === 'SUCCESS' ? 'payment.confirmed.v1' : 'payment.failed.v1',
        eventVersion: 'v1',
        occurredAt: now,
        tenantId: systemTenantId,
        branchId: null,
        principalId: context.principal.id,
        correlationId: context.correlationId || context.requestId,
        causationId: intentId,
        source: 'SokoniPaymentService',
        payload: {
          intentId,
          participantId: latestIntent.participantId,
          offeringCode: latestIntent.offeringCode,
          amount: latestIntent.amount,
          currency: latestIntent.currency,
          provider: latestIntent.provider,
          providerReference: latestIntent.providerReference,
          providerReceiptReference: confirmedIntent.providerReceiptReference || null,
          status: nextState,
        },
        metadata: {},
      }, tx, context.principal.id);

      return confirmedIntent;
    });

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, `SOKONI_PAYMENT_${nextState}`, `sokoni:payment:${intentId}`, 'ALLOWED', {
      tenantId: systemTenantId,
      requestId: context.requestId,
      details: {
        participantId: finalized.participantId,
        providerReference: finalized.providerReference,
        providerReceiptReference: finalized.providerReceiptReference || null,
      },
    });

    return { intent: finalized, state: finalized.state };
  }}

export const sokoniPaymentService = new SokoniPaymentService();
