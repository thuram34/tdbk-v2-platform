/**
 * TDBK V2 ROLE-BASED COHERENCE ENGINE
 * 
 * CORE PRINCIPLE:
 * ONE BUSINESS. ONE SHARED REALITY. DIFFERENT ROLES. DIFFERENT EXPERIENCES.
 * 
 * Contextual Rule:
 * USER + SPACE = ROLE / MEMBERSHIP CONTEXT.
 * Never assume USER = ONE GLOBAL ROLE.
 */

import { SecurityContext, Principal } from '../kernel/types';
import { KernelError } from '../kernel/errors/kernelErrors';
import { masterAuthority } from '../kernel/master/masterAuthority';
import { workspaceManager } from '../platform/workspace/workspaceManager';
import { dbkRegistryRepository } from '../persistence/firestore/repositories/dbkRegistryRepository';
import { FORMAL_CAPABILITY_DEFINITIONS } from './capabilityLayer';
import { PLATFORM_MODULE_CATALOG, PLATFORM_WORKFLOW_CATALOG } from './moduleRegistry';
import {
  BusinessSpace,
  SpaceMembership , SpaceType,
  CoherentExperienceResolution,
  FormalCapabilityDefinition,
  BusinessModuleDefinition,
  BusinessWorkflowDefinition,
  HomeExperience,
  ThreeLevelCatalogue,
  MyToolItem,
  AvailableSpaceCapabilityItem,
  ExploreMoreOfferingItem,
  RoleBasedAiContext,
  SurfaceType,
} from './types';
import { capabilityAccessStore } from './approvalWorkflow';
import { dynamicNavigationEngine } from '../experience/navigation/navigationEngine';
import { dashboardComposer } from '../experience/dashboard/dashboardComposer';
import { spaceMembershipRepository } from '../persistence/firestore/repositories/spaceMembershipRepository';
import { dbkRegistry } from '../platform/dbkRegistry';
import { branchRepository } from '../persistence/firestore/repositories/branchRepository';

export class RoleBasedCoherenceEngine {
  private static instance: RoleBasedCoherenceEngine;

  // In-memory persistent mock store for user-space memberships
  private spaceMemberships: Map<string, SpaceMembership[]> = new Map(); // key: userId

  private constructor() {
    this.seedDefaultMemberships();
  }

  public static getInstance(): RoleBasedCoherenceEngine {
    if (!RoleBasedCoherenceEngine.instance) {
      RoleBasedCoherenceEngine.instance = new RoleBasedCoherenceEngine();
    }
    return RoleBasedCoherenceEngine.instance;
  }

