/**
/**
 * TDBK V2 EVENT BUS PRIMITIVES & TYPE DEFINITIONS
 * Architectural Layer: LAYER 6 — WORKFLOW & EVENT ENGINE
 */

export interface EventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  eventVersion: string;
  occurredAt: string;
  tenantId: string | null;
  branchId: string | null;
  principalId: string | null;
  correlationId: string;
  causationId: string | null;
  source: string;
  payload: T;
  metadata: Record<string, unknown>;
}

export interface EventRegistration {
  eventType: string;
  version: string;
  description: string;
  schemaValidationRequired: boolean;
  registeredAt: string;
}

export type EventHandler<T = Record<string, unknown>> = (
  event: EventEnvelope<T>
) => Promise<void> | void;

export interface EventPublishResult {
  published: boolean;
  isDuplicate: boolean;
  eventId: string;
  subscribersNotified: number;
  reason?: string;
}
