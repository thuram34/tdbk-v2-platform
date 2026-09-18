/**
 * TDBK V2 — DURABLE DBK SUBSCRIPTION REPOSITORY
 * Firestore Path: /tenants/{tenantId}/subscriptions/{subscriptionId}
 */

import { DbkSubscription, ISubscriptionRepository } from '../../types';
import { firestoreClient } from '../firestoreClient';

export class SubscriptionRepository implements ISubscriptionRepository {
  private static instance: SubscriptionRepository;
  private constructor() {}

  public static getInstance(): SubscriptionRepository {
    if (!SubscriptionRepository.instance) {
      SubscriptionRepository.instance = new SubscriptionRepository();
    }
    return SubscriptionRepository.instance;
  }

  private getPath(dbkId: string, subscriptionId: string): string {
    return `/tenants/${dbkId}/subscriptions/${subscriptionId}`;
  }

  private assertBoundary(dbkId: string, subscription: DbkSubscription): void {
    if (subscription.dbkId !== dbkId) throw new Error('Subscription tenant boundary violation.');
  }

  public async saveSubscription(subscription: DbkSubscription): Promise<void> {
    this.assertBoundary(subscription.dbkId, subscription);
    await firestoreClient.set(
      this.getPath(subscription.dbkId, subscription.subscriptionId),
      subscription as unknown as Record<string, unknown>,
    );
  }

  public async getSubscription(subscriptionId: string, dbkId?: string): Promise<DbkSubscription | null> {
    if (!dbkId) throw new Error('Subscription lookup requires dbkId to preserve tenant-scoped Firestore access.');
    return await firestoreClient.get<DbkSubscription>(this.getPath(dbkId, subscriptionId));
  }

  public async getActiveSubscription(dbkId: string): Promise<DbkSubscription | null> {
    const subscriptions = await this.listSubscriptions(dbkId);
    const active = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL');
    active.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return active[0] || null;
  }

  public async listSubscriptions(dbkId: string): Promise<DbkSubscription[]> {
    const subscriptions = await firestoreClient.listCollection<DbkSubscription>(
      `/tenants/${dbkId}/subscriptions`,
    );
    return subscriptions.filter((subscription) => subscription.dbkId === dbkId);
  }

  public async updateSubscription(
    subscriptionId: string,
    patch: Partial<DbkSubscription>,
  ): Promise<DbkSubscription> {
    if (!patch.dbkId) throw new Error('Subscription update requires dbkId for tenant-safe access.');
    const current = await firestoreClient.get<DbkSubscription>(
      this.getPath(patch.dbkId, subscriptionId),
    );
    if (!current) throw new Error(`Subscription '${subscriptionId}' not found.`);
    this.assertBoundary(patch.dbkId, current);
    const updated: DbkSubscription = { ...current, ...patch, subscriptionId: current.subscriptionId, dbkId: current.dbkId, updatedAt: new Date().toISOString() };
    await firestoreClient.set(
      this.getPath(current.dbkId, subscriptionId),
      updated as unknown as Record<string, unknown>,
    );
    return updated;
  }
}

export const subscriptionRepository = SubscriptionRepository.getInstance();
