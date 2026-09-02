/**
 * TDBK V2 ROLE-BASED COHERENCE ENGINE — DOMAIN MODELS & CONTRACTS
 * 
 * CORE PRINCIPLE:
 * ONE BUSINESS. ONE SHARED REALITY. DIFFERENT ROLES. DIFFERENT EXPERIENCES.
 * 
 * ARCHITECTURAL MODEL:
 * TDBK CORE / KERNEL
 *         ↓
 * CAPABILITY LAYER
 *         ↓
 * MODULES
 *         ↓
 * WORKFLOWS
 *         ↓
 * ROLE-BASED EXPERIENCES
 *         ↓
 * WEB / WORKSPACE / WHATSAPP / MOBILE / DISPLAY / API
 */

import { SectorType } from '../blueprint/types';
import { SubscriptionTier } from '../capability/types';
import { DbkLifecycleStatus } from '../platform/types';
import { ExperienceWidget, ExperienceNavItem } from '../experience/types';

// -------------------------------------------------------------
// 1. SPACE & MEMBERSHIP CONTEXT
// -------------------------------------------------------------

export type SpaceType = 'HEADQUARTERS' | 'BRANCH' | 'CAMPUS' | 'STORE_OUTLET' | 'CLINIC_CENTER' | 'DISTRIBUTION_HUB';

export interface BusinessSpace {
  spaceId: string;
  tenantId: string; // Parent organization / DBK ID
  organizationName: string;
  spaceName: string;
  spaceType: SpaceType;
  sector: SectorType;
  isHeadquarters: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  address?: string;
  city?: string;
}

export interface SpaceMembership {
  membershipId: string;
  userId: string;
  spaceId: string;
  tenantId: string;
  role: string; // The specific role held in THIS space
  roleTitle: string; // Human-friendly display title (e.g. "School Principal", "Senior Teacher", "Finance Viewer")
  status: 'ACTIVE' | 'PENDING_INVITE' | 'SUSPENDED';
  joinedAt: string;
  permissions: string[];
  department?: string;
}

// -------------------------------------------------------------
// 2. FORMAL CAPABILITY LAYER
// -------------------------------------------------------------

export type BusinessCapabilityCategory =
  | 'PAYMENTS'
  | 'COMMUNICATION'
  | 'INVENTORY'
  | 'SCHEDULING'
  | 'ATTENDANCE'
  | 'DOCUMENT_MANAGEMENT'
  | 'DIGITAL_DISPLAY'
  | 'ANALYTICS'
  | 'AI_INTELLIGENCE'
  | 'CRM'
  | 'IDENTITY_ACCESS'
  | 'NOTIFICATIONS'
  | 'STATUTORY_TAX'
  | 'CORE_OPERATIONS';

export interface FormalCapabilityDefinition {
  capabilityId: string;
  name: string;
  category: BusinessCapabilityCategory;
  description: string;
  businessPurpose: string; // WHAT the business is able to do
  minimumTier: SubscriptionTier;
  applicableSectors: SectorType[] | ['ALL'];
  maturityLevels: {
    level: 1 | 2 | 3 | 4;
    name: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'OPTIMIZED';
    features: string[];
  }[];
  statutoryRequired?: boolean; // e.g. KRA eTIMS, statutory receipts
}

// -------------------------------------------------------------
// 3. PACKAGED MODULE DEFINITIONS
// -------------------------------------------------------------

export interface BusinessModuleDefinition {
  moduleId: string;
  name: string;
  version: string;
  description: string;
  requiredCapabilities: string[]; // Capabilities this module consumes
  targetRoles: string[]; // Roles who use this module
  iconName: string;
  route: string;
  workflows: string[]; // Workflow IDs provided by this module
  surfaces: SurfaceType[]; // Which surfaces can run or render this module
  status: 'INSTALLED' | 'AVAILABLE' | 'RESTRICTED';
}

// -------------------------------------------------------------
// 4. WORKFLOW DEFINITIONS
// -------------------------------------------------------------

