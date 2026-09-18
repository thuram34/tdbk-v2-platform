/**
 * TDBK V2 TRANSACTIONAL OUTBOX & EVENT RELIABILITY ENGINE
 * Layer: LAYER 6 — WORKFLOW & EVENT ENGINE
 */

import { EventEnvelope } from '../events/types';
import { OutboxRecord } from '../../persistence/types';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { idempotencyRepository } from '../../persistence/firestore/repositories/idempotencyRepository';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { FirestoreTransaction } from '../../persistence/types';
import { pubSubTransport } from '../events/pubsubTransport';

export class OutboxEngine {
  private static instance: OutboxEngine;
  private maxAttempts = 5;

  private constructor() {}

  public static getInstance(): OutboxEngine {
    if (!OutboxEngine.instance) {
      OutboxEngine.instance = new OutboxEngine();
    }
    return OutboxEngine.instance;
  }

  /**
   * Enqueues an event into the transactional outbox at /tenants/{tenantId}/outbox/{eventId}.
   */
  public async enqueueEvent(
    tenantId: string,
    envelope: EventEnvelope,
    transaction?: FirestoreTransaction,
    principalId: string = 'sys_internal'
  ): Promise<OutboxRecord> {
    const now = new Date().toISOString();
    const record: OutboxRecord = {
      eventId: envelope.eventId,
      tenantId: tenantId,
      branchId: envelope.branchId || null,
      eventType: envelope.eventType,
      eventVersion: envelope.eventVersion,
      occurredAt: envelope.occurredAt,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId || null,
      source: envelope.source,
      payload: envelope.payload,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: now,
      createdAt: now,
      updatedAt: now,
      leaseOwner: null,
      leaseUntil: null,
      lastError: null,
      deliveredAt: null,
    };

    await outboxRepository.saveOutbox(tenantId, envelope.eventId, record, transaction);

    // When an event is enqueued inside a Firestore transaction, do not emit an
    // external audit side effect from inside that transaction callback. Firestore
    // may retry the callback, which would duplicate audit entries. Callers that
    // enqueue transactionally can audit after the transaction commits.
    if (!transaction) {
      auditLogger.logEvent(
        'WORKFLOW_EXECUTION',
        principalId,
        'OUTBOX_CREATED',
        `outbox:${envelope.eventId}`,
        'ALLOWED',
        {
          tenantId,
          branchId: envelope.branchId,
          details: { eventType: envelope.eventType, correlationId: envelope.correlationId },
        }
      );
    }

    return record;
  }

