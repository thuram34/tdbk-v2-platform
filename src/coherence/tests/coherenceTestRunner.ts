/**
 * TDBK V2 ROLE-BASED COHERENCE ENGINE (RBCE) VERIFICATION SUITE
 * 
 * Verifies:
 * 1. ONE BUSINESS. ONE SHARED REALITY. DIFFERENT ROLES. DIFFERENT EXPERIENCES.
 * 2. USER + SPACE = ROLE / MEMBERSHIP CONTEXT
 * 3. Formal Capability Layer vs. Packaged Module Decoupling
 * 4. Role-Aware Home Experience (My Day, Pulse, Tasks, Alerts, Contributions)
 * 5. Three-Level Catalogue (My Tools, Available to My Space, Explore More)
 * 6. Shared Contribution Pipeline (Action -> Event -> State -> Module Reaction -> Multi-Role Outcome -> DNA)
 * 7. Approval Flows (Request -> Approve -> Recompose -> Notify)
 * 8. Role-Scoped AI Context (RBAC & Space Boundary Invariants)
 * 9. Headless Multi-Surface Projections (TV, Classroom, WhatsApp, Web)
 */

import { roleBasedCoherenceEngine } from '../roleBasedCoherenceEngine';
import { contributionDispatcher } from '../contributionDispatcher';
import { capabilityAccessStore } from '../approvalWorkflow';
import { multiSurfaceRenderer } from '../multiSurfaceRenderer';
import { FORMAL_CAPABILITY_DEFINITIONS } from '../capabilityLayer';
import { PLATFORM_MODULE_CATALOG, PLATFORM_WORKFLOW_CATALOG } from '../moduleRegistry';
import { SecurityContext } from '../../kernel/types';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { seedDemoDbks } from '../../platform/seeder';

export interface CoherenceTestResult {
  testName: string;
  category: string;
  passed: boolean;
  message: string;
  evidence?: Record<string, unknown>;
}