export interface BusinessWorkflowDefinition {
  workflowId: string;
  name: string;
  moduleId: string;
  capabilityId: string;
  description: string;
  triggerEvent: string; // e.g. 'attendance.recorded.v1'
  requiredPermissions: string[];
  authorizedRoles: string[];
  downstreamOutcomes: {
    targetSystemOrRole: string;
    description: string;
  }[];
}

// -------------------------------------------------------------
// 5. HOME EXPERIENCE MODEL (ROLE-AWARE & CONTEXT-AWARE)
// -------------------------------------------------------------

export interface MyDaySummary {
  greeting: string;
  headline: string;
  roleBadge: string;
  dateFormatted: string;
  metrics: Array<{
    label: string;
    value: string | number;
    sublabel?: string;
    trend?: 'UP' | 'DOWN' | 'NEUTRAL';
  }>;
}

export interface BusinessPulseItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  priority: 'ROUTINE' | 'ELEVATED' | 'URGENT';
  sourceModule: string;
  relatedEntityId?: string;
}

export interface RoleTaskItem {
  taskId: string;
  title: string;
  summary: string;
  dueTime?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  urgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
  actionCommand?: string;
  actionPayload?: Record<string, unknown>;
}

export interface RoleAlertItem {
  alertId: string;
  title: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  actionLabel?: string;
  actionCommand?: string;
}

export interface RecentContributionItem {
  contributionId: string;
  actorName: string;
  actorRole: string;
  actionSummary: string;
  timestamp: string;
  impactSummary: string; // e.g. "Updated student records & triggered parent SMS notification"
}

export interface RecommendedNextAction {
  actionId: string;
  title: string;
  description: string;
  iconName: string;
  buttonLabel: string;
  command: string;
  payload?: Record<string, unknown>;
}

export interface HomeExperience {
  myDay: MyDaySummary;
  importantActivity: BusinessPulseItem[];
  relevantTasks: RoleTaskItem[];
  alerts: RoleAlertItem[];
  recentContributions: RecentContributionItem[];
  recommendedActions: RecommendedNextAction[];
}

// -------------------------------------------------------------
// 6. THREE-LEVEL CATALOGUE STRUCTURE
// -------------------------------------------------------------

export type CatalogueActionType =
  | 'OPEN_TOOL'
  | 'ENABLE'
  | 'REQUEST_ACCESS'
  | 'REQUEST_ADMIN_APPROVAL'
  | 'UPGRADE_TIER'
  | 'MANAGED_BY_ADMIN';

export interface MyToolItem {
  toolId: string;
  name: string;
  category: string;
  description: string;
  iconName: string;
  route: string;
  capabilityId: string;
  moduleId: string;
  isReady: boolean;
}

export interface AvailableSpaceCapabilityItem {
  capabilityId: string;
  name: string;
  category: string;
  description: string;
  isEnabledInSpace: boolean;
  canUserDirectlyEnable: boolean;
  actionType: CatalogueActionType;
  actionLabel: string;
  collaborationMessage?: string; // e.g. "This capability is managed by your administrator."
  iconName: string;
}

export interface ExploreMoreOfferingItem {
  capabilityId: string;
  name: string;
  category: string;
  description: string;
  businessBenefit: string;
  recommendedReason: string; // Why Business DNA recommended this
  tierRequired: SubscriptionTier;
  actionType: CatalogueActionType;
  actionLabel: string;
  collaborationMessage: string; // Instead of "Access Denied" -> "Requires Finance Administrator approval."
  iconName: string;
}

export interface ThreeLevelCatalogue {
  myTools: MyToolItem[];
  availableToMySpace: AvailableSpaceCapabilityItem[];
  exploreMore: ExploreMoreOfferingItem[];
}

