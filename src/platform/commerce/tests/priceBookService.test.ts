import { beforeEach, describe, expect, it } from 'vitest';
import type { SecurityContext } from '../../../kernel/types';
import { firestoreClient } from '../../../persistence/firestore/firestoreClient';
import { priceBookService, type PriceBookPlan } from '../priceBookService';

function masterContext(): SecurityContext {
  return {
    requestId: 'req_pricebook_test',
    correlationId: 'corr_pricebook_test',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'test-master',
      isMaster: true,
      tenantId: 'tenant_pricebook_test',
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'SERVICE_KEY',
    },
    tenantContext: {
      tenantId: 'tenant_pricebook_test',
      name: 'Price Book Test Tenant',
      blueprintId: 'TEST',
      status: 'ACTIVE',
    },
    branchContext: null,
  };
}

const plans: PriceBookPlan[] = [{
  planId: 'growth-monthly',
  name: 'Growth Monthly',
  description: 'Configurable monthly plan.',
  tier: 'GROWTH',
  amountMinor: 250000,
  currency: 'KES',
  interval: 'MONTHLY',
  features: ['pos', 'inventory'],
  active: true,
}];

describe('PriceBookService', () => {
  beforeEach(() => firestoreClient.clearAllForTesting());

  it('publishes immutable versioned snapshots and resolves the current pointer', async () => {
    const first = await priceBookService.publish(masterContext(), { plans, expectedVersion: 0 });
    expect(first.version).toBe(1);
    expect(first.plans[0].amountMinor).toBe(250000);

    const current = await priceBookService.getPublished(masterContext());
    expect(current).toEqual(first);

    const second = await priceBookService.publish(masterContext(), {
      plans: [{ ...plans[0], amountMinor: 300000 }],
      expectedVersion: 1,
    });
    expect(second.version).toBe(2);
    expect(await firestoreClient.get('/system/commerce/priceBooks/global/versions/' + first.versionId)).toEqual(first);
  });

  it('rejects stale publication attempts using optimistic version checks', async () => {
    await priceBookService.publish(masterContext(), { plans, expectedVersion: 0 });
    await expect(priceBookService.publish(masterContext(), { plans, expectedVersion: 0 }))
      .rejects.toThrow(/changed since it was last read/i);
  });

  it('rejects duplicate plan identifiers and unsafe monetary values', async () => {
    await expect(priceBookService.publish(masterContext(), {
      plans: [plans[0], plans[0]],
      expectedVersion: 0,
    })).rejects.toThrow(/duplicate planId/i);
    await expect(priceBookService.publish(masterContext(), {
      plans: [{ ...plans[0], amountMinor: 1.25 }],
      expectedVersion: 0,
    })).rejects.toThrow(/non-negative safe integer/i);
  });

  it('does not expose a published price book to a cross-tenant caller', async () => {
    await priceBookService.publish(masterContext(), { plans, expectedVersion: 0 });
    const context = masterContext();
    context.principal = { ...context.principal, isMaster: false, roles: ['TENANT_ADMIN'], tenantId: null };
    context.tenantContext = null;
    await expect(priceBookService.getPublished(context)).rejects.toThrow(/tenant|authorization/i);
  });
});
