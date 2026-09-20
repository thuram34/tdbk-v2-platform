/**
 * TDBK V2 EVENT BUS ENGINE
 * Architectural Layer: LAYER 6 — WORKFLOW & EVENT ENGINE
 */

import { EventEnvelope, EventRegistration, EventHandler, EventPublishResult } from './types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { handleSubscriptionPaymentConfirmed } from '../../platform/subscription/subscriptionPaymentHandler';
import { eventProcessingRepository } from '../../persistence/firestore/repositories/eventProcessingRepository';

class EventBusService {
  private eventRegistry: Map<string, EventRegistration> = new Map();
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private processedEventIds: Set<string> = new Set();
  private processedIdempotencyKeys: Map<string, EventEnvelope> = new Map();
  private eventHistory: EventEnvelope[] = [];

  constructor() {
    this.seedDefaultEventRegistry();
    this.subscribe('payment.confirmed.v1', handleSubscriptionPaymentConfirmed);
  }

  /**
   * Seeds default platform & runtime event contracts.
   */
  private seedDefaultEventRegistry(): void {
    const defaultTypes = [
      { eventType: 'business.created.v1', version: 'v1', description: 'Business entity provisioned' },
      { eventType: 'branch.created.v1', version: 'v1', description: 'Business branch created' },
      { eventType: 'capability.enabled.v1', version: 'v1', description: 'DBK capability activated' },
      { eventType: 'capability.disabled.v1', version: 'v1', description: 'DBK capability deactivated' },
      { eventType: 'workflow.started.v1', version: 'v1', description: 'Orchestration workflow initialized' },
      { eventType: 'workflow.completed.v1', version: 'v1', description: 'Orchestration workflow completed' },
      { eventType: 'workflow.failed.v1', version: 'v1', description: 'Orchestration workflow failed' },
      { eventType: 'payment.initiated.v1', version: 'v1', description: 'Financial payment request initiated' },
      { eventType: 'payment.pending.v1', version: 'v1', description: 'Financial payment pending external callback' },
      { eventType: 'payment.confirmed.v1', version: 'v1', description: 'Financial payment confirmed and posted' },
      { eventType: 'payment.posted.v1', version: 'v1', description: 'Financial payment posted to the authoritative ledger' },
      { eventType: 'payment.reversed.v1', version: 'v1', description: 'Financial payment reversed by authoritative counter-entry' },
      { eventType: 'payment.failed.v1', version: 'v1', description: 'Financial payment failed or rejected' },
      { eventType: 'receipt.created.v1', version: 'v1', description: 'Authoritative financial receipt created' },
      { eventType: 'document.created.v1', version: 'v1', description: 'Business document generated' },
      { eventType: 'document.issued.v1', version: 'v1', description: 'Business document officially issued' },
      { eventType: 'notification.requested.v1', version: 'v1', description: 'Notification request created' },
      { eventType: 'notification.sent.v1', version: 'v1', description: 'Notification delivered' },
      { eventType: 'notification.failed.v1', version: 'v1', description: 'Notification delivery failed' },
      { eventType: 'external.request.created.v1', version: 'v1', description: 'Bridge external request generated' },
      { eventType: 'external.request.succeeded.v1', version: 'v1', description: 'Bridge external request succeeded' },
      { eventType: 'external.request.failed.v1', version: 'v1', description: 'Bridge external request failed' },
      { eventType: 'dbk.provisioning_requested.v1', version: 'v1', description: 'DBK provisioning requested' },
      { eventType: 'dbk.provisioning_requested.v1', version: 'v1.0', description: 'DBK provisioning requested v1.0' },
      { eventType: 'dbk.provisioning_started.v1', version: 'v1', description: 'DBK provisioning started' },
      { eventType: 'dbk.provisioning_started.v1', version: 'v1.0', description: 'DBK provisioning started v1.0' },
      { eventType: 'dbk.blueprint_bound.v1', version: 'v1', description: 'DBK blueprint bound' },
      { eventType: 'dbk.dna_initialized.v1', version: 'v1', description: 'DBK DNA initialized' },
      { eventType: 'dbk.entitlements_assigned.v1', version: 'v1', description: 'DBK entitlements assigned' },
      { eventType: 'dbk.capabilities_initialized.v1', version: 'v1', description: 'DBK capabilities initialized' },
      { eventType: 'dbk.branches_initialized.v1', version: 'v1', description: 'DBK branches initialized' },
      { eventType: 'dbk.provisioning_completed.v1', version: 'v1', description: 'DBK provisioning completed' },
      { eventType: 'dbk.provisioning_completed.v1', version: 'v1.0', description: 'DBK provisioning completed v1.0' },
      { eventType: 'dbk.provisioning_failed.v1', version: 'v1', description: 'DBK provisioning failed' },
      { eventType: 'dbk.provisioning_failed.v1', version: 'v1.0', description: 'DBK provisioning failed v1.0' },
      { eventType: 'dbk.activated.v1', version: 'v1', description: 'DBK activated' },
      { eventType: 'dbk.suspended.v1', version: 'v1', description: 'DBK suspended' },
      { eventType: 'dbk.reactivated.v1', version: 'v1', description: 'DBK reactivated' },
      { eventType: 'dbk.archived.v1', version: 'v1', description: 'DBK archived' },
      { eventType: 'dbk.restored.v1', version: 'v1', description: 'DBK restored' },
      { eventType: 'document.ingested.v1', version: 'v1', description: 'Document ingested and validated' },
      { eventType: 'ai.proposal_generated.v1', version: 'v1', description: 'AI proposal created and pending review' },
      { eventType: 'attendance.recorded.v1', version: 'v1', description: 'Learner attendance recorded' },
      { eventType: 'pos.sale.completed.v1', version: 'v1', description: 'Counter POS sale completed' },
      { eventType: 'patient.triaged.v1', version: 'v1', description: 'Clinical patient triaged' },
      { eventType: 'display.broadcast.v1', version: 'v1', description: 'Digital screen broadcast notice' },
      { eventType: 'contribution.recorded.v1', version: 'v1', description: 'Shared contribution recorded' },
      { eventType: 'capability.access_requested.v1', version: 'v1', description: 'Capability access requested' },
      { eventType: 'capability.access_approved.v1', version: 'v1', description: 'Capability access approved' },
      { eventType: 'business.state.projected.v1', version: 'v1', description: 'Authoritative business state projection updated' },
    ];

    for (const item of defaultTypes) {
      this.registerEventType(item.eventType, item.version, item.description);
    }
  }