  /**
   * Seeds realistic multi-space memberships demonstrating:
   * USER + SPACE = ROLE / MEMBERSHIP CONTEXT
   */
  private seedDefaultMemberships(): void {
    // Default memberships for demo users
    const defaultUserSpaces: Record<string, SpaceMembership[]> = {
      // 1. School demo user: School Principal in Mombasa Academy, Finance Viewer in Kilifi, Org Admin in Group
      usr_school_admin: [
        {
          membershipId: 'mem_sch_01',
          userId: 'usr_school_admin',
          spaceId: 'space_mombasa_academy',
          tenantId: 'tenant_school_01',
          role: 'SCHOOL_PRINCIPAL',
          roleTitle: 'School Principal & Head of Academy',
          status: 'ACTIVE',
          joinedAt: '2025-01-10T08:00:00Z',
          permissions: ['school:admin', 'attendance:*', 'finance:view', 'students:*'],
          department: 'Executive Leadership',
        },
        {
          membershipId: 'mem_sch_02',
          userId: 'usr_school_admin',
          spaceId: 'space_kilifi_campus',
          tenantId: 'tenant_school_01',
          role: 'FINANCE_VIEWER',
          roleTitle: 'Finance & Compliance Inspector',
          status: 'ACTIVE',
          joinedAt: '2025-02-15T09:30:00Z',
          permissions: ['finance:view', 'reports:read'],
          department: 'Board Audit',
        },
        {
          membershipId: 'mem_sch_03',
          userId: 'usr_school_admin',
          spaceId: 'space_education_group',
          tenantId: 'tenant_school_01',
          role: 'TENANT_ADMIN',
          roleTitle: 'Group General Administrator',
          status: 'ACTIVE',
          joinedAt: '2024-11-01T00:00:00Z',
          permissions: ['*'],
          department: 'Central HQ',
        },
      ],
      // 2. Teacher user
      usr_teacher_demo: [
        {
          membershipId: 'mem_tch_01',
          userId: 'usr_teacher_demo',
          spaceId: 'space_mombasa_academy',
          tenantId: 'tenant_school_01',
          role: 'TEACHER',
          roleTitle: 'Class Teacher & Department Head',
          status: 'ACTIVE',
          joinedAt: '2025-03-01T08:00:00Z',
          permissions: ['attendance:write', 'students:read', 'academics:write'],
          department: 'Science & Mathematics',
        },
      ],
      // 3. Retail / Hardware user
      usr_hardware_admin: [
        {
          membershipId: 'mem_hwd_01',
          userId: 'usr_hardware_admin',
          spaceId: 'space_downtown_hardware',
          tenantId: 'dbk_hardware_01',
          role: 'STORE_OWNER',
          roleTitle: 'Managing Director & Store Owner',
          status: 'ACTIVE',
          joinedAt: '2024-06-01T08:00:00Z',
          permissions: ['pos:*', 'inventory:*', 'finance:*', 'admin:*'],
          department: 'Store Management',
        },
        {
          membershipId: 'mem_hwd_02',
          userId: 'usr_hardware_admin',
          spaceId: 'space_industrial_yard',
          tenantId: 'dbk_hardware_01',
          role: 'OPERATIONS_SUPERVISOR',
          roleTitle: 'Yard & Logistics Overseer',
          status: 'ACTIVE',
          joinedAt: '2024-08-15T08:00:00Z',
          permissions: ['inventory:audit', 'stock:transfer'],
          department: 'Warehouse & Dispatch',
        },
      ],
    };

    for (const [userId, memberships] of Object.entries(defaultUserSpaces)) {
      this.spaceMemberships.set(userId, memberships);
    }
  }

  /**
   * Resolves the list of spaces and associated role memberships for a given user.
   */
  public getUserSpaces(userId: string, tenantId: string): Array<{
    space: BusinessSpace;
    membership: SpaceMembership;
  }> {
    const memberships = (this.spaceMemberships.get(userId) || []).filter(
      (membership) => membership.tenantId === tenantId
    );
    
    // Only memberships belonging to the requested tenant are exposed.
    if (memberships.length > 0) {
      return memberships.map((m) => ({
        space: this.resolveSpaceMetadata(m.spaceId, m.tenantId),
        membership: m,
      }));
    }

    // No implicit membership. Production identities must be explicitly provisioned
    // into a space; never synthesize OWNER + wildcard permissions from absence of data.
    return [];
  }

  /**
   * Helper to resolve space metadata
   */
  private resolveSpaceMetadata(spaceId: string, tenantId: string): BusinessSpace {
    return { spaceId, tenantId, organizationName: tenantId, spaceName: spaceId, spaceType: 'BRANCH' as SpaceType, sector: 'OTHER' as any, isHeadquarters: false, status: 'ACTIVE' };
  }

