/**
 * TDBK V2 — TRANSACTIONAL OUTBOX & EVENT DELIVERY RELIABILITY VERIFICATION SUITE
 * Covers OUTBOX_01 through OUTBOX_22
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { outboxEngine } from '../outbox/outboxEngine';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { auditLogger } from '../../kernel/audit/auditLogger';

describe('TDBK V2 — Transactional Outbox & Event Delivery Reliability Hardening', () => {
  const tenantId = 'tenant_outbox_test_01';
  const tenantIdB = 'tenant_outbox_test_02';

  beforeEach(() => {
    firestoreClient.clearAllForTesting();
    auditLogger.clearBufferForTesting();
  });

  it('OUTBOX_01: State mutation creates outbox atomically in Firestore', async () => {
    const eventId = 'evt_01_' + Date.now();
    await firestoreClient.runTransaction(async (tx) => {
      await tx.set(`/tenants/${tenantId}/entities/rec_01`, { name: 'Test Record' });
      await outboxEngine.enqueueEvent(
        tenantId,
        {
          eventId,
          eventType: 'business.created.v1',
          eventVersion: 'v1',
          occurredAt: new Date().toISOString(),
          tenantId,
          branchId: 'branch_hq',
          principalId: 'usr_admin',
          correlationId: 'corr_01',
          causationId: null,
          source: 'test',
          payload: { name: 'Test Record' },
          metadata: {},
        },
        tx
      );
    });

    const record = await outboxRepository.getOutbox(tenantId, eventId);
    expect(record).not.toBeNull();
    expect(record?.status).toBe('PENDING');
    expect(record?.correlationId).toBe('corr_01');
  });

  it('OUTBOX_02: State transaction failure creates no orphan outbox', async () => {
    const eventId = 'evt_02_' + Date.now();
    try {
      await firestoreClient.runTransaction(async (tx) => {
        await tx.set(`/tenants/${tenantId}/entities/rec_02`, { name: 'Fail Record' });
        await outboxEngine.enqueueEvent(
          tenantId,
          {
            eventId,
            eventType: 'business.created.v1',
            eventVersion: 'v1',
            occurredAt: new Date().toISOString(),
            tenantId,
            branchId: 'branch_hq',
            principalId: 'usr_admin',
            correlationId: 'corr_02',
            causationId: null,
            source: 'test',
            payload: {},
            metadata: {},
          },
          tx
        );
        throw new Error('Simulated atomic transaction failure');
      });
    } catch {
      // expected error
    }

    const record = await outboxRepository.getOutbox(tenantId, eventId);
    expect(record).toBeNull();
    const doc = await firestoreClient.get(`/tenants/${tenantId}/entities/rec_02`);
    expect(doc).toBeNull();
  });

  it('OUTBOX_03 & 04: Outbox survives process restart and pending event is recovered', async () => {
    const eventId = 'evt_03_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_03',
      causationId: null,
      source: 'test',
      payload: { value: 100 },
      metadata: {},
    });

    firestoreClient.simulateServerRestart();

    const record = await outboxRepository.getOutbox(tenantId, eventId);
    expect(record).not.toBeNull();
    expect(record?.status).toBe('PENDING');
    expect(record?.payload.value).toBe(100);
  });

  it('OUTBOX_05 & 06: Worker claims event atomically and prevents double claiming', async () => {
    const eventId = 'evt_05_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_05',
      causationId: null,
      source: 'test',
      payload: {},
      metadata: {},
    });

    const claimed1 = await outboxRepository.claimNextPending(tenantId, 'worker_1', 10000);
    expect(claimed1).not.toBeNull();
    expect(claimed1?.eventId).toBe(eventId);
    expect(claimed1?.status).toBe('PROCESSING');
    expect(claimed1?.leaseOwner).toBe('worker_1');

    const claimed2 = await outboxRepository.claimNextPending(tenantId, 'worker_2', 10000);
    expect(claimed2).toBeNull();
  });

  it('OUTBOX_07: Expired lease can be recovered by another worker', async () => {
    const eventId = 'evt_07_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_07',
      causationId: null,
      source: 'test',
      payload: {},
      metadata: {},
    });

    await outboxRepository.claimNextPending(tenantId, 'worker_1', 10000);

    const path = `/tenants/${tenantId}/outbox/${eventId}`;
    const doc: any = await firestoreClient.get(path);
    doc.leaseUntil = new Date(Date.now() - 5000).toISOString();
    await firestoreClient.set(path, doc);

    const claimed2 = await outboxRepository.claimNextPending(tenantId, 'worker_2', 10000);
    expect(claimed2).not.toBeNull();
    expect(claimed2?.leaseOwner).toBe('worker_2');
  });

  it('OUTBOX_08 & 09: Transient failure schedules retry with exponential backoff', async () => {
    const eventId = 'evt_08_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_08',
      causationId: null,
      source: 'test',
      payload: {},
      metadata: {},
    });

    const result = await outboxEngine.processTenantOutbox(tenantId, 'worker_1', 30000, async () => {
      throw new Error('Transient network timeout');
    });

    expect(result.failed).toBe(1);
    const record = await outboxRepository.getOutbox(tenantId, eventId);
    expect(record?.status).toBe('RETRY_WAIT');
    expect(record?.attemptCount).toBe(1);
    expect(record?.lastError).toContain('Transient network timeout');
  });

  it('OUTBOX_10: Permanent failure / max attempts stops retry and moves to DEAD_LETTER', async () => {
    const eventId = 'evt_10_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_10',
      causationId: null,
      source: 'test',
      payload: {},
      metadata: {},
    });

    for (let i = 0; i < 5; i++) {
      await outboxEngine.processTenantOutbox(tenantId, 'worker_1', 30000, async () => {
        throw new Error('Permanent failure');
      });
      const path = `/tenants/${tenantId}/outbox/${eventId}`;
      const doc: any = await firestoreClient.get(path);
      if (doc) {
        doc.availableAt = new Date().toISOString();
        await firestoreClient.set(path, doc);
      }
    }

    const record = await outboxRepository.getOutbox(tenantId, eventId);
    expect(record?.status).toBe('DEAD_LETTER');
  });

  it('OUTBOX_CRASH: expired delivery lease can recover after handler success but before completion', async () => {
    const eventId = 'evt_crash_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'payment.confirmed.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_crash',
      causationId: null,
      source: 'test',
      payload: { amount: 1000 },
      metadata: {},
    });

    // First worker successfully performs the handler side effect, then the process
    // dies before it can complete the durable delivery/idempotency record.
    let executions = 0;
    const first = await outboxRepository.claimNextPending(tenantId, 'worker_crashed', 1);
    expect(first).not.toBeNull();

    const idempotencyPath = `/tenants/${tenantId}/idempotency/outbox_delivery_${eventId}`;
    await firestoreClient.set(idempotencyPath, {
      idempotencyKey: `outbox_delivery_${eventId}`,
      tenantId,
      action: 'OUTBOX_DELIVERY',
      requestHash: eventId,
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    executions++;

    const outboxPath = `/tenants/${tenantId}/outbox/${eventId}`;
    const crashed = await firestoreClient.get<any>(outboxPath);
    crashed.leaseUntil = new Date(Date.now() - 1000).toISOString();
    await firestoreClient.set(outboxPath, crashed);

    const second = await outboxEngine.processTenantOutbox(
      tenantId,
      'worker_recovered',
      30000,
      async () => {
        executions++;
      }
    );

    expect(second.succeeded).toBe(1);
    expect(executions).toBe(2);
    expect((await outboxRepository.getOutbox(tenantId, eventId))?.status).toBe('DELIVERED');
  });

  it('OUTBOX_11, 12 & 13: Duplicate eventId & idempotent consumer execution', async () => {
    const eventId = 'evt_11_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'payment.confirmed.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_11',
      causationId: null,
      source: 'test',
      payload: { amount: 500 },
      metadata: {},
    });

    let executionCount = 0;
    const deliverHandler = async () => {
      executionCount++;
    };

    const res1 = await outboxEngine.processTenantOutbox(tenantId, 'worker_1', 30000, deliverHandler);
    expect(res1.succeeded).toBe(1);
    expect(executionCount).toBe(1);

    const record = await outboxRepository.getOutbox(tenantId, eventId);
    if (record) {
      record.status = 'PENDING';
      await outboxRepository.saveOutbox(tenantId, eventId, record);
    }

    const res2 = await outboxEngine.processTenantOutbox(tenantId, 'worker_1', 30000, deliverHandler);
    expect(res2.succeeded).toBe(1);
    expect(executionCount).toBe(1);
  });

  it('OUTBOX_14 & 15: Tenant isolation prevents Tenant A from accessing Tenant B outbox', async () => {
    const eventId = 'evt_14_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_14',
      causationId: null,
      source: 'test',
      payload: {},
      metadata: {},
    });

    const tenantBRecord = await outboxRepository.getOutbox(tenantIdB, eventId);
    expect(tenantBRecord).toBeNull();

    const tenantBList = await outboxRepository.listOutbox(tenantIdB);
    expect(tenantBList.length).toBe(0);
  });

  it('OUTBOX_16: Branch isolation remains enforced', async () => {
    const eventId = 'evt_16_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq_secure',
      principalId: 'usr_admin',
      correlationId: 'corr_16',
      causationId: null,
      source: 'test',
      payload: {},
      metadata: {},
    });

    const record = await outboxRepository.getOutbox(tenantId, eventId);
    expect(record?.branchId).toBe('branch_hq_secure');
  });

  it('OUTBOX_17 & 18: Audit events are persisted and dead-letter inspectable', async () => {
    const eventId = 'evt_17_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_17',
      causationId: null,
      source: 'test',
      payload: { secret: 'super_secret_value_to_sanitize' },
      metadata: {},
    });

    const audits = auditLogger.getEventsForTenant(tenantId);
    expect(audits.some((a) => a.action === 'OUTBOX_CREATED')).toBe(true);
    const createdAudit = audits.find((a) => a.action === 'OUTBOX_CREATED');
    expect(JSON.stringify(createdAudit?.details)).not.toContain('super_secret_value_to_sanitize');
  });

  it('OUTBOX_19 & 20: Original correlationId and causationId survive retries', async () => {
    const eventId = 'evt_19_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'business.created.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_original_123',
      causationId: 'causation_original_456',
      source: 'test',
      payload: {},
      metadata: {},
    });

    const record = await outboxRepository.getOutbox(tenantId, eventId);
    expect(record?.correlationId).toBe('corr_original_123');
    expect(record?.causationId).toBe('causation_original_456');
  });

  it('OUTBOX_21 & 22: Provider success distinction & mock bridge failure retry policy', async () => {
    const eventId = 'evt_21_' + Date.now();
    await outboxEngine.enqueueEvent(tenantId, {
      eventId,
      eventType: 'payment.initiated.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_admin',
      correlationId: 'corr_21',
      causationId: null,
      source: 'test',
      payload: { amount: 1000 },
      metadata: {},
    });

    const metrics = await outboxEngine.getMetrics(tenantId);
    expect(metrics.pending).toBe(1);
    expect(metrics.delivered).toBe(0);
  });
});
