/**
 * TDBK V2 BLUEPRINT & BUSINESS DNA TYPES
 * Architectural Layer: LEVEL 3 — BLUEPRINT / BUSINESS DNA
 */

export type SectorType =
  | 'EDUCATION'
  | 'HARDWARE'
  | 'RETAIL'
  | 'ELECTRONICS'
  | 'LOGISTICS'
  | 'HEALTHCARE'
  | 'HOSPITALITY'
  | 'BEAUTY'
  | 'PROFESSIONAL_SERVICES'
  | 'MANUFACTURING'
  | 'CONSTRUCTION'
  | 'COMMUNITY';

export interface TerminologyMapping {
  singular: string;
  plural: string;
}

export type BlueprintTerminology = Record<string, TerminologyMapping>;

export interface BlueprintDomain {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  supportedCapabilityIds: string[];
}

export interface BlueprintCapabilityRequirement {
  id: string;
  name: string;
  category: string;
  isDefault: boolean;
  description: string;
}

export interface Blueprint {
  id: string; // e.g. 'school_v1'
  name: string; // e.g. 'School & Education Operations'
  version: string; // e.g. '1.0.0'
  sector: SectorType;
  description: string;
  terminology: BlueprintTerminology;
  domains: BlueprintDomain[];
  supportedCapabilities: BlueprintCapabilityRequirement[];
  defaultRoles: string[];
  supportedDocumentTypes: string[];
  supportedCommunicationChannels: string[];
  financialNeeds: string[];
  inventoryNeeds: string[];
  createdAt: string;
}

export interface BusinessIdentity {
  dbkId: string;
  businessName: string;
  legalName?: string;
  businessType: string;
  blueprintId: string;
  blueprintVersion: string;
  industry: string;
  country: string;
  currency: string;
  timezone: string;
  operationalStatus: 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING';
}

export interface BranchDefinition {
  branchId: string;
  name: string;
  isHeadquarters: boolean;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface BranchTopology {
  type: 'SINGLE_BRANCH' | 'MULTI_BRANCH';
  branches: BranchDefinition[];
}

export interface BusinessDNA {
  dbkId: string;
  /** Human-authored business context; authoritative Engine field. */
  businessContextNarrative?: string;
  identity: BusinessIdentity;
  scale: 'MICRO' | 'SMALL' | 'MEDIUM' | 'ENTERPRISE';
  branchTopology: BranchTopology;
  operationalPreferences: Record<string, unknown>;
  enabledCapabilityIds: string[];
  growthStage: 'STARTUP' | 'GROWTH' | 'MATURE';
  createdAt: string;
  updatedAt: string;
}

export interface CompiledDomainCapability {
  id: string;
  name: string;
  category: string;
  status: 'OPERATIONAL' | 'DISCOVERABLE';
  isEnabled: boolean;
  isDiscoverable: boolean;
}

export interface CompiledDomain {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  capabilities: CompiledDomainCapability[];
}

export interface CompiledCapabilitySummary {
  id: string;
  name: string;
  category: string;
  status: 'OPERATIONAL' | 'DISCOVERABLE';
}

export interface CompiledWorkspace {
  dbkId: string;
  businessName: string;
  blueprint: {
    id: string;
    version: string;
    name: string;
    sector: SectorType;
  };
  terminology: BlueprintTerminology;
  domains: CompiledDomain[];
  enabledCapabilities: CompiledCapabilitySummary[];
  discoverableCapabilities: CompiledCapabilitySummary[];
  branchSummary: {
    totalBranches: number;
    hqBranchId: string;
    type: 'SINGLE_BRANCH' | 'MULTI_BRANCH';
    branches: Array<{ branchId: string; name: string; isHQ: boolean }>;
  };
  defaultRoles: string[];
  compiledAt: string;
  hash: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