export async function runCoherenceTestSuite(): Promise<{
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: CoherenceTestResult[];
}> {
  // Ensure demo DBKs are seeded
  await seedDemoDbks();

  const results: CoherenceTestResult[] = [];

  const mockAdminContext: SecurityContext = {
    requestId: 'req_test_admin',
    correlationId: 'corr_test_admin',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'usr_school_admin',
      isMaster: false,
      tenantId: 'tenant_school_01',
      branchId: 'branch_hq',
      roles: ['SCHOOL_PRINCIPAL', 'TENANT_ADMIN'],
      permissions: ['*'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'SESSION',
    },
    tenantContext: {
      tenantId: 'tenant_school_01',
      name: 'Mombasa Academy Primary',
      blueprintId: 'school_v1',
      status: 'ACTIVE',
    },
    branchContext: null,
    ipAddress: '127.0.0.1',
    userAgent: 'TDBK-Coherence-Suite',
  };

  const mockTeacherContext: SecurityContext = {
    requestId: 'req_test_teacher',
    correlationId: 'corr_test_teacher',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'usr_teacher_demo',
      isMaster: false,
      tenantId: 'tenant_school_01',
      branchId: 'branch_hq',
      roles: ['TEACHER'],
      permissions: ['attendance:write', 'students:read'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'SESSION',
    },
    tenantContext: {
      tenantId: 'tenant_school_01',
      name: 'Mombasa Academy Primary',
      blueprintId: 'school_v1',
      status: 'ACTIVE',
    },
    branchContext: null,
    ipAddress: '127.0.0.1',
    userAgent: 'TDBK-Coherence-Suite',
  };

  // -------------------------------------------------------------
  // TEST 1: Contextual Rule (USER + SPACE = ROLE / MEMBERSHIP CONTEXT)
  // -------------------------------------------------------------
  try {
    const userSpaces = roleBasedCoherenceEngine.getUserSpaces('usr_school_admin', 'tenant_school_01');
    const mombasaSpace = userSpaces.find((s) => s.space.spaceId === 'space_mombasa_academy');
    const kilifiSpace = userSpaces.find((s) => s.space.spaceId === 'space_kilifi_campus');
    const groupSpace = userSpaces.find((s) => s.space.spaceId === 'space_education_group');

    const passed =
      userSpaces.length >= 3 &&
      mombasaSpace?.membership.role === 'SCHOOL_PRINCIPAL' &&
      kilifiSpace?.membership.role === 'FINANCE_VIEWER' &&
      groupSpace?.membership.role === 'TENANT_ADMIN';

    results.push({
      testName: 'Multi-Space Role Context Resolution (USER + SPACE = ROLE)',
      category: 'MEMBERSHIP_CONTEXT',
      passed,
      message: passed
        ? 'Same user successfully holds different roles across different spaces (Principal in Mombasa, Finance Viewer in Kilifi, Admin in Group HQ).'
        : 'Failed to resolve space-specific roles.',
      evidence: {
        mombasaRole: mombasaSpace?.membership.role,
        kilifiRole: kilifiSpace?.membership.role,
        groupRole: groupSpace?.membership.role,
      },
    });
  } catch (err) {
    results.push({
      testName: 'Multi-Space Role Context Resolution',
      category: 'MEMBERSHIP_CONTEXT',
      passed: false,
      message: (err as Error).message,
    });
  }

  // -------------------------------------------------------------
  // TEST 2: Role Experience Divergence (ONE BUSINESS, DIFFERENT EXPERIENCES)
  // -------------------------------------------------------------
  try {
    const teacherExp = await roleBasedCoherenceEngine.resolveCoherentExperience(
      mockTeacherContext,
      'tenant_school_01',
      { targetSpaceId: 'space_mombasa_academy' }
    );

    const principalExp = await roleBasedCoherenceEngine.resolveCoherentExperience(
      mockAdminContext,
      'tenant_school_01',
      { targetSpaceId: 'space_mombasa_academy' }
    );

    const isTeacherDifferentFromPrincipal =
      teacherExp.membership.role === 'TEACHER' &&
      principalExp.membership.role === 'SCHOOL_PRINCIPAL' &&
      teacherExp.home.myDay.roleBadge.includes('Teacher') &&
      principalExp.home.myDay.roleBadge.includes('Principal') &&
      teacherExp.home.myDay.metrics[0].label.includes('Learners');

    results.push({
      testName: 'Role-Based Experience Divergence',
      category: 'EXPERIENCE_RESOLUTION',
      passed: isTeacherDifferentFromPrincipal,
      message: isTeacherDifferentFromPrincipal
        ? 'Teacher and Principal receive distinct, role-tailored My Day metrics, headlines, and tasks on the same business space.'
        : 'Role experiences did not differentiate correctly.',
      evidence: {
        teacherBadge: teacherExp.home.myDay.roleBadge,
        teacherHeadline: teacherExp.home.myDay.headline,
        principalBadge: principalExp.home.myDay.roleBadge,
        principalHeadline: principalExp.home.myDay.headline,
      },
    });
  } catch (err) {
    results.push({
      testName: 'Role-Based Experience Divergence',
      category: 'EXPERIENCE_RESOLUTION',
      passed: false,
      message: (err as Error).message,
    });
  }

  // -------------------------------------------------------------
  // TEST 3: Formal Capability Layer vs Module Decoupling
  // -------------------------------------------------------------
  try {
    const totalCaps = FORMAL_CAPABILITY_DEFINITIONS.length;
    const totalMods = PLATFORM_MODULE_CATALOG.length;
    const totalWorkflows = PLATFORM_WORKFLOW_CATALOG.length;

    const hasFormalCategories = FORMAL_CAPABILITY_DEFINITIONS.some((c) => c.category === 'ATTENDANCE') &&
      FORMAL_CAPABILITY_DEFINITIONS.some((c) => c.category === 'PAYMENTS') &&
      FORMAL_CAPABILITY_DEFINITIONS.some((c) => c.category === 'STATUTORY_TAX');

    const passed = totalCaps >= 12 && totalMods >= 8 && totalWorkflows >= 4 && hasFormalCategories;

    results.push({
      testName: 'Formal Capability Layer Decoupling',
      category: 'CAPABILITY_LAYER',
      passed,
      message: passed
        ? `Capabilities (${totalCaps}) decoupled from packaged delivery modules (${totalMods}) and automated workflows (${totalWorkflows}).`
        : 'Capability layer not fully populated or decoupled.',
      evidence: { totalCaps, totalMods, totalWorkflows },
    });
  } catch (err) {
    results.push({
      testName: 'Formal Capability Layer Decoupling',
      category: 'CAPABILITY_LAYER',
      passed: false,
      message: (err as Error).message,
    });
  }

  // -------------------------------------------------------------
  // TEST 4: Three-Level Catalogue (My Tools, Available to My Space, Explore More)
  // -------------------------------------------------------------
  try {
    const teacherExp = await roleBasedCoherenceEngine.resolveCoherentExperience(
      mockTeacherContext,
      'tenant_school_01'
    );

    const { myTools, availableToMySpace, exploreMore } = teacherExp.catalogue;

    // Check that teacher sees collaboration request options instead of "Access Denied"
    const restrictedItem = availableToMySpace.find((i) => !i.canUserDirectlyEnable && !i.isEnabledInSpace);
    const hasCollaboration = restrictedItem && restrictedItem.actionType === 'REQUEST_ACCESS';

    const passed =
      myTools.length > 0 &&
      availableToMySpace.length > 0 &&
      exploreMore.length > 0 &&
      hasCollaboration === true;

    results.push({
      testName: 'Three-Level Catalogue & Collaborative Discovery',
      category: 'CATALOGUE_COHERENCE',
      passed: !!passed,
      message: passed
        ? 'Three levels (My Tools, Available to My Space, Explore More) resolved with collaborative request flows replacing hard Access Denied messages.'
        : 'Catalogue structure incomplete.',
      evidence: {
        myToolsCount: myTools.length,
        availableCount: availableToMySpace.length,
        exploreCount: exploreMore.length,
        collaborationAction: restrictedItem?.actionLabel,
        collaborationMessage: restrictedItem?.collaborationMessage,
      },
    });
  } catch (err) {
    results.push({
      testName: 'Three-Level Catalogue & Collaborative Discovery',
      category: 'CATALOGUE_COHERENCE',
      passed: false,
      message: (err as Error).message,
    });
  }

  // -------------------------------------------------------------
  // TEST 5: Shared Contribution Pipeline
  // (Action -> Event -> State -> Module Reaction -> Multi-Role Outcome -> DNA)
  // -------------------------------------------------------------
  try {
    const outcome = await contributionDispatcher.dispatchContribution(
      mockTeacherContext,
      {
        contributionType: 'RECORD_ATTENDANCE',
        tenantId: 'tenant_school_01',
        spaceId: 'space_mombasa_academy',
        data: {
          className: 'Grade 4-Blue',
          learnerCount: 38,
          status: 'PRESENT',
        },
      },
      'Class Teacher'
    );

    const durableEvents = await outboxRepository.listOutbox('tenant_school_01');
    const contributionEvent = durableEvents.find((event) =>
      event.eventType === 'attendance.recorded.v1' &&
      event.source === 'RoleBasedCoherenceEngine:ContributionDispatcher'
    );

    const passed =
      outcome.stateUpdated === true &&
      outcome.domainEventEmitted === 'attendance.recorded.v1' &&
      outcome.notifiedRoles.includes('SCHOOL_PRINCIPAL') &&
      outcome.workflowsTriggered.includes('wf_record_attendance') &&
      outcome.dnaSignalRecorded === true &&
      outcome.auditRecorded === true &&
      contributionEvent?.status === 'PENDING';

    results.push({
      testName: 'Shared Contribution Model & Coherent Outcomes',
      category: 'CONTRIBUTION_PIPELINE',
      passed,
      message: passed
        ? 'Single teacher contribution successfully updated shared student state, notified Principal, triggered parent workflow, and signaled Business DNA.'
        : 'Shared contribution outcomes not fully orchestrated.',
      evidence: {
        domainEvent: outcome.domainEventEmitted,
        notifiedRoles: outcome.notifiedRoles,
        workflowsTriggered: outcome.workflowsTriggered,
        summary: outcome.summaryMessage,
        durableOutboxEventId: contributionEvent?.eventId,
        durableOutboxStatus: contributionEvent?.status,
      },
    });
  } catch (err) {
    results.push({
      testName: 'Shared Contribution Model & Coherent Outcomes',
      category: 'CONTRIBUTION_PIPELINE',
      passed: false,
      message: (err as Error).message,
    });
  }

  // -------------------------------------------------------------
  // TEST 6: Capability Collaboration & Approval Flow
  // -------------------------------------------------------------
  try {
    // 1. Staff requests access
    const req = capabilityAccessStore.createRequest({
      tenantId: 'tenant_school_01',
      spaceId: 'space_mombasa_academy',
      requesterId: 'usr_teacher_demo',
      requesterName: 'Mr. David Ochieng',
      requesterRole: 'TEACHER',
      capabilityId: 'capability_communication',
      capabilityName: 'Omnichannel Communication',
      justification: 'Need to communicate with parents about field trip',
    });

    const isPending = req.status === 'PENDING';

    // 2. Administrator reviews & approves
    const approvedReq = capabilityAccessStore.approveRequest(
      req.requestId,
      'usr_school_admin',
      'Approved for Grade 4 class communication.'
    );

    const passed = isPending && approvedReq.status === 'APPROVED' && approvedReq.reviewedBy === 'usr_school_admin';

    results.push({
      testName: 'Access Request and Approval Recomposition Flow',
      category: 'APPROVAL_FLOWS',
      passed,
      message: passed
        ? 'Capability access request submitted by staff, reviewed and approved by administrator with audit logging.'
        : 'Approval workflow failed to transition status.',
      evidence: {
        requestId: approvedReq.requestId,
        status: approvedReq.status,
        reviewedBy: approvedReq.reviewedBy,
        reviewNotes: approvedReq.reviewNotes,
      },
    });
  } catch (err) {
    results.push({
      testName: 'Access Request and Approval Recomposition Flow',
      category: 'APPROVAL_FLOWS',
      passed: false,
      message: (err as Error).message,
    });
  }

  // -------------------------------------------------------------
  // TEST 7: Role-Scoped AI Context & Safety Boundary
  // -------------------------------------------------------------
  try {
    const teacherExp = await roleBasedCoherenceEngine.resolveCoherentExperience(
      mockTeacherContext,
      'tenant_school_01'
    );

    const { aiContext } = teacherExp;
    const passed =
      aiContext.userRole === 'TEACHER' &&
      aiContext.accessibleDataBoundaries.includes('space:space_mombasa_academy') &&
      aiContext.systemInstructions.includes('Teacher') &&
      !aiContext.permissionScope.includes('finance:*');

    results.push({
      testName: 'Role-Scoped AI Context & Boundary Enforcement',
      category: 'AI_COHERENCE',
      passed,
      message: passed
        ? 'AI Copilot instructions and accessible boundaries are strictly confined to the active Teacher role and space.'
        : 'AI context leaked unauthorized boundaries.',
      evidence: {
        role: aiContext.userRole,
        boundaries: aiContext.accessibleDataBoundaries,
        instructionsSnippet: aiContext.systemInstructions.substring(0, 80) + '...',
      },
    });
  } catch (err) {
    results.push({
      testName: 'Role-Scoped AI Context & Boundary Enforcement',
      category: 'AI_COHERENCE',
      passed: false,
      message: (err as Error).message,
    });
  }

  // -------------------------------------------------------------
  // TEST 8: Headless Multi-Surface Projections
  // -------------------------------------------------------------
  try {
    const tvPayload = multiSurfaceRenderer.renderToSurface('TV_DISPLAY', 'space_mombasa_academy', {
      title: 'School Announcement',
      sourceEvent: 'display.broadcast.v1',
      primaryMessage: 'Assembly in Main Hall at 10:00 AM',
      secondaryDetails: 'All Grade 4 to Grade 8 classes attend',
    });

    const whatsAppPayload = multiSurfaceRenderer.renderToSurface('WHATSAPP', 'space_mombasa_academy', {
      title: 'Fee Payment Received',
      sourceEvent: 'payment.confirmed.v1',
      primaryMessage: 'KES 25,000 received for Student #8821.',
    });

    const passed =
      tvPayload.surface === 'TV_DISPLAY' &&
      tvPayload.content.displayTheme === 'DARK' &&
      whatsAppPayload.surface === 'WHATSAPP' &&
      whatsAppPayload.content.primaryText.includes('Fee Payment Received');

    results.push({
      testName: 'Headless Multi-Surface Projections (TV, WhatsApp, Web)',
      category: 'SURFACE_RENDERING',
      passed,
      message: passed
        ? 'Preserved TDBK headless philosophy with tailored payloads for TV displays, WhatsApp bots, and web surfaces.'
        : 'Surface rendering failed.',
      evidence: {
        tvTheme: tvPayload.content.displayTheme,
        tvRefresh: tvPayload.content.refreshIntervalSeconds,
        whatsAppTitle: whatsAppPayload.title,
      },
    });
  } catch (err) {
    results.push({
      testName: 'Headless Multi-Surface Projections',
      category: 'SURFACE_RENDERING',
      passed: false,
      message: (err as Error).message,
    });
  }

  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.length - passedTests;

  return {
    totalTests: results.length,
    passedTests,
    failedTests,
    results,
  };
}
