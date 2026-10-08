/**
 * TDBK V2 EVENT BUS ENGINE
 * Architectural Layer: LAYER 6 — WORKFLOW & EVENT ENGINE
 */

import { EventEnvelope, EventRegistration, EventHandler, EventPublishResult } from './types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { handleSubscriptionPaymentConfirmed } from '../../platform/subscription/subscriptionPaymentHandler';
import { idempotencyRepository } from '../../persistence/firestore/repositories/idempotencyRepository';
import { createHash } from 'node:crypto';
import { handleSokoniPaymentConfirmed, handleSokoniPaymentFailed } from '../../sokoni/sokoniPaymentEventHandler';
import { registerCoherenceWorkflowTriggerSubscriptions } from '../../coherence/coherenceWorkflowTriggerAdapter';
import { handlePosMpesaPaymentConfirmed, handlePosMpesaPaymentFailed } from '../../business/sales/posMpesaPaymentHandler';
import { handlePosSaleCompletedForReorder } from '../../business/inventory/reorderEngine';

class EventBusService {
  private eventRegistry: Map<string, EventRegistration> = new Map();
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private processedEventIds: Set<string> = new Set();
  private processedIdempotencyKeys: Map<string, EventEnvelope> = new Map();
  private eventHistory: EventEnvelope[] = [];

  constructor() {
    this.seedDefaultEventRegistry();
    this.subscribe('payment.confirmed.v1', handleSubscriptionPaymentConfirmed);
    this.subscribe('payment.confirmed.v1', handleSokoniPaymentConfirmed);
    this.subscribe('payment.failed.v1', handleSokoniPaymentFailed);
    this.subscribe('payment.confirmed.v1', handlePosMpesaPaymentConfirmed);
    this.subscribe('payment.failed.v1', handlePosMpesaPaymentFailed);
    this.subscribe('pos.sale.completed.v1', handlePosSaleCompletedForReorder);
    registerCoherenceWorkflowTriggerSubscriptions(this);
  }

