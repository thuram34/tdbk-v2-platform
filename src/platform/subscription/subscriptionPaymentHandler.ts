/** TDBK V2 — payment-to-subscription bridge. */
import { EventEnvelope } from '../../orchestration/events/types';
import { SecurityContext } from '../../kernel/types';
import { subscriptionRepository } from '../../persistence/firestore/repositories/subscriptionRepository';
import { dbkRegistry } from '../dbkRegistry';
import { financialLedgerRepository } from '../../persistence/firestore/repositories/financialLedgerRepository';

export async function handleSubscriptionPaymentConfirmed(event: EventEnvelope): Promise<void> {
  if (event.eventType !== 'payment.confirmed.v1') throw new Error('Subscription payment handler received an unsupported event type.');
  const dbkId = event.tenantId;
  const payload = (event.payload || {}) as Record<string, any>;
  const providerReference = String(payload.data?.checkoutRequestId || event.causationId || '');
  if (!dbkId || !providerReference) throw new Error('Subscription payment event missing DBK or provider reference.');
  if (payload.status !== undefined && payload.status !== 'SUCCESS') throw new Error('Subscription activation requires a successful payment event.');

  const subscriptions = await subscriptionRepository.listSubscriptions(dbkId);
  const subscription = subscriptions.find((candidate) => candidate.paymentReference === providerReference);
  if (!subscription) return;

  // Event delivery alone is not financial evidence. Activation requires the
  // matching tenant transaction to have been durably posted to the ledger.
  const transactionId = 'mpesa_' + providerReference;
  const transaction = await financialLedgerRepository.getTransaction(dbkId, transactionId);
  if (
    !transaction ||
    transaction.tenantId !== dbkId ||
    transaction.status !== 'POSTED' ||
    transaction.providerReference !== providerReference ||
    Number(transaction.amount) !== Number(subscription.amount) ||
    transaction.currency !== subscription.currency
  ) {
    throw new Error('Subscription activation rejected: matching posted financial transaction was not found.');
  }

  const entries = await financialLedgerRepository.listEntries(dbkId, transactionId);
  const debitTotal = entries.filter((entry) => entry.entryType === 'DEBIT').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const creditTotal = entries.filter((entry) => entry.entryType === 'CREDIT').reduce((sum, entry) => sum + Number(entry.amount), 0);
  if (entries.length < 2 || entries.some((entry) => entry.immutable !== true || entry.currency !== subscription.currency) || debitTotal !== Number(subscription.amount) || creditTotal !== Number(subscription.amount)) {
    throw new Error('Subscription activation rejected: balanced immutable ledger entries are missing.');
  }

  const result = await subscriptionRepository.activateIfPending(
    dbkId,
    subscription.subscriptionId,
    providerReference,
    payload.provider || 'SAFARICOM_MPESA',
  );

  if (!result.transitioned) return;

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
