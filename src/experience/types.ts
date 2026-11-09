/**
 * TDBK V2 EXPERIENCE LAYER & DYNAMIC VIEW TYPES
 * Architectural Layer: LAYER 8 & 9 — EXPERIENCE SERVICES, UI ENGINE & DESIGN SYSTEM
 * Implements Deliverables 18, 19, 20 (Role-Based Experience Resolver, Design System, Dynamic Workspace Projection)
 */

import { SectorType, BlueprintTerminology } from '../blueprint/types';
import { SubscriptionTier } from '../capability/types';
import { DbkLifecycleStatus, DbkBranch, DbkProvisioningStage, DbkShellReadiness } from '../platform/types';
import { Principal, SecurityContext } from '../kernel/types';

export type ExperienceViewType =
  | 'DASHBOARD'
  | 'ENTITY_LIST'
  | 'ENTITY_DETAIL'
  | 'OPERATIONAL_FLOW'
  | 'DISCOVERY'
  | 'SETTINGS'
  | 'REPORTS'
  | 'CUSTOM_CLASSROOM'
  | 'EXPERIENCE_STUDIO'
  | 'CUSTOM_QUESTIONNAIRE'
  | 'CUSTOM_WORKFLOW';

export type ExperienceNavCategory =
  | 'OVERVIEW'
  | 'CORE_OPERATIONS'
  | 'RECORDS'
  | 'FINANCE'
  | 'OPERATIONS'
  | 'DISCOVERY'
  | 'SETTINGS';

export interface ExperienceNavItem {
  id: string;
  label: string;
  iconName: string;
  category: ExperienceNavCategory;
  capabilityId?: string;
  customTargetId?: string;
  route: string;
  viewType: ExperienceViewType;
  displayOrder: number;
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'info' | 'error';
  requiredRoles?: string[];
  requiredPermissions?: string[];
  isDefault?: boolean;
}

export type WidgetType =
  | 'METRIC_CARD'
  | 'ACTIVITY_FEED'
  | 'QUEUE_LIST'
  | 'STATUS_CARD'
  | 'ACTION_GRID'
  | 'ALERT_BANNER'
  | 'FINANCIAL_SUMMARY'
  | 'ALERT_FEED';

export interface ExperienceWidget {
  id: string;
  title: string;
  widgetType: WidgetType;
  capabilityId?: string;
  span?: 1 | 2 | 3 | 4; // grid column span
  data: {
    primaryValue?: string | number;
    secondaryValue?: string;
    trend?: { direction: 'UP' | 'DOWN' | 'NEUTRAL'; percentage: number; label: string };
    items?: Array<{
      id?: string;
      title?: string;
      subtitle?: string;
      status?: string;
      timestamp?: string;
      amount?: string;
      badgeVariant?: string;
      sku?: string;
      name?: string;
      qty?: number;
      min?: number;
      patient?: string;
      priority?: string;
      waitTime?: string;
    }>;
    statusSummary?: {
      active: number;
      pending: number;
      flagged: number;
    };
    alert?: {
      level: 'INFO' | 'WARNING' | 'CRITICAL';
      message: string;
    };
  };
  actions?: Array<{
    id: string;
    label: string;
    command: string;
    iconName?: string;
  }>;
}

export interface ExperienceEntityField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'status' | 'badge' | 'boolean';
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface ExperienceEntityRecord {
  id: string;
  entityType: string;
  primaryIdentifier: string;
  secondaryIdentifier?: string;
  status: string;
  branchId?: string;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceEntitySchema {
  entityType: string;
  singularName: string;
  pluralName: string;
  capabilityId: string;
  fields: ExperienceEntityField[];
  actions: Array<{
    id: string;
    label: string;
    variant: 'primary' | 'secondary' | 'danger';
    command: string;
    requiredPermissions?: string[];
  }>;
}

export interface ExperienceCapabilityViewDef {
  capabilityId: string;
  defaultNavLabel: string;
  category: ExperienceNavCategory;
  iconName: string;
  viewType: ExperienceViewType;
  displayOrder: number;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  terminologyKey?: string; // e.g. 'customer', 'product', 'transaction'
  dashboardWidget?: {
    widgetId: string;
    title: string;
    widgetType: WidgetType;
    span?: 1 | 2 | 3 | 4;
  };
  entitySchema?: ExperienceEntityField[];
}

export interface ExperienceDiscoveryItem {
  capabilityId: string;
  name: string;
  category: string;
  description: string;
  minimumTier: SubscriptionTier;
  isEntitled: boolean;
  isEnabled: boolean;
  canAccess?: boolean;
  status: 'OPERATIONAL' | 'DISCOVERABLE' | 'UPGRADE_REQUIRED' | 'CONFIGURATION_REQUIRED' | 'SUSPENDED';
  iconName: string;
  requiredRoles?: string[];
  requiredPermissions?: string[];
}

import type { ExperienceCustomization } from './customization/types';

export interface DbkExperienceResolved {
  customization?: ExperienceCustomization;
  dbkId: string;
  legalName: string;
  displayName: string;
  sector: SectorType;
  status: DbkLifecycleStatus;
  provisioningStage?: DbkProvisioningStage;
  shellReadiness?: DbkShellReadiness;
  subscriptionTier: SubscriptionTier;
  workspaceVersion: number;
  configurationVersion: number;
  activeBranch: {
    branchId: string;
    name: string;
    isHeadquarters: boolean;
  };
  availableBranches: Array<{
    branchId: string;
    name: string;
    isHeadquarters: boolean;
  }>;
  terminology: BlueprintTerminology | Record<string, string>;
  navigation: ExperienceNavItem[];
  dashboardWidgets: ExperienceWidget[];
  discoveryItems: ExperienceDiscoveryItem[];
  connections: Array<{
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
  }>;
  currentPrincipal: {
    userId: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
    isMaster: boolean;
  };
  operationalState: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'PROVISIONING' | 'UNAUTHORIZED';
  serverTimestamp: string;
}

export interface ExperienceCommandRequest {
  commandType:
    | 'SWITCH_BRANCH'
    | 'EXECUTE_SALE'
  | 'INVOKE_ACTION'
    | 'SUBMIT_ENTITY'
    | 'SUBMIT_QUESTIONNAIRE'
    | 'START_WORKFLOW'
    | 'ADVANCE_WORKFLOW'
    | 'ENABLE_CAPABILITY'
    | 'CONFIGURE_CAPABILITY'
    | 'SUBMIT_SUPPLIER_INVOICE'
    | 'APPROVE_SUPPLIER_INVOICE'
    | 'RECORD_STOCK_MOVEMENT';
  targetDbkId: string;
  payload: Record<string, unknown>;
}

export interface ExperienceCommandResponse {
  success: boolean;
  commandType: string;
  targetDbkId: string;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
  updatedResolvedExperience?: DbkExperienceResolved;
  serverTimestamp: string;
}
