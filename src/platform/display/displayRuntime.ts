import type { DisplayCommand, DisplayNode, DisplaySyncPlan } from './types';

export interface DisplayHeartbeat {
  displayId: string;
  tenantId: string;
  status: DisplayNode['status'];
  networkQuality: DisplayNode['networkQuality'];
  appVersion: string;
  cacheVersion: number;
  currentContentId: string | null;
  reportedAt: string;
}

export interface DisplayRuntimeClient {
  heartbeat(input: DisplayHeartbeat): Promise<unknown>;
  sync(displayId: string): Promise<DisplaySyncPlan>;
  command(displayId: string, command: DisplayCommand): Promise<unknown>;
}

export function createHeartbeat(
  node: DisplayNode,
  status: DisplayNode['status'] = node.status,
): DisplayHeartbeat {
  return {
    displayId: node.displayId,
    tenantId: node.tenantId,
    status,
    networkQuality: node.networkQuality,
    appVersion: node.appVersion ?? 'unknown',
    cacheVersion: node.offlineCacheVersion,
    currentContentId: node.currentContentId,
    reportedAt: new Date().toISOString(),
  };
}

export class BrowserDisplayRuntime {
  private cache: DisplaySyncPlan | null = null;

  constructor(
    private readonly node: DisplayNode,
    private readonly client: DisplayRuntimeClient,
  ) {}

  async sync(): Promise<DisplaySyncPlan> {
    try {
      const plan = await this.client.sync(this.node.displayId);
      this.cache = plan;
      return plan;
    } catch (error) {
      if (this.cache) return this.cache;
      throw error;
    }
  }

  getCachedPlan(): DisplaySyncPlan | null {
    return this.cache;
  }

  async sendCommand(command: DisplayCommand): Promise<unknown> {
    return this.client.command(this.node.displayId, command);
  }

  async reportHeartbeat(): Promise<unknown> {
    return this.client.heartbeat(createHeartbeat(this.node));
  }
}