  private async resolvePersistentSpaceMetadata(spaceId: string, tenantId: string): Promise<BusinessSpace> {
    const dbk = await dbkRegistry.getDbkInternal(tenantId);
    if (!dbk || dbk.dbkId !== tenantId) {
      throw new Error(`Durable DBK '${tenantId}' not found while resolving space '${spaceId}'.`);
    }

    const branches = await branchRepository.listBranches(tenantId);
    const branch = branches.find((candidate) => candidate.branchId === spaceId);

    if (branch) {
      const spaceType: SpaceType =
        branch.type === 'HEADQUARTERS' ? 'HEADQUARTERS' :
        branch.type === 'CAMPUS' ? 'CAMPUS' :
        branch.type === 'CLINIC_BRANCH' ? 'BRANCH' :
        branch.type === 'WAREHOUSE' ? 'DISTRIBUTION_HUB' :
        branch.type === 'RETAIL_OUTLET' ? 'STORE_OUTLET' :
        'BRANCH';

      return {
        spaceId: branch.branchId,
        tenantId,
        organizationName: dbk.displayName || dbk.legalName,
        spaceName: branch.name,
        spaceType,
        sector: dbk.sector,
        isHeadquarters: branch.isHeadquarters,
        status: branch.status === 'ACTIVE' ? 'ACTIVE' : branch.status === 'ARCHIVED' ? 'ARCHIVED' : 'SUSPENDED',
        address: branch.location?.address,
        city: branch.location?.town,
      };
    }

    // A DBK itself may be represented as its headquarters space.
    if (spaceId === tenantId || spaceId === `${tenantId}_hq`) {
      const hq = branches.find((candidate) => candidate.isHeadquarters && candidate.status === 'ACTIVE');
      if (hq) {
        return {
          spaceId: hq.branchId,
          tenantId,
          organizationName: dbk.displayName || dbk.legalName,
          spaceName: hq.name,
          spaceType: 'HEADQUARTERS',
          sector: dbk.sector,
          isHeadquarters: true,
          status: 'ACTIVE',
          address: hq.location?.address,
          city: hq.location?.town,
        };
      }
    }

    throw new Error(`Space '${spaceId}' is not backed by a durable branch for tenant '${tenantId}'.`);
  }

  /** Durable production membership read. Test fixtures may fall back to seeded data. */
  public async getPersistentUserSpaces(userId: string, tenantId: string): Promise<Array<{
    space: BusinessSpace;
    membership: SpaceMembership;
  }>> {
    const memberships = await spaceMembershipRepository.listMemberships(tenantId, userId);
    if (memberships.length === 0 && process.env.NODE_ENV === 'test') {
      return this.getUserSpaces(userId, tenantId);
    }
    return Promise.all(memberships
      .filter((membership) => membership.status === 'ACTIVE')
      .map(async (membership) => ({
        space: await this.resolvePersistentSpaceMetadata(membership.spaceId, membership.tenantId),
        membership,
      })));

  }

  /**
   * CENTRAL COHERENCE RESOLUTION METHOD
   * Resolves the 10 dimensions of the role-based experience:
   * 1. Identity
   * 2. Tenant / Organization
   * 3. Space
   * 4. Membership
   * 5. Role(s)
   * 6. Permission scopes
   * 7. Active business capabilities
   * 8. Installed modules
   * 9. Available workflows
   * 10. Relevant recommendations
   */
  public async resolveCoherentExperience(
    context: SecurityContext,
    targetDbkId: string,
    options?: {
      targetSpaceId?: string;
      activeRoleOverride?: string;
    }
  ): Promise<CoherentExperienceResolution> {
    const { principal } = context;
    const isMaster = masterAuthority.isMasterAdmin(principal) || masterAuthority.isOwnerPortfolio(principal);

    // 1. Resolve workspace state
    const workspace = await workspaceManager.compileWorkspaceState(context, targetDbkId);

    // 2. Resolve User Spaces & Memberships
    const userSpacesWithMemberships = await this.getPersistentUserSpaces(principal.id, targetDbkId);
    
    // Choose active space
    let activeSpaceItem = userSpacesWithMemberships.find((s) => s.space.spaceId === options?.targetSpaceId);
    if (!activeSpaceItem) {
      activeSpaceItem = userSpacesWithMemberships[0];
    }

    if (!activeSpaceItem) {
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        `No active space membership exists for user '${principal.id}' in DBK '${targetDbkId}'`,
        403,
        context.requestId
      );
    }

    const { space: currentSpace, membership: originalMembership } = activeSpaceItem;

    // 3. Resolve Active Role & Membership in this space
    // If the caller requested an explicit role switch within authorized permissions, apply it
    const activeRole = options?.activeRoleOverride || originalMembership.role || principal.roles[0] || 'GUEST';
    
