/** TDBK V2 — CANONICAL BUSINESS STATE / DIGITAL TWIN CONTRACT */

import { DbkBranch, DbkIdentity, DbkWorkspaceState } from '../types';

export interface BusinessStateSnapshot {
  snapshotId: string;
  tenantId: string;
  dbkId: string;
  version: number;
  generatedAt: string;
  source: 'TDBK_BUSINESS_STATE_ENGINE';
  identity: DbkIdentity;
  branches: DbkBranch[];
  workspace: DbkWorkspaceState;
  enabledCapabilities: string[];
  discoverableCapabilities: string[];
  businessDna: unknown | null;
  health: {
    lifecycleStatus: DbkIdentity['status'];
    activeBranchCount: number;
    enabledCapabilityCount: number;
    configurationVersion: number;
    workspaceVersion: number;
  };
  metadata: Record<string, unknown>;
}