// -------------------------------------------------------------
// 7. ACCESS & CAPABILITY COLLABORATION REQUESTS
// -------------------------------------------------------------

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface CapabilityAccessRequest {
  requestId: string;
  tenantId: string;
  spaceId: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  capabilityId: string;
  capabilityName: string;
  justification: string;
  status: AccessRequestStatus;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

// -------------------------------------------------------------
// 8. NOTIFICATION COHERENCE
// -------------------------------------------------------------

export interface CoherentNotification {
  notificationId: string;
  recipientUserId: string;
  recipientRole: string;
  title: string;
  body: string;
  category: 'CONTRIBUTION_OUTCOME' | 'APPROVAL_UPDATE' | 'BUSINESS_ALERT' | 'SYSTEM_NOTICE';
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  relatedEntityId?: string;
}

// -------------------------------------------------------------
// 9. ROLE-BASED AI CONTEXT
// -------------------------------------------------------------

export interface RoleBasedAiContext {
  userId: string;
  userRole: string;
  roleTitle: string;
  currentSpace: {
    spaceId: string;
    spaceName: string;
    spaceType: string;
    sector: SectorType;
  };
  permissionScope: string[];
  authorizedCapabilities: string[];
  accessibleDataBoundaries: string[];
  systemInstructions: string;
}

// -------------------------------------------------------------
// 10. MULTI-SURFACE RENDERING
// -------------------------------------------------------------

export type SurfaceType =
  | 'WEB_WORKSPACE'
  | 'WHATSAPP'
  | 'MOBILE_APP'
  | 'PARENT_PORTAL'
  | 'CUSTOMER_PORTAL'
  | 'TV_DISPLAY'
  | 'LED_DISPLAY'
  | 'CLASSROOM_DISPLAY'
  | 'API';

export interface SurfaceRenderPayload {
  surface: SurfaceType;
  title: string;
  sourceEvent: string;
  content: {
    primaryText: string;
    subText?: string;
    items?: Array<{ key: string; value: string }>;
    qrCodeUrl?: string;
    displayTheme?: 'LIGHT' | 'DARK' | 'HIGH_CONTRAST';
    refreshIntervalSeconds?: number;
  };
  targetSpaceId: string;
  generatedAt: string;
}

// -------------------------------------------------------------
// 11. SHARED CONTRIBUTION DISPATCH & REACTION
// -------------------------------------------------------------

export interface ContributionPayload {
  contributionType: string; // e.g. 'RECORD_ATTENDANCE', 'POST_PAYMENT', 'ISSUE_INVOICE'
  tenantId: string;
  spaceId: string;
  data: Record<string, unknown>;
}

export interface ContributionOutcome {
  contributionId: string;
  contributionType: string;
  domainEventEmitted: string;
  stateUpdated: boolean;
  entityId: string;
  notifiedRoles: string[];
  workflowsTriggered: string[];
  dnaSignalRecorded: boolean;
  auditRecorded: boolean;
  summaryMessage: string;
  serverTimestamp: string;
}

// -------------------------------------------------------------
// 12. COMPLETE COHERENT EXPERIENCE RESOLUTION
// -------------------------------------------------------------

export interface CoherentExperienceResolution {
  identity: {
    userId: string;
    displayName: string;
    email: string;
    isMaster: boolean;
  };
  currentSpace: BusinessSpace;
  availableSpaces: Array<{
    space: BusinessSpace;
    membershipRole: string;
    roleTitle: string;
    isCurrent: boolean;
  }>;
  membership: SpaceMembership;
  activeRoles: string[];
  permissionScopes: string[];
  activeCapabilities: FormalCapabilityDefinition[];
  installedModules: BusinessModuleDefinition[];
  availableWorkflows: BusinessWorkflowDefinition[];
  home: HomeExperience;
  navigation: ExperienceNavItem[];
  dashboardWidgets: ExperienceWidget[];
  catalogue: ThreeLevelCatalogue;
  activeRequests: CapabilityAccessRequest[];
  notifications: CoherentNotification[];
  aiContext: RoleBasedAiContext;
  surfacesAvailable: SurfaceType[];
  maturityScore: {
    score: number; // 0 to 100
    level: 'STARTER' | 'DEVELOPING' | 'ADVANCED' | 'OPTIMIZED';
    activeCount: number;
    recommendedCount: number;
  };
  serverTimestamp: string;
}