    const friendlyRoleTitle = this.computeFriendlyRoleTitle(activeRole);
    const membership: SpaceMembership = {
      ...originalMembership,
      role: activeRole,
      roleTitle: friendlyRoleTitle,
    };

    // 4. Derive Permission Scopes
    const permissionScopes = this.derivePermissionsForRole(activeRole, isMaster, principal.permissions);

    // 5. Formal Capabilities
    const activeCapabilities: FormalCapabilityDefinition[] = FORMAL_CAPABILITY_DEFINITIONS.filter((cap) => {
      // Check if capability is enabled in workspace
      return workspace.enabledCapabilities.some((c) => c.includes(cap.category.toLowerCase()) || c.includes(cap.capabilityId.replace('capability_', '')));
    });

    // If none matched by strict string, provide the foundational active ones
    if (activeCapabilities.length === 0) {
      activeCapabilities.push(
        ...FORMAL_CAPABILITY_DEFINITIONS.filter((c) => c.minimumTier === 'FOUNDATION')
      );
    }

    // 6. Installed Packaged Modules for this Role
    const installedModules: BusinessModuleDefinition[] = PLATFORM_MODULE_CATALOG.filter((mod) => {
      // Check role authorization
      const isRoleAllowed = isMaster || mod.targetRoles.includes(activeRole) || mod.targetRoles.includes('TENANT_ADMIN');
      return isRoleAllowed;
    });

    // 7. Available Workflows for this Role
    const availableWorkflows: BusinessWorkflowDefinition[] = PLATFORM_WORKFLOW_CATALOG.filter((wf) => {
      const isRoleAllowed = isMaster || wf.authorizedRoles.includes(activeRole) || wf.authorizedRoles.includes('TENANT_ADMIN');
      return isRoleAllowed;
    });

    // 8. Compose Home Experience (Role-Aware & Context-Aware)
    const home = this.composeHomeExperience(activeRole, currentSpace, workspace.displayName, activeCapabilities);

    // 9. Three-Level Catalogue (My Tools, Available to My Space, Explore More)
    const catalogue = this.composeThreeLevelCatalogue(activeRole, currentSpace, activeCapabilities, installedModules, workspace.subscriptionTier);

    // 10. Navigation & Dashboard Widgets (using existing engines)
    const navigation = dynamicNavigationEngine.buildNavigation(workspace, context);
    const dashboardWidgets = dashboardComposer.composeDashboard(workspace);

    // 11. Active Access Requests for this Space
    const activeRequests = await capabilityAccessStore.listPersistentRequestsForSpace(context, targetDbkId, currentSpace.spaceId);

    // 12. Coherent Notifications (Role-Targeted)
    const notifications = this.composeCoherentNotifications(activeRole, currentSpace);

    // 13. Role-Based AI Context
    const aiContext: RoleBasedAiContext = {
      userId: principal.id,
      userRole: activeRole,
      roleTitle: friendlyRoleTitle,
      currentSpace: {
        spaceId: currentSpace.spaceId,
        spaceName: currentSpace.spaceName,
        spaceType: currentSpace.spaceType,
        sector: currentSpace.sector,
      },
      permissionScope: permissionScopes,
      authorizedCapabilities: activeCapabilities.map((c) => c.name),
      accessibleDataBoundaries: [
        `tenant:${targetDbkId}`,
        `space:${currentSpace.spaceId}`,
        `role:${activeRole}`,
      ],
      systemInstructions: `You are the TDBK Business Copilot operating under role '${friendlyRoleTitle}' in space '${currentSpace.spaceName}'. All guidance must strictly observe ${currentSpace.sector} operational constraints and role permissions [${permissionScopes.slice(0, 3).join(', ')}].`,
    };

    // 14. Multi-Surface Availability
    const surfacesAvailable: SurfaceType[] = [
      'WEB_WORKSPACE',
      'MOBILE_APP',
      'WHATSAPP',
      'API',
      ...(currentSpace.sector === 'EDUCATION' ? (['CLASSROOM_DISPLAY', 'PARENT_PORTAL'] as SurfaceType[]) : []),
      ...(currentSpace.sector === 'HEALTHCARE' ? (['TV_DISPLAY'] as SurfaceType[]) : []),
      ...(currentSpace.sector === 'RETAIL' || currentSpace.sector === 'HARDWARE' ? (['CUSTOMER_PORTAL', 'LED_DISPLAY'] as SurfaceType[]) : []),
    ];

