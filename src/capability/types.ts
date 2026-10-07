/**
 * TDBK V2 CAPABILITY & ENTITLEMENT ENGINE TYPES
 * Architectural Layer: LEVEL 4 — CAPABILITIES & MODULES
 */

import { SectorType } from '../blueprint/types';

export type CapabilityLifecycleState =
  | 'UNAVAILABLE'
  | 'DISCOVERABLE'
  | 'ENTITLED'
  | 'CONFIGURED'
  | 'ENABLED'
  | 'DISABLED'
  | 'SUSPENDED';

export type CapabilityImplementationStatus =
  | 'DEFINED'
  | 'SPECIFIED'
  | 'MOCK'
  | 'IMPLEMENTED'
  | 'PRODUCTION_READY';

export type PlatformLifecycleStatus = 'AVAILABLE' | 'DEPRECATED' | 'SUSPENDED';

export type SubscriptionTier = 'FREE' | 'FOUNDATION' | 'GROWTH' | 'PRO' | 'ENTERPRISE';

export type EntitlementStatus = 'ENTITLED' | 'UNENTITLED' | 'UPGRADE_REQUIRED';

export type CapabilityCategory =
  | 'CORE'
  | 'CRM'
  | 'CUSTOMERS'
  | 'SUPPLIERS'
  | 'INVENTORY'
  | 'SALES'
  | 'POS'
  | 'PURCHASING'
  | 'QUOTATIONS'
  | 'FINANCE'
  | 'ACCOUNTING'
  | 'STAFF'
  | 'PAYROLL'
  | 'DOCUMENTS'
  | 'REPORTING'
  | 'BRANCHES'
  | 'COMMUNICATION'
  | 'M_PESA'
  | 'ETIMS'
  | 'WHATSAPP'
  | 'SMS'
  | 'EMAIL'
  | 'SCHOOL'
  | 'HEALTHCARE'
  | 'HOTEL'
  | 'LOGISTICS'
  | 'TRANSPORT'
  | 'FLEET'
  | 'OPERATIONS'
  | 'BEAUTY'
  | 'PROFESSIONAL_SERVICES'
  | 'AI'
  | 'ANALYTICS'
  | 'MANUFACTURING'
  | 'PROJECTS'
  | 'WORKFORCE'
  | 'COMMUNITY';

export interface ConfigurationFieldSchema {
  name: string;
  label: string;
  type: 'text' | 'secret' | 'url' | 'boolean' | 'number';
  required: boolean;
  defaultValue?: unknown;
}

export interface CapabilityConfigurationSchema {
  requiresConfiguration: boolean;
  fields?: ConfigurationFieldSchema[];
}

export interface CapabilityDefinition {
  capabilityId: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  version: string;
  supportedBlueprints: SectorType[] | ['ALL'];
  dependencies: string[]; // List of required capabilityIds
  requiredPermissions: string[];
  requiredRoles: string[];
  entitlementRequirements: {
    minimumTier: SubscriptionTier;
  };
  configurationSchema: CapabilityConfigurationSchema;
  implementationStatus: CapabilityImplementationStatus;
  lifecycleStatus: PlatformLifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DbkCapabilityRecord {
  dbkId: string;
  capabilityId: string;
  capabilityVersion: string;
  state: CapabilityLifecycleState;
  entitlement: EntitlementStatus;
  configurationState: {
    isConfigured: boolean;
    configData?: Record<string, unknown>;
    missingFields?: string[];
  };
  enabledAt?: string;
  disabledAt?: string;
  suspendedAt?: string;
  enabledBy?: string;
  updatedAt: string;
}

export interface DiscoveryResultItem {
  capability: CapabilityDefinition;
  currentState: CapabilityLifecycleState;
  entitlementStatus: EntitlementStatus;
  isEligibleForActivation: boolean;
  rejectionReason:
    | 'UPGRADE_REQUIRED'
    | 'DEPENDENCY_REQUIRED'
    | 'CONFIGURATION_REQUIRED'
    | 'BLUEPRINT_UNSUPPORTED'
    | 'SUSPENDED'
    | 'UNENTITLED'
    | null;
  missingDependencies: string[];
  explanation: string;
}

export interface DiscoverySurface {
  dbkId: string;
  blueprintId: string;
  blueprintSector: SectorType;
  subscriptionTier: SubscriptionTier;
  items: DiscoveryResultItem[];
  availableCapabilities: CapabilityDefinition[];
  evaluatedAt: string;
}

export type ActivationOutcome =
  | 'ALLOWED'
  | 'DENIED'
  | 'UPGRADE_REQUIRED'
  | 'DEPENDENCY_REQUIRED'
  | 'CONFIGURATION_REQUIRED'
  | 'BLUEPRINT_UNSUPPORTED'
  | 'SUSPENDED';

export interface ActivationDecision {
  allowed: boolean;
  outcome: ActivationOutcome;
  message: string;
  capabilityId: string;
  dbkId: string;
  missingDependencies?: string[];
  requiredTier?: SubscriptionTier;
}
