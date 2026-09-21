import { buildSyncPlan } from './displayEngine';
import type { DisplayCommand, DisplayEngineSnapshot, DisplayHeartbeat, DisplayNode, DisplaySyncPlan } from './types';
export interface DisplayRegistry {
  getNode(tenantId: string, displayId: string): Promise<DisplayNode | null>;
  upsertHeartbeat(heartbeat: DisplayHeartbeat): Promise<void>;
}
export interface DisplayControlPlane {
  sync(tenantId: string, displayId: string): Promise<DisplaySyncPlan>;
  executeCommand(tenantId: string, displayId: string, command: DisplayCommand): Promise<DisplayCommand>;
}
export class InMemoryDisplayControlPlane implements DisplayControlPlane {
  constructor(private readonly registry: Map<string, DisplayNode>,
    private readonly snapshotFactory: (tenantId: string) => DisplayEngineSnapshot) {}
  async sync(tenantId: string, displayId: string): Promise<DisplaySyncPlan> {
    const node = this.registry.get(displayId);
    if (!node || node.tenantId !== tenantId) throw new Error('DISPLAY_NOT_FOUND');
    return buildSyncPlan(node, this.snapshotFactory(tenantId));
  }
  async executeCommand(tenantId: string, displayId: string, command: DisplayCommand): Promise<DisplayCommand> {
    const node = this.registry.get(displayId);
    if (!node || node.tenantId !== tenantId) throw new Error('DISPLAY_NOT_FOUND');
    if (command.tenantId !== tenantId || command.displayId !== displayId) throw new Error('DISPLAY_COMMAND_SCOPE_MISMATCH');
    return command;
  }
}