  /**
   * Seeds default platform & runtime event contracts.
   */
  private seedDefaultEventRegistry(): void {
    const defaultTypes = [
      { eventType: 'business.created.v1', version: 'v1', description: 'Business entity provisioned' },
      { eventType: 'business.state.projected.v1', version: 'v1', description: 'Canonical DBK business state projection refreshed' },
      { eventType: 'branch.created.v1', version: 'v1', description: 'Business branch created' },
      { eventType: 'capability.enabled.v1', version: 'v1', description: 'DBK capability activated' },
      { eventType: 'capability.disabled.v1', version: 'v1', description: 'DBK capability deactivated' },
      { eventType: 'workflow.started.v1', version: 'v1', description: 'Orchestration workflow initialized' },
      { eventType: 'workflow.completed.v1', version: 'v1', description: 'Orchestration workflow completed' },
      { eventType: 'workflow.failed.v1', version: 'v1', description: 'Orchestration workflow failed' },
      { eventType: 'vertical.record.created.v1', version: 'v1', description: 'Vertical business record created' },
      { eventType: 'vertical.record.updated.v1', version: 'v1', description: 'Vertical business record updated' },
      { eventType: 'vertical.record.completed.v1', version: 'v1', description: 'Vertical business record completed' },
      { eventType: 'vertical.record.cancelled.v1', version: 'v1', description: 'Vertical business record cancelled' },
      { eventType: 'payment.initiated.v1', version: 'v1', description: 'Financial payment request initiated' },
      { eventType: 'payment.pending.v1', version: 'v1', description: 'Financial payment pending external callback' },
      { eventType: 'payment.confirmed.v1', version: 'v1', description: 'Financial payment confirmed and posted' },
      { eventType: 'school.payment.confirmed.v1', version: 'v1', description: 'School fee payment confirmed and posted' },
      { eventType: 'payment.failed.v1', version: 'v1', description: 'Financial payment failed or rejected' },
      { eventType: 'receipt.created.v1', version: 'v1', description: 'Authoritative financial receipt created' },
      { eventType: 'document.created.v1', version: 'v1', description: 'Business document generated' },
      { eventType: 'document.issued.v1', version: 'v1', description: 'Business document officially issued' },
      { eventType: 'notification.requested.v1', version: 'v1', description: 'Notification request created' },
      { eventType: 'notification.sent.v1', version: 'v1', description: 'Notification delivered' },
      { eventType: 'notification.received.v1', version: 'v1', description: 'Notification received from external provider' },
      { eventType: 'notification.failed.v1', version: 'v1', description: 'Notification delivery failed' },
      { eventType: 'external.request.created.v1', version: 'v1', description: 'Bridge external request generated' },
      { eventType: 'external.request.succeeded.v1', version: 'v1', description: 'Bridge external request succeeded' },
      { eventType: 'external.request.failed.v1', version: 'v1', description: 'Bridge external request failed' },
      // Phase 4 Platform Lifecycle Events
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
      // Phase 6 Document and AI Events
      { eventType: 'document.ingested.v1', version: 'v1', description: 'Document ingested and validated' },
      { eventType: 'ai.proposal_generated.v1', version: 'v1', description: 'AI proposal created and pending review' },
      // Role-Based Coherence & Shared Contribution Events
      { eventType: 'attendance.recorded.v1', version: 'v1', description: 'Learner attendance recorded' },
      { eventType: 'pos.sale.completed.v1', version: 'v1', description: 'Counter POS sale completed' },
      { eventType: 'inventory.reorder.triggered.v1', version: 'v1', description: 'Authoritative low-stock replenishment intent created' },
      { eventType: 'procurement.supplier.selected.v1', version: 'v1', description: 'Authoritative supplier selected for replenishment' },
      { eventType: 'procurement.purchase_order.issued.v1', version: 'v1', description: 'Authoritative purchase order issued' },
      { eventType: 'inventory.goods.received.v1', version: 'v1', description: 'Authoritative goods receipt posted to inventory' },
      { eventType: 'procurement.supplier.invoice.matched.v1', version: 'v1', description: 'Supplier invoice matched against PO and GRN' },
      { eventType: 'finance.accounts_payable.posted.v1', version: 'v1', description: 'Supplier accounts payable posted to financial ledger' },
      { eventType: 'finance.supplier.payment.instruction.created.v1', version: 'v1', description: 'Supplier payment instruction created' },
      { eventType: 'finance.supplier.payment.confirmed.v1', version: 'v1', description: 'Supplier payment confirmed and invoice settled' },
      { eventType: 'patient.triaged.v1', version: 'v1', description: 'Clinical patient triaged' },
      { eventType: 'display.broadcast.v1', version: 'v1', description: 'Digital screen broadcast notice' },
      { eventType: 'contribution.recorded.v1', version: 'v1', description: 'Shared contribution recorded' },
      { eventType: 'capability.access_requested.v1', version: 'v1', description: 'Capability access requested' },
      { eventType: 'capability.access_approved.v1', version: 'v1', description: 'Capability access approved' },
    ];

    for (const item of defaultTypes) {
      this.registerEventType(item.eventType, item.version, item.description);
    }
  }

  /**
   * Registers a new event type and version contract.
   */
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

  /**
   * Subscribes a handler function to a specific event type.
   */
  public subscribe(eventType: string, handler: EventHandler): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribes a handler from an event type.
   */
  public unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Validates event envelope structural integrity and version contract.
   */
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

    // Verify event version type before using string methods.
    if (typeof event.eventVersion !== 'string') {
      return {
        valid: false,
        error: `Invalid eventVersion type: expected string, received '${typeof event.eventVersion}'`,
      };
    }

    // Verify version contract in registry
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

    // Verify occurredAt timestamp validity
    if (isNaN(Date.parse(event.occurredAt))) {
      return { valid: false, error: `Invalid ISO timestamp for occurredAt: '${event.occurredAt}'` };
    }

