/** TDBK V2 — payment-to-subscription bridge. */
import { EventEnvelope } from '../../orchestration/events/types';
import { subscriptionRepository } from '../../persistence/firestore/repositories/subscriptionRepository';
import { subscriptionService } from './subscriptionService';
import { securityContextFactory } from '../../kernel/context/contextFactory';

export async function handleSubscriptionPaymentConfirmed(event: EventEnvelope): Promise<void> {
  const payload = (event.payload || {}) as Record<string, any>;
  if (payload.purpose !== 'SUBSCRIPTION') return;

  const dbkId = event.tenantId;
  const subscriptionId = String(payload.subscriptionId || '');
  if (!dbkId || !subscriptionId) throw new Error('Subscription payment event missing dbkId or subscriptionId.');

  const subscription = await subscriptionRepository.getSubscriptionForDbk(dbkId, subscriptionId);
  if (!subscription) throw new Error(`Subscription '${subscriptionId}' not found for DBK '${dbkId}'.`);
  if (subscription.paymentStatus === 'PAID' && subscription.status === 'ACTIVE') return;

  const context = await securityContextFactory.createSecurityContext({
    authHeader: undefined,
    targetTenantId: dbkId,
    ipAddress: 'internal:subscription-payment-handler',
  });

  if (!context.principal.isMaster) {
    throw new Error('Internal subscription payment handler requires TDBK Master authority.');
  }

  const updated = await subscriptionRepository.updateSubscriptionForDbk(dbkId, subscriptionId, {
    paymentStatus: 'PAID',
    paymentReference: payload.providerReference || subscription.paymentReference,
    provider: payload.provider || subscription.provider || 'SAFARICOM_MPESA',
    status: 'ACTIVE',
  });

  await subscriptionService.activateSubscription(context, subscriptionId, dbkId);
  void updated;
}
