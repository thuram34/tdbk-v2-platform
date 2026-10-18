/**
 * TDBK V2 — AUTHORITATIVE SUBSCRIPTION SERVICE
 * Commercial state is durable; DBK.subscriptionTier remains the runtime entitlement projection.
 */

import { SubscriptionTier } from '../../capability/types';
import { DbkSubscription, SubscriptionPaymentStatus, SubscriptionStatus } from '../../persistence/types';
import { SecurityContext } from '../../kernel/types';
import { ValidationError } from '../../kernel/errors/kernelErrors';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { dbkRegistry } from '../dbkRegistry';
import { subscriptionRepository } from '../../persistence/firestore/repositories/subscriptionRepository';

export interface CreateSubscriptionInput {
  dbkId: string;
  tier: SubscriptionTier;
  amount: number;
  currency?: string;
  interval?: 'MONTHLY' | 'ANNUAL' | 'NONE';
  paymentReference?: string | null;
  provider?: string | null;
  status?: SubscriptionStatus;
  paymentStatus?: SubscriptionPaymentStatus;
  periodEnd?: string | null;
  correlationId: string;
}

export class SubscriptionService {
  public async createSubscription(context: SecurityContext, input: CreateSubscriptionInput): Promise<DbkSubscription> {
    masterAuthority.assertMasterAuthority(context.principal, 'createSubscription', context.requestId);
    const dbk = await dbkRegistry.getDbkInternal(input.dbkId);
    if (!dbk) throw new Error(`DBK '${input.dbkId}' not found.`);

    const now = new Date().toISOString();
    const paymentStatus = input.paymentStatus || 'PENDING';
    const status = input.status || (paymentStatus === 'PAID' ? 'ACTIVE' : 'TRIAL');
    if (status === 'ACTIVE' && paymentStatus !== 'PAID') {
      throw new ValidationError(
        'An ACTIVE subscription must have PAID payment status. Pending subscriptions must remain TRIAL until payment confirmation.',
        context.requestId,
      );
    }
    const subscription: DbkSubscription = {
      subscriptionId: `sub_${crypto.randomUUID()}`,
      dbkId: input.dbkId,
      tier: input.tier,
      status,
      paymentStatus,
      currency: input.currency || 'KES',
      amount: input.amount,
      interval: input.interval || 'MONTHLY',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: input.periodEnd || null,
      cancelledAt: null,
      paymentReference: input.paymentReference || null,
      provider: input.provider || null,
      createdAt: now,
      updatedAt: now,
      correlationId: input.correlationId,
    };
    await subscriptionRepository.saveSubscription(subscription);
    return subscription;
  }

  /**
   * Creates a pending paid subscription for the authenticated DBK owner.
   * Amount must be resolved by the server from the deployment's price configuration.
   * This does not grant entitlements; only the verified payment event handler does.
   */
  public async createOwnerCheckoutSubscription(context: SecurityContext, input: CreateSubscriptionInput): Promise<DbkSubscription> {
    await masterAuthority.assertTenantAuthority(context, input.dbkId, 'createSubscription', context.requestId);
    const dbk = await dbkRegistry.getDbkInternal(input.dbkId);
    if (!dbk) throw new Error(`DBK '${input.dbkId}' not found.`);
    if (dbk.masterOwner !== context.principal.id && dbk.createdBy !== context.principal.id && !masterAuthority.isMasterAdmin(context.principal)) {
      throw new ValidationError('Only the registered DBK owner can initiate its subscription checkout.', context.requestId);
    }
    if (input.tier === 'FREE') throw new ValidationError('The FREE tier does not require paid checkout.', context.requestId);
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ValidationError('Subscription amount must be a positive server-configured integer in KES.', context.requestId);

    const now = new Date().toISOString();
    const subscription: DbkSubscription = {
      subscriptionId: `sub_${crypto.randomUUID()}`,
      dbkId: input.dbkId,
      tier: input.tier,
      status: 'TRIAL',
      paymentStatus: 'PENDING',
      currency: 'KES',
      amount: input.amount,
      interval: input.interval || 'MONTHLY',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      cancelledAt: null,
      paymentReference: null,
      provider: 'SAFARICOM_MPESA',
      createdAt: now,
      updatedAt: now,
      correlationId: input.correlationId,
    };
    await subscriptionRepository.saveSubscription(subscription);
    return subscription;
  }

  public async activateSubscription(context: SecurityContext, subscriptionId: string, dbkId: string): Promise<DbkSubscription> {
    masterAuthority.assertMasterAuthority(context.principal, 'activateSubscription', context.requestId);
    const subscription = await subscriptionRepository.getSubscriptionForDbk(dbkId, subscriptionId);
    if (!subscription) throw new Error(`Subscription '${subscriptionId}' not found.`);
    const updated = await subscriptionRepository.updateSubscriptionForDbk(dbkId, subscriptionId, { status: 'ACTIVE', paymentStatus: 'PAID' });
    await dbkRegistry.changeSubscriptionTier(context, dbkId, updated.tier, 'Subscription activated');
    return updated;
  }

  public async cancelSubscription(context: SecurityContext, subscriptionId: string, dbkId: string, reason?: string): Promise<DbkSubscription> {
    masterAuthority.assertMasterAuthority(context.principal, 'cancelSubscription', context.requestId);
    const updated = await subscriptionRepository.updateSubscriptionForDbk(dbkId, subscriptionId, { status: 'CANCELLED', cancelledAt: new Date().toISOString() });
    return updated;
  }
}

export const subscriptionService = new SubscriptionService();