    return { valid: true };
  }

  /**
   * Publishes an event envelope across the server event bus.
   * Enforces idempotency via eventId or idempotencyKey metadata.
   */
  public async publish<T = Record<string, unknown>>(
    event: EventEnvelope<T>,
    idempotencyKey?: string
  ): Promise<EventPublishResult> {
    const validation = this.validateEnvelope(event);
    if (!validation.valid) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Invalid Event Envelope: ${validation.error}`,
        400,
        event.correlationId
      );
    }

    // Durable idempotency is authoritative across process restarts. The local
    // sets remain a hot-path cache, but never replace the durable claim.
    const key = idempotencyKey || event.eventId;
    if (this.processedEventIds.has(event.eventId) || this.processedIdempotencyKeys.has(key)) {
      return {
        published: false,
        isDuplicate: true,
        eventId: event.eventId,
        subscribersNotified: 0,
        reason: 'Duplicate event detected by Idempotency Store',
      };
    }

    const durableTenantId = event.tenantId || '__system__';
    const durableKey = createHash('sha256').update(key).digest('hex');
    const durableRecord = {
      idempotencyKey: key,
      tenantId: durableTenantId,
      action: 'EVENT_BUS_PUBLISH',
      requestHash: createHash('sha256').update(JSON.stringify(event)).digest('hex'),
      status: 'IN_PROGRESS' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const claim = await idempotencyRepository.claimIdempotencyRecord(durableTenantId, durableKey, durableRecord);
    if (claim === 'COMPLETED') {
      await idempotencyRepository.completeIdempotencyRecord(durableTenantId, durableKey, { eventId: event.eventId });
    this.processedEventIds.add(event.eventId);
      this.processedIdempotencyKeys.set(key, event as unknown as EventEnvelope);
      return { published: false, isDuplicate: true, eventId: event.eventId, subscribersNotified: 0, reason: 'Duplicate event detected by durable Idempotency Store' };
    }
    if (claim === 'IN_PROGRESS') {
      return { published: false, isDuplicate: true, eventId: event.eventId, subscribersNotified: 0, reason: 'Event is already being processed by another worker' };
    }

    // Notify Subscribers
    // A publish is only considered successful after every registered
    // subscriber completes successfully. This preserves at-least-once
    // delivery semantics for durable transports such as Pub/Sub.
    const handlers = this.subscribers.get(event.eventType) || new Set();
    let notifiedCount = 0;

    for (const handler of handlers) {
      try {
        await handler(event as unknown as EventEnvelope);
        notifiedCount++;
      } catch (err: any) {
        await idempotencyRepository.failIdempotencyRecord(durableTenantId, durableKey, { error: err instanceof Error ? err.message : 'Unknown subscriber failure' });
        console.error(`Error executing subscriber for event '${event.eventType}':`, err);
        throw err;
      }
    }

    // Mark processed only after all subscribers have completed successfully.
    this.processedEventIds.add(event.eventId);
    this.processedIdempotencyKeys.set(key, event as unknown as EventEnvelope);
    this.eventHistory.push(event as unknown as EventEnvelope);

    return {
      published: true,
      isDuplicate: false,
      eventId: event.eventId,
      subscribersNotified: notifiedCount,
    };
  }

  /**
   * Convenience helper to construct and publish an event from SecurityContext.
   */
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

  /**
   * Returns whether the in-process event bus has its core event contracts and
   * subscription wiring initialized. Durable delivery still relies on the
   * Firestore-backed idempotency/outbox path.
   */
  public isReady(): boolean {
    return (
      this.eventRegistry.has('payment.confirmed.v1:v1') &&
      this.subscribers.has('payment.confirmed.v1')
    );
  }

  /**
   * Returns recorded event history, optionally filtered by tenant ID.
   */
  public getEventHistory(tenantId?: string): EventEnvelope[] {
    if (!tenantId) {
      return [...this.eventHistory];
    }
    return this.eventHistory.filter((e) => e.tenantId === tenantId || (e.payload as any)?.dbkId === tenantId);
  }

  /**
   * Checks if an event ID or idempotency key has already been processed.
   */
  public isProcessed(key: string): boolean {
    return this.processedEventIds.has(key) || this.processedIdempotencyKeys.has(key);
  }

  /**
   * Clears state stores for testing.
   */
  public clearStoreForTesting(): void {
    this.processedEventIds.clear();
    this.processedIdempotencyKeys.clear();
    this.subscribers.clear();
    this.eventRegistry.clear();
    this.eventHistory = [];
    this.seedDefaultEventRegistry();
    this.subscribe('payment.confirmed.v1', handleSubscriptionPaymentConfirmed);
    this.subscribe('payment.confirmed.v1', handleSokoniPaymentConfirmed);
    this.subscribe('payment.failed.v1', handleSokoniPaymentFailed);
    this.subscribe('payment.confirmed.v1', handlePosMpesaPaymentConfirmed);
    this.subscribe('payment.failed.v1', handlePosMpesaPaymentFailed);
    registerCoherenceWorkflowTriggerSubscriptions(this);
  }
}

export const eventBus = new EventBusService();
