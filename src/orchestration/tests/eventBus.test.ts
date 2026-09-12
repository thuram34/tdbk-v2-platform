import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '../events/eventBus';
import type { EventEnvelope } from '../events/types';

describe('TDBK V2 — EventBus Handler Failure Semantics', () => {
  beforeEach(() => {
    eventBus.clearStoreForTesting();
    eventBus.registerEventType(
      'business.created',
      'v1',
      'EventBus handler failure regression test'
    );
  });

  const makeEvent = (eventId: string): EventEnvelope => ({
    eventId,
    eventType: 'business.created',
    eventVersion: 'v1',
    occurredAt: new Date().toISOString(),
    tenantId: 'tenant_eventbus_test',
    branchId: 'branch_hq',
    principalId: 'usr_test',
    correlationId: `corr_${eventId}`,
    causationId: null,
    source: 'eventbus-test',
    payload: { test: true },
    metadata: {},
  });

  it('rejects malformed eventVersion values with a validation error', async () => {
    const event = makeEvent('eventbus_invalid_version_01');

    const malformedEvent = {
      ...event,
      eventVersion: 1 as unknown as string,
    };

    await expect(eventBus.publish(malformedEvent)).rejects.toThrow(
      "Invalid eventVersion type: expected string, received 'number'"
    );

    expect(eventBus.isProcessed(event.eventId)).toBe(false);
  });

  it('marks an event processed only after all subscribers succeed', async () => {
    const handlerA = vi.fn(async () => {});
    const handlerB = vi.fn(async () => {});

    eventBus.subscribe('business.created', handlerA);
    eventBus.subscribe('business.created', handlerB);

    const event = makeEvent('eventbus_success_01');

    const result = await eventBus.publish(event);

    expect(result.published).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.subscribersNotified).toBe(2);
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(eventBus.isProcessed(event.eventId)).toBe(true);
  });

  it('does not mark an event processed when a subscriber fails', async () => {
    const successfulHandler = vi.fn(async () => {});
    const failingHandler = vi.fn(async () => {
      throw new Error('Simulated subscriber failure');
    });

    eventBus.subscribe('business.created', successfulHandler);
    eventBus.subscribe('business.created', failingHandler);

    const event = makeEvent('eventbus_failure_01');

    await expect(eventBus.publish(event)).rejects.toThrow(
      'Simulated subscriber failure'
    );

    expect(successfulHandler).toHaveBeenCalledTimes(1);
    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(eventBus.isProcessed(event.eventId)).toBe(false);
  });

  it('allows a failed event to be retried after the failing subscriber recovers', async () => {
    let shouldFail = true;

    const retryableHandler = vi.fn(async () => {
      if (shouldFail) {
        throw new Error('Temporary subscriber failure');
      }
    });

    eventBus.subscribe('business.created', retryableHandler);

    const event = makeEvent('eventbus_retry_01');

    await expect(eventBus.publish(event)).rejects.toThrow(
      'Temporary subscriber failure'
    );

    expect(eventBus.isProcessed(event.eventId)).toBe(false);

    shouldFail = false;

    const retryResult = await eventBus.publish(event);

    expect(retryResult.published).toBe(true);
    expect(retryResult.isDuplicate).toBe(false);
    expect(retryResult.subscribersNotified).toBe(1);
    expect(retryableHandler).toHaveBeenCalledTimes(2);
    expect(eventBus.isProcessed(event.eventId)).toBe(true);
  });
});
