/**
 * TDBK V2 — BRIDGE EVENT DELIVERY BOUNDARY
 *
 * Production bridge events are durably enqueued before the in-process event
 * bus is notified. This prevents a process restart from losing a provider
 * result after the bridge has reported success.
 */

import { EventEnvelope } from '../events/types';
import { eventBus } from '../events/eventBus';
import { outboxEngine } from '../outbox/outboxEngine';

export async function publishBridgeEvent(event: EventEnvelope): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    if (!event.tenantId) {
      throw new Error('Bridge events require a tenantId in production.');
    }
    await outboxEngine.enqueueEvent(event.tenantId, event, undefined, event.principalId || 'sys_internal');
  }

  await eventBus.publish(event);
}
