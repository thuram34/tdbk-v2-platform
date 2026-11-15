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
import { priceBookService } from '../commerce/priceBookService';

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



  public async createSubscriptionFromPlan(
    context: SecurityContext,
    dbkId: string,
    planId: string,
    expectedPriceBookVersion: number,
    correlationId: string,
  ): Promise<DbkSubscription> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'createSubscriptionFromPlan', context.requestId);
    if (!planId || typeof planId !== 'string' || !Number.isSafeInteger(expectedPriceBookVersion) || expectedPriceBookVersion < 1) {
      throw new ValidationError('A valid planId and published price book version are required.', context.requestId);
    }
    const dbk = await dbkRegistry.getDbkInternal(dbkId);
    if (!dbk) throw new ValidationError('The requested tenant does not exist.', context.requestId);
    const priceBook = await priceBookService.getPublished(context);
    if (!priceBook || priceBook.version !== expectedPriceBookVersion) {
      throw new ValidationError('The selected price book version is no longer current. Refresh plans and try again.', context.requestId);
    }
    const plan = priceBook.plans.find((item) => item.planId === planId && item.active);
    if (!plan) throw new ValidationError('The selected plan is unavailable.', context.requestId);
    const active = await subscriptionRepository.getActiveSubscription(dbkId);
    if (active) throw new ValidationError('This tenant already has an active subscription.', context.requestId);

    const exponent = ['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'].includes(plan.currency)
      ? 0
      : ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'].includes(plan.currency) ? 3 : 2;
    const now = new Date().toISOString();
    const subscription: DbkSubscription = {
      subscriptionId: 'sub_' + crypto.randomUUID(),
      dbkId,
      tier: plan.tier,
      status: 'TRIAL',
      paymentStatus: 'PENDING',
      currency: plan.currency,
      amount: plan.amountMinor / (10 ** exponent),
      amountMinor: plan.amountMinor,
      planId: plan.planId,
      priceBookVersion: priceBook.version,
      interval: plan.interval,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      cancelledAt: null,
      paymentReference: null,
      provider: null,
      createdAt: now,
      updatedAt: now,
      correlationId: correlationId || context.correlationId || context.requestId,
    };
    await subscriptionRepository.saveSubscription(subscription);
    return subscription;
  }

  public async cancelSubscription(context: SecurityContext, subscriptionId: string, dbkId: string, reason?: string): Promise<DbkSubscription> {
    masterAuthority.assertMasterAuthority(context.principal, 'cancelSubscription', context.requestId);
    const updated = await subscriptionRepository.updateSubscriptionForDbk(dbkId, subscriptionId, { status: 'CANCELLED', cancelledAt: new Date().toISOString() });
    return updated;
  }
}

export const subscriptionService = new SubscriptionService();
