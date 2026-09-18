/** TDBK V2 — payment-to-subscription bridge. */
import { EventEnvelope } from '../../orchestration/events/types';
import { subscriptionRepository } from '../../persistence/firestore/repositories/subscriptionRepository';
import { subscriptionService } from './subscriptionService';
import { securityContextFactory } from '../../kernel/context/contextFactory';

export async function handleSubscriptionPaymentConfirmed(event: EventEnvelope): Promise<void> {
  const payload = (event.payload || {}) as Record<string, any>;
  if (payload.purpose !== 'SUBSCRIPTION') return;

  const dbkId = event.tenantId;
  const providerReference = String(payload.data?.checkoutRequestId || event.causationId || payload.providerReference || '');
  if (!dbkId || !providerReference) throw new Error('Subscription payment event missing DBK or provider reference.');

  const subscriptions = await subscriptionRepository.listSubscriptions(dbkId);
  const subscription = subscriptions.find((candidate) =>
    candidate.paymentReference === providerReference
  );
  if (!subscription) return;
  const subscriptionId = subscription.subscriptionId;
  if (!subscription) throw new Error(`Subscription '${subscriptionId}' not found for DBK '${dbkId}'.`);
  if (subscription.paymentStatus === 'PAID' && subscription.status === 'ACTIVE') return;

  const context = {
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
      tokenSource: 'INTERNAL',
    },
    tenantContext: { tenantId: dbkId },
    branchContext: null,
    ipAddress: 'internal:subscription-payment-handler',
    userAgent: 'TDBK-Subscription-Event-Handler',
  } as const;

  const updated = await subscriptionRepository.updateSubscriptionForDbk(dbkId, subscriptionId, {
    paymentStatus: 'PAID',
    paymentReference: payload.providerReference || subscription.paymentReference,
    provider: payload.provider || subscription.provider || 'SAFARICOM_MPESA',
    status: 'ACTIVE',
  });

  await subscriptionService.activateSubscription(context, subscriptionId, dbkId);
  void updated;
}