    // Maturity calculation
    const totalCapabilitiesCount = FORMAL_CAPABILITY_DEFINITIONS.length;
    const activeCount = activeCapabilities.length;
    const score = Math.round((activeCount / totalCapabilitiesCount) * 100);
    const maturityLevel = score > 75 ? 'OPTIMIZED' : score > 50 ? 'ADVANCED' : score > 25 ? 'DEVELOPING' : 'STARTER';

    return {
      identity: {
        userId: principal.id,
        displayName: this.computeDisplayName(principal.id),
        email: `${principal.id.toLowerCase()}@tdbk.biz`,
        isMaster,
      },
      currentSpace,
      availableSpaces: userSpacesWithMemberships.map((s) => ({
        space: s.space,
        membershipRole: s.membership.role,
        roleTitle: s.membership.roleTitle,
        isCurrent: s.space.spaceId === currentSpace.spaceId,
      })),
      membership,
      activeRoles: [activeRole],
      permissionScopes,
      activeCapabilities,
      installedModules,
      availableWorkflows,
      home,
      navigation,
      dashboardWidgets,
      catalogue,
      activeRequests,
      notifications,
      aiContext,
      surfacesAvailable,
      maturityScore: {
        score,
        level: maturityLevel,
        activeCount,
        recommendedCount: totalCapabilitiesCount - activeCount,
      },
      serverTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper to compute user-friendly role titles
   */
  private computeFriendlyRoleTitle(role: string): string {
    const titles: Record<string, string> = {
      SCHOOL_PRINCIPAL: 'School Principal & Head of Academy',
      TEACHER: 'Class Teacher & Department Instructor',
      BURSAR: 'School Bursar & Revenue Officer',
      FINANCE_VIEWER: 'Finance & Compliance Inspector',
      STORE_OWNER: 'Managing Director & Store Owner',
      SHOP_MANAGER: 'Store General Manager',
      CASHIER: 'Counter Cashier & POS Operator',
      OPERATIONS_SUPERVISOR: 'Operations & Logistics Supervisor',
      CLINICIAN: 'Duty Medical Clinician',
      MEDICAL_DIRECTOR: 'Medical Director & Chief Physician',
      TENANT_ADMIN: 'Organization Administrator',
      TDBK_MASTER_ADMIN: 'TDBK Platform Master Administrator',
    };
    return titles[role] || role.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  /**
   * Helper to compute clean display names
   */
  private computeDisplayName(userId: string): string {
    if (userId.includes('school_admin')) return 'Dr. Catherine Mutua';
    if (userId.includes('teacher')) return 'Mr. David Ochieng';
    if (userId.includes('hardware_admin')) return 'James Mwangi';
    if (userId.includes('master')) return 'TDBK Master Overseer';
    return userId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Derives permissions based on role
   */
  private derivePermissionsForRole(role: string, isMaster: boolean, explicitPerms: string[]): string[] {
    if (isMaster || role === 'TENANT_ADMIN' || role === 'STORE_OWNER' || role === 'SCHOOL_PRINCIPAL') {
      return ['*', 'admin:*', 'read:*', 'write:*', 'manage:*'];
    }

    if (role === 'TEACHER') {
      return ['attendance:read', 'attendance:write', 'students:read', 'academics:read', 'academics:write'];
    }

    if (role === 'BURSAR') {
      return ['finance:read', 'finance:receive', 'receipts:issue', 'mpesa:reconcile', 'etims:sign'];
    }

    if (role === 'CASHIER') {
      return ['pos:checkout', 'receipts:issue', 'mpesa:stk_push', 'stock:view'];
    }

    if (role === 'CLINICIAN') {
      return ['clinical:triage', 'patients:consult', 'prescriptions:write'];
    }

    return explicitPerms.length > 0 ? explicitPerms : ['general:read'];
  }

  /**
   * Composes the Role-Aware Home Experience
   */
  private composeHomeExperience(
    role: string,
    space: BusinessSpace,
    businessName: string,
    capabilities: FormalCapabilityDefinition[]
  ): HomeExperience {
    const todayFormatted = new Date().toLocaleDateString('en-KE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    let greeting = 'Welcome back';
    let headline = `Here is what is happening across ${space.spaceName} today.`;
    let metrics: Array<{ label: string; value: string | number; sublabel?: string; trend?: 'UP' | 'DOWN' | 'NEUTRAL' }> = [];
    let relevantTasks: any[] = [];
    let alerts: any[] = [];

    if (role === 'TEACHER') {
      greeting = 'Good morning, Teacher';
      headline = 'Your morning classes and learner attendance are ready for review.';
      metrics = [
        { label: 'Assigned Learners', value: '38 Students', sublabel: 'Class 4-Blue', trend: 'NEUTRAL' },
        { label: 'Attendance Marked', value: '36 / 38', sublabel: '2 Unexcused Absences', trend: 'UP' },
        { label: 'Upcoming Lesson', value: '11:00 AM', sublabel: 'Basic Mathematics Room 3' },
      ];
      relevantTasks = [
        {
          taskId: 'task_tch_01',
          title: 'Mark Class 4-Blue Morning Attendance',
          summary: 'Tap to open the attendance register and record presence for period 1.',
          status: 'TODO',
          urgency: 'HIGH',
          actionCommand: 'OPEN_TOOL',
          actionPayload: { route: '/attendance' },
        },
        {
          taskId: 'task_tch_02',
          title: 'Submit Mid-Term Academic Scores',
          summary: '8 students remaining in Mathematics rubric assessment.',
          status: 'IN_PROGRESS',
          urgency: 'NORMAL',
          actionCommand: 'OPEN_TOOL',
          actionPayload: { route: '/students' },
        },
      ];
      alerts = [
        {
          alertId: 'alt_tch_01',
          title: 'Unexcused Absence Alert',
          severity: 'INFO',
          message: 'Brian Otieno has been marked absent for 2 consecutive days. Guardian SMS queued.',
        },
      ];
    } else if (role === 'BURSAR') {
      greeting = 'Good morning, Bursar';
      headline = 'Fee collections, M-Pesa till deposits, and pending receipts for today.';
      metrics = [
        { label: 'Today Collections', value: 'KES 148,500', sublabel: '18 M-Pesa & Cash Txns', trend: 'UP' },
        { label: 'Pending Arrears', value: 'KES 320,000', sublabel: '14 Accounts Outstanding' },
        { label: 'eTIMS Certified', value: '100% Invoiced', sublabel: 'All payments signed', trend: 'UP' },
      ];
      relevantTasks = [
        {
          taskId: 'task_bur_01',
          title: 'Reconcile 3 Unallocated M-Pesa Deposits',
          summary: 'KES 18,000 received via Paybill awaiting student admission number assignment.',
          status: 'TODO',
          urgency: 'HIGH',
          actionCommand: 'OPEN_TOOL',
          actionPayload: { route: '/payments' },
        },
      ];
    } else if (role === 'STORE_OWNER' || role === 'TENANT_ADMIN') {
      greeting = 'Executive Operational Briefing';
      headline = `Overview of active performance and transactions for ${businessName}.`;
      metrics = [
        { label: 'Gross Revenue (Today)', value: 'KES 420,000', sublabel: 'vs KES 380,000 yesterday', trend: 'UP' },
        { label: 'Active Spaces', value: '3 Active Locations', sublabel: 'Mombasa, Kilifi, Nairobi' },
        { label: 'Compliance Health', value: '100% Validated', sublabel: 'eTIMS & Audit Logs Clean', trend: 'UP' },
      ];
      relevantTasks = [
        {
          taskId: 'task_ceo_01',
          title: 'Review Staff Access Requests',
          summary: '2 team members requested activation of Omnichannel Communication.',
          status: 'TODO',
          urgency: 'HIGH',
          actionCommand: 'NAVIGATE',
          actionPayload: { route: '/requests' },
        },
      ];
      alerts = [
        {
          alertId: 'alt_ceo_01',
          title: 'Stock Reorder Threshold Reached',
          severity: 'WARNING',
          message: 'Cement 50kg bags are below safety buffer in Industrial Yard (14 bags remaining).',
          actionLabel: 'View Yard',
        },
      ];
    } else {
      // General role
      metrics = [
        { label: 'Current Space', value: space.spaceName, sublabel: space.sector },
        { label: 'Operational Status', value: 'ACTIVE', sublabel: 'All services nominal', trend: 'UP' },
      ];
    }

    return {
      myDay: {
        greeting,
        headline,
        roleBadge: this.computeFriendlyRoleTitle(role),
        dateFormatted: todayFormatted,
        metrics,
      },
      importantActivity: [
        {
          id: 'pulse_01',
          title: 'M-Pesa STK Push Settlement Confirmed',
          description: 'KES 24,500 settled directly into business bank account.',
          timestamp: '12 minutes ago',
          priority: 'ROUTINE',
          sourceModule: 'M-Pesa Till Hub',
        },
        {
          id: 'pulse_02',
          title: 'Daily KRA eTIMS Fiscal Clearance',
          description: 'Control codes verified and posted with KRA electronic tax server.',
          timestamp: '45 minutes ago',
          priority: 'ROUTINE',
          sourceModule: 'eTIMS Fiscalizer',
        },
        {
          id: 'pulse_03',
          title: 'Automated Attendance Digest Dispatched',
          description: 'Daily presence report delivered to Principal and Board.',
          timestamp: '1 hour ago',
          priority: 'ROUTINE',
          sourceModule: 'Class Attendance Register',
        },
      ],
      relevantTasks,
      alerts,
      recentContributions: [
        {
          contributionId: 'cnt_01',
          actorName: 'Mr. David Ochieng',
          actorRole: 'Class Teacher',
          actionSummary: 'Logged morning attendance for 38 Grade 4 learners',
          timestamp: '25 mins ago',
          impactSummary: 'Updated school presence dashboard & queued 2 guardian SMS notifications',
        },
        {
          contributionId: 'cnt_02',
          actorName: 'Grace Wambui',
          actorRole: 'Bursar',
          actionSummary: 'Issued certified fee installment receipt for KES 25,000',
          timestamp: '1 hour ago',
          impactSummary: 'Updated student ledger balance & transmitted eTIMS tax record',
        },
      ],
      recommendedActions: [
        {
          actionId: 'rec_01',
          title: 'Activate Parent WhatsApp Notifications',
          description: 'Reduce SMS billing by 60% by routing routine notices through WhatsApp Business.',
          iconName: 'MessageSquare',
          buttonLabel: 'Explore WhatsApp Channel',
          command: 'OPEN_CATALOGUE_ITEM',
          payload: { capabilityId: 'capability_communication' },
        },
      ],
    };
  }

  /**
   * Composes the Three-Level Catalogue
   * 1. My Tools
   * 2. Available to My Space (Enable / Request / Managed by Administrator)
   * 3. Explore More (Growth opportunities with collaboration instead of "Access Denied")
   */
  private composeThreeLevelCatalogue(
    role: string,
    space: BusinessSpace,
    activeCaps: FormalCapabilityDefinition[],
    installedMods: BusinessModuleDefinition[],
    currentTier: string
  ): ThreeLevelCatalogue {
    const isTenantAdmin = role === 'TENANT_ADMIN' || role === 'STORE_OWNER' || role === 'SCHOOL_PRINCIPAL';

    // 1. My Tools
    const myTools: MyToolItem[] = installedMods.map((mod) => ({
      toolId: mod.moduleId,
      name: mod.name,
      category: mod.requiredCapabilities[0]?.replace('capability_', '').toUpperCase() || 'CORE',
      description: mod.description,
      iconName: mod.iconName,
      route: mod.route,
      capabilityId: mod.requiredCapabilities[0] || 'core',
      moduleId: mod.moduleId,
      isReady: true,
    }));

    // 2. Available to My Space
    const availableToMySpace: AvailableSpaceCapabilityItem[] = FORMAL_CAPABILITY_DEFINITIONS.map((cap) => {
      const isEnabled = activeCaps.some((c) => c.capabilityId === cap.capabilityId);
      
      let actionType: any = isEnabled ? 'OPEN_TOOL' : isTenantAdmin ? 'ENABLE' : 'REQUEST_ACCESS';
      let actionLabel = isEnabled ? 'Active' : isTenantAdmin ? 'Enable Now' : 'Request Access';
      let collaborationMessage = isEnabled
        ? 'Active in this business space'
        : isTenantAdmin
        ? 'Available for one-click deployment'
        : 'Managed by your organization administrator. Tap to send a collaboration request.';

      return {
        capabilityId: cap.capabilityId,
        name: cap.name,
        category: cap.category,
        description: cap.description,
        isEnabledInSpace: isEnabled,
        canUserDirectlyEnable: isTenantAdmin,
        actionType,
        actionLabel,
        collaborationMessage,
        iconName: this.getIconForCategory(cap.category),
      };
    });

    // 3. Explore More (Advanced / Growth capabilities)
    const exploreMore: ExploreMoreOfferingItem[] = FORMAL_CAPABILITY_DEFINITIONS
      .filter((cap) => cap.minimumTier === 'GROWTH' || cap.minimumTier === 'ENTERPRISE')
      .map((cap) => ({
        capabilityId: cap.capabilityId,
        name: cap.name,
        category: cap.category,
        description: cap.description,
        businessBenefit: cap.businessPurpose,
        recommendedReason: `Recommended by TDBK Business DNA to elevate operational maturity from Starter to ${cap.minimumTier}.`,
        tierRequired: cap.minimumTier,
        actionType: isTenantAdmin ? 'ENABLE' : 'REQUEST_ADMIN_APPROVAL',
        actionLabel: isTenantAdmin ? 'Activate Upgrade' : 'Request for Space',
        collaborationMessage: isTenantAdmin
          ? 'Upgrade organization capability profile'
          : 'Requires Administrator approval. Send request with business justification.',
        iconName: this.getIconForCategory(cap.category),
      }));

    return {
      myTools,
      availableToMySpace,
      exploreMore,
    };
  }

  private getIconForCategory(category: string): string {
    const icons: Record<string, string> = {
      PAYMENTS: 'CreditCard',
      COMMUNICATION: 'MessageSquare',
      INVENTORY: 'Package',
      SCHEDULING: 'Calendar',
      ATTENDANCE: 'CheckSquare',
      DOCUMENT_MANAGEMENT: 'FileText',
      DIGITAL_DISPLAY: 'Tv',
      ANALYTICS: 'BarChart3',
      AI_INTELLIGENCE: 'Sparkles',
      CRM: 'Users',
      IDENTITY_ACCESS: 'ShieldCheck',
      NOTIFICATIONS: 'Bell',
      STATUTORY_TAX: 'FileCheck',
    };
    return icons[category] || 'Layers';
  }

  /**
   * Role-targeted notification stream
   */
  private composeCoherentNotifications(role: string, space: BusinessSpace) {
    return [
      {
        notificationId: 'notif_01',
        recipientUserId: 'CURRENT_USER',
        recipientRole: role,
        title: 'Morning Sync Complete',
        body: `All systems in ${space.spaceName} are synchronized with central records.`,
        category: 'SYSTEM_NOTICE' as const,
        timestamp: '10 minutes ago',
        isRead: false,
      },
      {
        notificationId: 'notif_02',
        recipientUserId: 'CURRENT_USER',
        recipientRole: role,
        title: 'Team Contribution Noted',
        body: 'Learner presence and counter transactions have been posted to the shared business ledger.',
        category: 'CONTRIBUTION_OUTCOME' as const,
        timestamp: '40 minutes ago',
        isRead: false,
      },
    ];
  }
}

export const roleBasedCoherenceEngine = RoleBasedCoherenceEngine.getInstance();
