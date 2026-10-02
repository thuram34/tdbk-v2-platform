/**
 * TDBK V2 PLATFORM CONTROL & DBK PROVISIONING TYPES
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 */

import { SubscriptionTier } from '../capability/types';
import { SectorType, BlueprintTerminology } from '../blueprint/types';
import { BranchContext } from '../kernel/types';

export type DbkLifecycleStatus =
  | 'PROVISIONING'
  | 'PROVISIONING_FAILED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface DbkBranch {
  branchId: string;
  dbkId: string;
  name: string;
  type: 'HEADQUARTERS' | 'RETAIL_OUTLET' | 'WAREHOUSE' | 'CAMPUS' | 'CLINIC_BRANCH' | 'REGIONAL_OFFICE';
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  location?: {
    county?: string;
    town?: string;
    address?: string;
  };
  isHeadquarters: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleTransitionRecord {
  transitionId: string;
  fromStatus: DbkLifecycleStatus;
  toStatus: DbkLifecycleStatus;
  actorId: string;
  actorRole: string;
  timestamp: string;
  reason?: string;
  correlationId: string;
}

export interface DbkIdentity {
  dbkId?: string;
  legalName: string;
  displayName: string;
  sector: SectorType;
  blueprintId: string;
  blueprintVersion: string;
  subscriptionTier: SubscriptionTier;
  status: DbkLifecycleStatus;
  masterOwner: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  configurationVersion: number;
  workspaceVersion: number;
  branchTopology: DbkBranch[];
  lifecycleHistory: LifecycleTransitionRecord[];
  metadata: Record<string, unknown>;
}

export interface ProvisionDbkRequest {
  dbkId: string;
  legalName: string;
  displayName?: string;
  blueprintId: string;
  blueprintVersion?: string;
  subscriptionTier?: SubscriptionTier;
  primaryBranchName?: string;
  secondaryBranches?: Array<{
    branchId: string;
    name: string;
    type: DbkBranch['type'];
    location?: DbkBranch['location'];
  }>;
  customPreferences?: Record<string, unknown>;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface ProvisionDbkResult {
  success: boolean;
  dbkId: string;
  status: DbkLifecycleStatus;
  workflowId: string;
  blueprintId: string;
  blueprintVersion: string;
  subscriptionTier: SubscriptionTier;
  branches: DbkBranch[];
  workspaceVersion: number;
  isIdempotentReplay?: boolean;
  error?: string;
  correlationId: string;
}

export interface DbkWorkspaceConnection {
  bridgeId: string;
  provider: string;
  capabilityId: string;
  status: string;
  enabled: boolean;
  healthStatus: string;
  ready: boolean;
  blockers: string[];
  minimumTier: SubscriptionTier;
  entitlementStatus: string;
}

export interface DbkWorkspaceState {
  dbkId: string;
  displayName: string;
  legalName: string;
  sector: SectorType;
  blueprintId: string;
  blueprintVersion: string;
  subscriptionTier: SubscriptionTier;
  status: DbkLifecycleStatus;
  workspaceVersion: number;
  configurationVersion: number;
  activeBranches: DbkBranch[];
  currentBranchContext?: BranchContext;
  enabledCapabilities: string[];
  discoverableCapabilities: string[];
  connections: DbkWorkspaceConnection[];
  terminology: BlueprintTerminology | Record<string, string>;
  lastSyncedAt: string;
}

export interface DbkExperienceProjection {
  dbkId: string;
  displayName: string;
  sector: SectorType;
  status: DbkLifecycleStatus;
  subscriptionTier: SubscriptionTier;
  workspaceVersion: number;
  branches: Array<{
    branchId: string;
    name: string;
    isHeadquarters: boolean;
  }>;
  capabilities: {
    enabled: string[];
    discoverable: string[];
  };
  terminology: BlueprintTerminology | Record<string, string>;
  permissions: string[];
  serverAuthoritativeTimestamp: string;
}
