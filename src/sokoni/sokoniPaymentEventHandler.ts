import { EventEnvelope } from '../orchestration/events/types';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { outboxEngine } from '../orchestration/outbox/outboxEngine';
import { auditLogger } from '../kernel/audit/auditLogger';

const PARTICIPANTS = (id: string) => `/system/sokoni/participants/${id}`;
const INTENTS = '/system/sokoni/paymentIntents';

type SokoniPaymentEvent = {
  intentId?: string;
  participantId?: string;
  offeringCode?: string;
  amount?: number;
  currency?: string;
  providerReference?: string;
  providerReceiptReference?: string | null;
  status?: string;
};

async function handleSokoniPaymentEvent(event: EventEnvelope<SokoniPaymentEvent>): Promise<void> {
  const intentId = event.causationId || event.payload?.intentId;
  if (!intentId) return;

  await firestoreClient.runTransaction(async (tx) => {
    const intent = await tx.get<any>(`${INTENTS}/${intentId}`);
    if (!intent || intent.provider !== 'SAFARICOM_MPESA') return;
    if (intent.state !== 'PENDING') return;

    const participantId = intent.participantId;
    const participant = await tx.get<any>(PARTICIPANTS(participantId));
    if (!participant || participant.ownerUid !== intent.ownerUid) {
      throw new Error(`Sokoni payment ${intentId} cannot mutate an unowned participant.`);
    }

    const success = event.eventType === 'payment.confirmed.v1';
    const now = new Date().toISOString();
    const nextIntent = {
      ...intent,
      state: success ? 'CONFIRMED' : 'FAILED',
      updatedAt: now,
      confirmedAt: success ? now : null,
      providerReceiptReference: success
        ? (event.payload?.providerReceiptReference || intent.providerReceiptReference || event.payload?.providerReference || null)
        : intent.providerReceiptReference || null,
    };

    await tx.set(`${INTENTS}/${intentId}`, nextIntent);
    await tx.update<any>(PARTICIPANTS(participantId), {
      commercial: {
        offeringCode: intent.offeringCode,
        state: success ? 'PAYMENT_CONFIRMED' : 'PAYMENT_FAILED',
      },
      publicationStatus: success ? 'ACTIVE' : 'DRAFT',
      updatedAt: now,
    });
  });

  auditLogger.logEvent(
    'BRIDGE_EXECUTION',
    event.principalId || 'sys_internal',
    successAction(event.eventType),
    `sokoni:payment:${intentId}`,
    'ALLOWED',
    {
      tenantId: event.tenantId,
      requestId: event.causationId || undefined,
      details: {
        source: event.source,
        participantId: event.payload?.participantId,
        providerReference: event.payload?.providerReference,
        providerReceiptReference: event.payload?.providerReceiptReference || null,
      },
    },
  );
}

function successAction(eventType: string): string {
  return eventType === 'payment.confirmed.v1' ? 'SOKONI_PAYMENT_CONFIRMED_BY_EVENT' : 'SOKONI_PAYMENT_FAILED_BY_EVENT';
}

export const handleSokoniPaymentConfirmed = handleSokoniPaymentEvent;
export const handleSokoniPaymentFailed = handleSokoniPaymentEvent;