  /**
   * Processes pending/retry_wait outbox events for a tenant with worker lease protection.
   */
  public async processTenantOutbox(
    tenantId: string,
    workerId: string = 'worker_default',
    leaseDurationMs: number = 30000,
    deliverHandler?: (envelope: EventEnvelope) => Promise<void>
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    while (true) {
      const record = await outboxRepository.claimNextPending(tenantId, workerId, leaseDurationMs);
      if (!record) break;

      processed++;

      auditLogger.logEvent(
        'WORKFLOW_EXECUTION',
        workerId,
        'OUTBOX_CLAIMED',
        `outbox:${record.eventId}`,
        'ALLOWED',
        {
          tenantId: record.tenantId,
          branchId: record.branchId,
          details: { attemptCount: record.attemptCount, leaseOwner: workerId },
        }
      );

      try {
        const idempotencyKey = `outbox_delivery_${record.eventId}`;
        const idempotencyClaim = await idempotencyRepository.claimIdempotencyRecord(record.tenantId, idempotencyKey, {
          idempotencyKey,
          tenantId: record.tenantId,
          action: 'OUTBOX_DELIVERY',
          requestHash: record.eventId,
          status: 'IN_PROGRESS',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + leaseDurationMs).toISOString(),
        });

        if (idempotencyClaim === 'COMPLETED') {
          await outboxRepository.updateStatus(record.tenantId, record.eventId, 'DELIVERED', {
            deliveredAt: new Date().toISOString(),
            leaseOwner: null,
            leaseUntil: null,
          }, workerId);
          succeeded++;
          continue;
        }

        if (idempotencyClaim === 'IN_PROGRESS') {
          await outboxRepository.updateStatus(record.tenantId, record.eventId, 'RETRY_WAIT', {
            availableAt: new Date(Date.now() + 1000).toISOString(),
            leaseOwner: null,
            leaseUntil: null,
          }, workerId);
          continue;
        }

        const envelope: EventEnvelope = {
          eventId: record.eventId,
          eventType: record.eventType,
          eventVersion: record.eventVersion,
          occurredAt: record.occurredAt,
          tenantId: record.tenantId,
          branchId: record.branchId,
          principalId: workerId,
          correlationId: record.correlationId,
          causationId: record.causationId,
          source: record.source,
          payload: record.payload,
          metadata: {},
        };

        const handler =
          deliverHandler ?? ((event: EventEnvelope) => pubSubTransport.publish(event));

        await handler(envelope);

        await idempotencyRepository.completeIdempotencyRecord(record.tenantId, idempotencyKey, {
          eventId: record.eventId,
          status: 'DELIVERED',
        });

        await outboxRepository.updateStatus(record.tenantId, record.eventId, 'DELIVERED', {
          deliveredAt: new Date().toISOString(),
          leaseOwner: null,
          leaseUntil: null,
        }, workerId);

        auditLogger.logEvent(
          'WORKFLOW_EXECUTION',
          workerId,
          'OUTBOX_DELIVERY_SUCCEEDED',
          `outbox:${record.eventId}`,
          'ALLOWED',
          { tenantId: record.tenantId, branchId: record.branchId, details: { eventId: record.eventId } }
        );

        succeeded++;
      } catch (err: any) {
        const idempotencyKey = `outbox_delivery_${record.eventId}`;
        await idempotencyRepository.failIdempotencyRecord(record.tenantId, idempotencyKey, {
          error: err?.message || String(err),
        });
        failed++;
        const errorMessage = err?.message || String(err);
        const attempt = record.attemptCount;

        if (attempt >= this.maxAttempts) {
          await outboxRepository.updateStatus(record.tenantId, record.eventId, 'DEAD_LETTER', {
            lastError: errorMessage,
            leaseOwner: null,
            leaseUntil: null,
          }, workerId);

          auditLogger.logEvent(
            'WORKFLOW_EXECUTION',
            workerId,
            'OUTBOX_DEAD_LETTERED',
            `outbox:${record.eventId}`,
            'DENIED',
            { tenantId: record.tenantId, branchId: record.branchId, details: { eventId: record.eventId, error: errorMessage } }
          );
        } else {
          const backoffMs = Math.pow(2, attempt) * 1000;
          const availableAtIso = new Date(Date.now() + backoffMs).toISOString();

          await outboxRepository.updateStatus(record.tenantId, record.eventId, 'RETRY_WAIT', {
            lastError: errorMessage,
            availableAt: availableAtIso,
            leaseOwner: null,
            leaseUntil: null,
          }, workerId);

          auditLogger.logEvent(
            'WORKFLOW_EXECUTION',
            workerId,
            'OUTBOX_RETRY_SCHEDULED',
            `outbox:${record.eventId}`,
            'ERROR',
            { tenantId: record.tenantId, branchId: record.branchId, details: { eventId: record.eventId, attempt, backoffMs, error: errorMessage } }
          );
        }
      }
    }

    return { processed, succeeded, failed };
  }

  /**
   * Retrieves observational metrics for outbox records.
   */
  public async getMetrics(tenantId: string): Promise<{
    pending: number;
    processing: number;
    retry: number;
    failed: number;
    deadLetter: number;
    delivered: number;
    total: number;
    oldestPending: string | null;
    lastSuccessfulDelivery: string | null;
    lastFailure: string | null;
  }> {
    const records = await outboxRepository.listOutbox(tenantId);
    let pending = 0;
    let processing = 0;
    let retry = 0;
    let failed = 0;
    let deadLetter = 0;
    let delivered = 0;
    let oldestPending: string | null = null;
    let lastSuccessfulDelivery: string | null = null;
    let lastFailure: string | null = null;

    for (const r of records) {
      if (r.status === 'PENDING') {
        pending++;
        if (!oldestPending || r.createdAt < oldestPending) {
          oldestPending = r.createdAt;
        }
      } else if (r.status === 'PROCESSING') {
        processing++;
      } else if (r.status === 'RETRY_WAIT') {
        retry++;
      } else if (r.status === 'FAILED') {
        failed++;
        if (!lastFailure || r.updatedAt > lastFailure) {
          lastFailure = r.updatedAt;
        }
      } else if (r.status === 'DEAD_LETTER') {
        deadLetter++;
      } else if (r.status === 'DELIVERED') {
        delivered++;
        if (r.deliveredAt && (!lastSuccessfulDelivery || r.deliveredAt > lastSuccessfulDelivery)) {
          lastSuccessfulDelivery = r.deliveredAt;
        }
      }
    }

    return {
      pending,
      processing,
      retry,
      failed,
      deadLetter,
      delivered,
      total: records.length,
      oldestPending,
      lastSuccessfulDelivery,
      lastFailure,
    };
  }
}

export const outboxEngine = OutboxEngine.getInstance();