  public registerEventType(eventType: string, version: string, description: string): void {
    const key = `${eventType}:${version}`;
    this.eventRegistry.set(key, {
      eventType,
      version,
      description,
      schemaValidationRequired: true,
      registeredAt: new Date().toISOString(),
    });
  }

  public subscribe(eventType: string, handler: EventHandler): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
  }

  public unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  public validateEnvelope(event: any): { valid: boolean; error?: string } {
    if (!event || typeof event !== 'object') {
      return { valid: false, error: 'Event object must be a non-null object' };
    }

    const requiredFields = [
      'eventId',
      'eventType',
      'eventVersion',
      'occurredAt',
      'correlationId',
      'source',
      'payload',
    ];

    for (const field of requiredFields) {
      if (event[field] === undefined || event[field] === null || event[field] === '') {
        return { valid: false, error: `Missing required event envelope field: '${field}'` };
      }
    }

    if (typeof event.eventVersion !== 'string') {
      return {
        valid: false,
        error: `Invalid eventVersion type: expected string, received '${typeof event.eventVersion}'`,
      };
    }

    const registryKey = `${event.eventType}:${event.eventVersion}`;
    const baseVersion = event.eventVersion.startsWith('v') ? event.eventVersion.substring(1) : event.eventVersion;
    const vPrefixed = `v${baseVersion}`;
    const vMajor = vPrefixed.split('.')[0];

    const hasContract =
      this.eventRegistry.has(registryKey) ||
      this.eventRegistry.has(`${event.eventType}:${vPrefixed}`) ||
      this.eventRegistry.has(`${event.eventType}:${vMajor}`) ||
      this.eventRegistry.has(`${event.eventType}:v1`) ||
      this.eventRegistry.has(`${event.eventType}:v1.0`);

    if (!hasContract) {
      return {
        valid: false,
        error: `Unrecognized event contract or version: '${event.eventType}' version '${event.eventVersion}'`,
      };
    }

    if (isNaN(Date.parse(event.occurredAt))) {
      return { valid: false, error: `Invalid ISO timestamp for occurredAt: '${event.occurredAt}'` };
    }

    return { valid: true };
  }

  /**
   * Publishes an event envelope across the server event bus.
   *
   * When the event belongs to a tenant, idempotency is durable in Firestore:
   * a PROCESSING lease prevents concurrent delivery and a COMPLETED record
   * suppresses duplicate delivery after process restart.
   */
  public async publish<T = Record<string, unknown>>(
    event: EventEnvelope<T>,
    idempotencyKey?: string,
  ): Promise<EventPublishResult> {
    const validation = this.validateEnvelope(event);
    if (!validation.valid) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Invalid Event Envelope: ${validation.error}`,
        400,
        event.correlationId,
      );
    }

    const key = idempotencyKey || event.eventId;

    // Fast-path process-local idempotency remains useful, but is not the
    // authoritative source of truth for tenant-scoped durable events.
    if (this.processedEventIds.has(event.eventId) || this.processedIdempotencyKeys.has(key)) {
      return {
        published: false,
        isDuplicate: true,
        eventId: event.eventId,
        subscribersNotified: 0,
        reason: 'Duplicate event detected by Idempotency Store',
      };
    }

    const tenantId = event.tenantId || (event.payload as any)?.dbkId || null;
    const durableWorkerId = `event-bus-${event.eventId}-${Math.random().toString(36).substring(2, 10)}`;
    let durableClaimed = false;

    if (tenantId) {
      const claim = await eventProcessingRepository.claim(
        tenantId,
        event.eventId,
        key,
        durableWorkerId,
      );

      if (!claim.claimed) {
        return {
          published: false,
          isDuplicate: true,
          eventId: event.eventId,
          subscribersNotified: 0,
          reason: claim.record?.status === 'COMPLETED'
            ? 'Duplicate event suppressed by durable idempotency store'
            : 'Event delivery is already in progress',
        };
      }

      durableClaimed = true;
    }

    const handlers = this.subscribers.get(event.eventType) || new Set();
    let notifiedCount = 0;

    try {
      for (const handler of handlers) {
        await handler(event as unknown as EventEnvelope);
        notifiedCount++;
      }

      if (durableClaimed && tenantId) {
        await eventProcessingRepository.complete(tenantId, event.eventId, durableWorkerId);
      }

      this.processedEventIds.add(event.eventId);
      this.processedIdempotencyKeys.set(key, event as unknown as EventEnvelope);
      this.eventHistory.push(event as unknown as EventEnvelope);

      return {
        published: true,
        isDuplicate: false,
        eventId: event.eventId,
        subscribersNotified: notifiedCount,
      };
    } catch (err: any) {
      if (durableClaimed && tenantId) {
        await eventProcessingRepository.release(tenantId, event.eventId, durableWorkerId);
      }
      console.error(`Error executing subscriber for event '${event.eventType}':`, err);
      throw err;
    }
  }

  public async publishEvent<T = Record<string, unknown>>(
    context: { requestId?: string; correlationId?: string; principal?: { id: string; tenantId?: string | null; branchId?: string | null }; tenantContext?: { tenantId: string }; branchContext?: { branchId: string } },
    eventType: string,
    payload: T,
    eventVersion: string = 'v1'
  ): Promise<EventPublishResult> {
    const tenantId = (payload as any)?.dbkId || context.tenantContext?.tenantId || context.principal?.tenantId || null;
    const branchId = (payload as any)?.branchId || context.branchContext?.branchId || context.principal?.branchId || null;
    const event: EventEnvelope<T> = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      eventType,
      eventVersion,
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId || `corr_${Date.now()}`,
      causationId: context.requestId || null,
      tenantId,
      branchId,
      source: 'TDBK_PLATFORM_ENGINE',
      principalId: context.principal?.id || 'SYSTEM',
      payload,
      metadata: {},
    };

    return this.publish(event);
  }

  public getEventHistory(tenantId?: string): EventEnvelope[] {
    if (!tenantId) {
      return [...this.eventHistory];
    }
    return this.eventHistory.filter((e) => e.tenantId === tenantId || (e.payload as any)?.dbkId === tenantId);
  }

  public isProcessed(key: string): boolean {
    return this.processedEventIds.has(key) || this.processedIdempotencyKeys.has(key);
  }

  public clearStoreForTesting(): void {
    this.processedEventIds.clear();
    this.processedIdempotencyKeys.clear();
    this.subscribers.clear();
    this.eventRegistry.clear();
    this.eventHistory = [];
    this.seedDefaultEventRegistry();
  }
}

export const eventBus = new EventBusService();
