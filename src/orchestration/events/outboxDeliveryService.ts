/**
 * TDBK V2 — DURABLE OUTBOX DELIVERY RUNTIME
 *
 * Delivers tenant-scoped durable outbox records through the EventBus.
 * Financial truth is committed independently; delivery failure only changes
 * the durable delivery state and leaves the event retryable.
 */
import type { EventEnvelope } from './types';
import { eventBus } from './eventBus';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import type { OutboxRecord } from '../../persistence/types';

export interface OutboxDeliveryResult {
  claimed: boolean;
  delivered: boolean;
  eventId: string | null;
  attemptCount: number;
  error?: string;
}

export class OutboxDeliveryService {
  private static instance: OutboxDeliveryService;

  private constructor() {}

  public static getInstance(): OutboxDeliveryService {
    return (this.instance ??= new OutboxDeliveryService());
  }

  public async deliverNext(
    tenantId: string,
    workerId: string,
    leaseDurationMs = 30_000,
  ): Promise<OutboxDeliveryResult> {
    const record = await outboxRepository.claimNextPending(tenantId, workerId, leaseDurationMs);
    if (!record) {
      return { claimed: false, delivered: false, eventId: null, attemptCount: 0 };
    }

    try {
      await eventBus.publish(this.toEventEnvelope(record), record.eventId);
      await outboxRepository.updateStatus(
        tenantId,
        record.eventId,
        'DELIVERED',
        { lastError: null },
        workerId,
      );
      return {
        claimed: true,
        delivered: true,
        eventId: record.eventId,
        attemptCount: record.attemptCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryAt = new Date(Date.now() + this.retryDelayMs(record.attemptCount)).toISOString();
      await outboxRepository.updateStatus(
        tenantId,
        record.eventId,
        'RETRY_WAIT',
        { availableAt: retryAt, lastError: message, leaseOwner: null, leaseUntil: null },
        workerId,
      );
      return {
        claimed: true,
        delivered: false,
        eventId: record.eventId,
        attemptCount: record.attemptCount,
        error: message,
      };
    }
  }

  public async deliverAll(
    tenantId: string,
    workerId: string,
    maxRecords = 50,
  ): Promise<OutboxDeliveryResult[]> {
    const results: OutboxDeliveryResult[] = [];
    for (let index = 0; index < maxRecords; index++) {
      const result = await this.deliverNext(tenantId, workerId);
      results.push(result);
      if (!result.claimed) break;
    }
    return results;
  }

  private retryDelayMs(attemptCount: number): number {
    return Math.min(60_000, Math.max(1_000, 2 ** Math.min(attemptCount, 6) * 1_000));
  }

  private toEventEnvelope(record: OutboxRecord): EventEnvelope {
    return {
      eventId: record.eventId,
      eventType: record.eventType,
      eventVersion: record.eventVersion,
      occurredAt: record.occurredAt,
      tenantId: record.tenantId,
      branchId: record.branchId,
      principalId: null,
      correlationId: record.correlationId,
      causationId: record.causationId,
      source: record.source,
      payload: record.payload,
      metadata: { durableOutbox: true },
    };
  }
}

export const outboxDeliveryService = OutboxDeliveryService.getInstance();
