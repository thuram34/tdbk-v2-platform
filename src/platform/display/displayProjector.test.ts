import { describe, expect, it, beforeEach } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { eventBus } from '../../orchestration/events/eventBus';
import { displayService } from './displayService';
import type { DisplayNode } from './types';

describe('display event projector', () => {
  beforeEach(() => firestoreClient.clearAllForTesting());

  it('projects a tenant business event into content and a targeted command', async () => {
    const node: DisplayNode = {
      displayId: 'display_projection_1',
      tenantId: 'tenant_projection',
      siteId: 'site_1',
      roomId: 'classroom-6a',
      name: 'Classroom 6A',
      nodeType: 'BROWSER_KIOSK',
      capabilities: ['SIGNAGE', 'ANNOUNCEMENTS', 'SCHEDULES', 'MEDIA', 'EMERGENCY_ALERTS'],
      status: 'ONLINE',
      lastSeenAt: null,
      appVersion: null,
      networkQuality: 'GOOD',
      currentContentId: null,
      currentScheduleId: null,
      offlineCacheVersion: 0,
    };
    await firestoreClient.set('/tenants/tenant_projection/displayNodes/display_projection_1', node);

    const result = await eventBus.publish({
      eventId: 'evt_projection_test_1',
      eventType: 'display.broadcast.v1',
      eventVersion: 'v1',
      occurredAt: '2026-09-18T12:00:00.000Z',
      tenantId: 'tenant_projection',
      branchId: null,
      principalId: 'SYSTEM',
      correlationId: 'corr_projection_test_1',
      causationId: null,
      source: 'TEST',
      payload: {
        dbkId: 'tenant_projection',
        title: 'School Announcement',
        primaryMessage: 'Assembly starts at 10:00.',
        targetRoomIds: ['classroom-6a'],
      },
      metadata: {},
    });

    expect(result.published).toBe(true);

    const content = await firestoreClient.get('/tenants/tenant_projection/displayContent/event_9d3c5e0f5c5a1f0f5f3c0f5e');
    expect(content).not.toBeNull();

    const plan = await displayService.sync('tenant_projection', 'display_projection_1');
    expect(plan.content.some((item) => item.title === 'School Announcement')).toBe(true);
    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0].type).toBe('PLAY_CONTENT');
    expect(plan.commands[0].status).toBe('DELIVERED');
  });
});
