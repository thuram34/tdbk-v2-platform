/** TDBK V2 — payment-to-subscription bridge. */
import { EventEnvelope } from '../../orchestration/events/types';
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

  const result = await subscriptionRepository.activateIfPending(
    dbkId,
    subscription.subscriptionId,
    providerReference,
    payload.provider || 'SAFARICOM_MPESA',
  );

  if (!result.transitioned) return;

  const context = {
    requestId: \`subpay_\${event.eventId}\`,
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

  await dbkRegistry.changeSubscriptionTier(
    context,
    dbkId,
    result.subscription.tier,
    'Subscription payment confirmed',
  );
}
