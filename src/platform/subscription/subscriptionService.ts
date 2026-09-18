/**
 * TDBK V2 — AUTHORITATIVE SUBSCRIPTION SERVICE
 * Commercial state is durable; DBK.subscriptionTier remains the runtime entitlement projection.
 */

import { SubscriptionTier } from '../../capability/types';
import { DbkSubscription, SubscriptionPaymentStatus, SubscriptionStatus } from '../../persistence/types';
import { SecurityContext } from '../../kernel/types';
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
    const subscription: DbkSubscription = {
      subscriptionId: `sub_${crypto.randomUUID()}`,
      dbkId: input.dbkId,
      tier: input.tier,
      status: input.status || 'ACTIVE',
      paymentStatus: input.paymentStatus || 'PENDING',
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
