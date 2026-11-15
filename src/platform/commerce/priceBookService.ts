/**
 * TDBK V2 — VERSIONED COMMERCIAL PRICE BOOK
 *
 * Prices are configurable, versioned and stored in minor currency units.
 * Published snapshots are immutable; a pointer identifies the current version.
 */
import type { SecurityContext } from '../../kernel/types';
import type { SubscriptionTier } from '../../capability/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';

export type PriceBookInterval = 'MONTHLY' | 'ANNUAL' | 'NONE';

export interface PriceBookPlan {
  planId: string;
  name: string;
  description: string;
  tier: SubscriptionTier;
  amountMinor: number;
  currency: string;
  interval: PriceBookInterval;
  features: string[];
  active: boolean;
}

export interface PriceBookSnapshot {
  version: number;
  versionId: string;
  status: 'PUBLISHED';
  plans: PriceBookPlan[];
  createdAt: string;
  publishedAt: string;
  publishedBy: string;
  correlationId: string;
}

interface PriceBookPointer {
  version: number;
  versionId: string;
  updatedAt: string;
}

const POINTER_PATH = '/system/commerce/priceBooks/global';
const VERSION_COLLECTION = '/system/commerce/priceBooks/global/versions';
const PLAN_ID = /^[a-z0-9][a-z0-9_-]{2,79}$/;
const CURRENCY = /^[A-Z]{3}$/;
const TIERS: readonly string[] = ['FREE', 'FOUNDATION', 'GROWTH', 'PRO', 'ENTERPRISE'];
const INTERVALS: readonly string[] = ['MONTHLY', 'ANNUAL', 'NONE'];

function invalid(message: string, requestId: string): never {
  throw new KernelError('VALIDATION_ERROR', message, 400, requestId);
}

function validatePlans(plans: PriceBookPlan[], requestId: string): PriceBookPlan[] {
  if (!Array.isArray(plans) || plans.length === 0 || plans.length > 100) {
    invalid('Publish between 1 and 100 price book plans.', requestId);
  }
  const ids = new Set<string>();
  return plans.map((raw) => {
    if (!raw || typeof raw !== 'object') invalid('Every price book plan must be an object.', requestId);
    if (typeof raw.planId !== 'string' || !PLAN_ID.test(raw.planId)) invalid('planId must be a 3-80 character lowercase identifier.', requestId);
    if (ids.has(raw.planId)) invalid('Duplicate planId: ' + raw.planId, requestId);
    ids.add(raw.planId);
    if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.trim().length > 100) invalid('Plan name is required and must not exceed 100 characters.', requestId);
    if (typeof raw.description !== 'string' || raw.description.length > 1000) invalid('Plan description must be a string of at most 1000 characters.', requestId);
    if (!TIERS.includes(raw.tier)) invalid('Unsupported subscription tier for plan ' + raw.planId, requestId);
    if (!Number.isSafeInteger(raw.amountMinor) || raw.amountMinor < 0) invalid('amountMinor must be a non-negative safe integer.', requestId);
    if (typeof raw.currency !== 'string' || !CURRENCY.test(raw.currency)) invalid('currency must be a three-letter uppercase ISO code.', requestId);
    if (!INTERVALS.includes(raw.interval)) invalid('Unsupported billing interval for plan ' + raw.planId, requestId);
    if (!Array.isArray(raw.features) || raw.features.length > 100 || raw.features.some((f) => typeof f !== 'string' || !f.trim() || f.length > 160)) invalid('features must be an array of at most 100 non-empty strings.', requestId);
    if (typeof raw.active !== 'boolean') invalid('active must be a boolean.', requestId);
    return {
      planId: raw.planId,
      name: raw.name.trim(),
      description: raw.description.trim(),
      tier: raw.tier,
      amountMinor: raw.amountMinor,
      currency: raw.currency,
      interval: raw.interval,
      features: [...new Set(raw.features.map((f) => f.trim()))],
      active: raw.active,
    };
  });
}

export class PriceBookService {
  private async assertTenantRead(context: SecurityContext): Promise<void> {
    const tenantId = context.tenantContext?.tenantId ?? context.principal.tenantId;
    if (!tenantId || (context.tenantContext?.tenantId && context.tenantContext.tenantId !== tenantId)) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'A valid tenant context is required to read commercial plans.', 403, context.requestId);
    }
    const result = await rbacEngine.authorizeAsync(context.principal, 'read-price-book', 'commerce:price-book', {
      tenantId,
      branchId: context.branchContext?.branchId ?? context.principal.branchId ?? undefined,
      requestId: context.requestId,
    });
    if (!result.allowed) throw new KernelError('AUTHORIZATION_ERROR', result.reason, 403, context.requestId);
  }

  async getPublished(context: SecurityContext): Promise<PriceBookSnapshot | null> {
    await this.assertTenantRead(context);
    const pointer = await firestoreClient.get<PriceBookPointer>(POINTER_PATH);
    if (!pointer?.versionId) return null;
    return firestoreClient.get<PriceBookSnapshot>(VERSION_COLLECTION + '/' + pointer.versionId);
  }

  async publish(context: SecurityContext, input: { plans: PriceBookPlan[]; expectedVersion?: number }): Promise<PriceBookSnapshot> {
    masterAuthority.assertMasterAuthority(context.principal, 'publishPriceBook', context.requestId);
    if (!input || typeof input !== 'object') invalid('Price book publication payload is required.', context.requestId);
    const plans = validatePlans(input.plans, context.requestId);
    const now = new Date().toISOString();
    const versionId = 'pricebook_' + crypto.randomUUID();
    return firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<PriceBookPointer>(POINTER_PATH);
      const currentVersion = current?.version ?? 0;
      if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
        throw new KernelError('OPTIMISTIC_LOCK_ERROR', 'Price book changed since it was last read. Refresh before publishing.', 409, context.requestId);
      }
      const snapshot: PriceBookSnapshot = {
        version: currentVersion + 1,
        versionId,
        status: 'PUBLISHED',
        plans,
        createdAt: now,
        publishedAt: now,
        publishedBy: context.principal.id,
        correlationId: context.correlationId || context.requestId,
      };
      await tx.set(VERSION_COLLECTION + '/' + versionId, snapshot as unknown as Record<string, unknown>);
      await tx.set(POINTER_PATH, { version: snapshot.version, versionId, updatedAt: now });
      return snapshot;
    });
  }
}

export const priceBookService = new PriceBookService();
