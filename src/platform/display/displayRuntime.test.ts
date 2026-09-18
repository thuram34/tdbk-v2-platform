import { describe, expect, it, vi } from 'vitest';
import { BrowserDisplayRuntime, createHeartbeat } from './displayRuntime';
import type { DisplayNode, DisplaySyncPlan } from './types';

const node: DisplayNode = {
  displayId: 'display-001',
  tenantId: 'school-1',
  siteId: 'main',
  roomId: 'hall',
  name: 'Main Hall',
  nodeType: 'BROWSER_KIOSK',
  capabilities: ['SIGNAGE', 'MEDIA', 'ANNOUNCEMENTS'],
  status: 'ONLINE',
  lastSeenAt: null,
  appVersion: '1.0.0',
  networkQuality: 'GOOD',
  currentContentId: null,
  currentScheduleId: null,
  offlineCacheVersion: 4,
};

const plan: DisplaySyncPlan = {
  displayId: node.displayId,
  generatedAt: new Date().toISOString(),
  content: [],
  schedules: [],
  commands: [],
  cacheVersion: 5,
};

describe('BrowserDisplayRuntime', () => {
  it('creates a heartbeat payload', () => {
    const heartbeat = createHeartbeat(node);
    expect(heartbeat.displayId).toBe('display-001');
    expect(heartbeat.cacheVersion).toBe(4);
  });

  it('retains the last sync plan when the control plane is temporarily unavailable', async () => {
    const sync = vi.fn()
      .mockResolvedValueOnce(plan)
      .mockRejectedValueOnce(new Error('offline'));

    const runtime = new BrowserDisplayRuntime(node, {
      sync,
      heartbeat: vi.fn(),
      command: vi.fn(),
    });

    expect(await runtime.sync()).toEqual(plan);
    expect(await runtime.sync()).toEqual(plan);
  });
});
