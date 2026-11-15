/** TDBK V2 — payment-to-subscription bridge. */
import { EventEnvelope } from '../../orchestration/events/types';
import { SecurityContext } from '../../kernel/types';
import { subscriptionRepository } from '../../persistence/firestore/repositories/subscriptionRepository';
import { dbkRegistry } from '../dbkRegistry';

export async function handleSubscriptionPaymentConfirmed(event: EventEnvelope): Promise<void> {
  const dbkId = event.tenantId;
  const payload = (event.payload || {}) as Record<string, any>;
  const providerReference = String(payload.data?.checkoutRequestId || event.causationId || '');
  if (!dbkId || !providerReference) throw new Error('Subscription payment event missing DBK or provider reference.');

  const subscriptions = await subscriptionRepository.listSubscriptions(dbkId);
  const subscription = subscriptions.find((candidate) => candidate.paymentReference === providerReference);
  if (!subscription) return;

  // The event is only a payment claim. Bind it to the exact amount and currency
  // persisted on the subscription before changing commercial entitlement state.
  const confirmedAmount = Number(payload.amount);
  const confirmedCurrency = String(payload.currency || '');
  if (!Number.isFinite(confirmedAmount) || confirmedAmount <= 0) {
    throw new Error('Subscription payment event is missing a valid confirmed amount.');
  }
  if (!confirmedCurrency || confirmedCurrency !== subscription.currency) {
    throw new Error('Subscription payment currency does not match the persisted subscription.');
  }
  if (confirmedAmount !== Number(subscription.amount)) {
    throw new Error('Subscription payment amount does not match the persisted subscription.');
  }

  const result = await subscriptionRepository.activateIfPending(
    dbkId,
    subscription.subscriptionId,
    providerReference,
    payload.provider || 'SAFARICOM_MPESA',
  );

  // Subscription activation and DBK tier projection are separate durable writes.
  // On event retry, repair the tier projection even if the subscription was already
  // marked PAID by an earlier attempt that failed before this second write.
  const currentDbk = await dbkRegistry.getDbkInternal(dbkId);
  if (!currentDbk) throw new Error(`DBK '${dbkId}' not found while applying confirmed subscription payment.`);
  if (currentDbk.subscriptionTier === result.subscription.tier) return;

  const context: SecurityContext = {
    requestId: `subpay_${event.eventId}`,
    correlationId: event.correlationId,
    timestamp: new Date().toISOString(),
    principal: {
      id: 'TDBK_SUBSCRIPTION_EVENT_HANDLER',
      isMaster: true,
      tenantId: dbkId,
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'SERVICE_KEY' as const,
    },
    tenantContext: {
      tenantId: dbkId,
      name: 'TDBK Subscription Event Handler',
      blueprintId: 'TDBK_PLATFORM',
      status: 'ACTIVE',
    },
    branchContext: null,
    ipAddress: 'internal:subscription-payment-handler',
    userAgent: 'TDBK-Subscription-Event-Handler',
  };

  await dbkRegistry.changeSubscriptionTier(
    context,
    dbkId,
    result.subscription.tier,
    'Subscription payment confirmed',
  );
}
