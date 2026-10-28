/**
 * TDBK V2 DBK PROVISIONING SERVICE & WORKFLOW ORCHESTRATOR
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Orchestrates server-authoritative DBK provisioning workflows with idempotency and state machine validation.
 */

import { ProvisionDbkRequest, ProvisionDbkResult, DbkIdentity } from '../types';
import { SecurityContext } from '../../kernel/types';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { dbkRegistry } from '../dbkRegistry';
import { branchManager } from '../branch/branchManager';
import { workspaceManager } from '../workspace/workspaceManager';
import { blueprintRegistry } from '../../blueprint/registry';
import { businessDnaManager } from '../../blueprint/dnaManager';
import { entitlementEngine } from '../../capability/entitlement';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { capabilityRegistry } from '../../capability/registry';
import { CapabilityLifecycleState } from '../../capability/types';
import { workflowEngine } from '../../orchestration/workflow/engine';
import { eventBus } from '../../orchestration/events/eventBus';
import { idempotencyRepository } from '../../persistence/firestore/repositories/idempotencyRepository';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { KernelError, AuthorizationError } from '../../kernel/errors/kernelErrors';
import { SectorType } from '../../blueprint/types';

export class ProvisioningService {
  private static instance: ProvisioningService;
  private handlersRegistered = false;

  private constructor() {
    this.registerProvisioningStepHandlers();
  }

  public static getInstance(): ProvisioningService {
    if (!ProvisioningService.instance) {
      ProvisioningService.instance = new ProvisioningService();
    }
    return ProvisioningService.instance;
  }

  public clearStoreForTesting(): void {
    this.handlersRegistered = false;
    this.registerProvisioningStepHandlers();
  }

  /**
   * Registers all step handlers required for the DBK provisioning workflow.
   */
  private registerProvisioningStepHandlers(): void {
    if (this.handlersRegistered) return;

    // 1. VALIDATE_IDENTITY
    workflowEngine.registerStepHandler('PROVISIONING_VALIDATE_IDENTITY', async ({ input }) => {
      const dbkId = input.dbkId as string;
      const legalName = input.legalName as string;

      if (!dbkId || !legalName) {
        return {
          success: false,
          error: 'Validation failed: dbkId and legalName are mandatory',
          failureClassification: 'PERMANENT',
        };
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(dbkId)) {
        return {
          success: false,
          error: `Invalid dbkId '${dbkId}': only alphanumeric characters, dashes, and underscores allowed`,
          failureClassification: 'PERMANENT',
        };
      }

      return { success: true, output: { validated: true } };
    });

    // 2. VALIDATE_BLUEPRINT
    workflowEngine.registerStepHandler('PROVISIONING_VALIDATE_BLUEPRINT', async ({ input }) => {
      const blueprintId = input.blueprintId as string;
      const blueprintVersion = input.blueprintVersion as string | undefined;

      const bp = blueprintRegistry.getBlueprint(blueprintId, blueprintVersion);
      if (!bp) {
        return {
          success: false,
          error: `Blueprint '${blueprintId}' ${blueprintVersion ? `version '${blueprintVersion}' ` : ''}is not registered`,
          failureClassification: 'PERMANENT',
        };
      }

      return {
        success: true,
        output: {
          blueprintId: bp.id,
          blueprintVersion: bp.version,
          sector: bp.sector,
        },
      };
    });

    // Helper for mock master context during provisioning steps
    const createStepContext = (workflow: any, dbkId: string): SecurityContext => ({
      requestId: `req_${workflow.workflowId}`,
      timestamp: new Date().toISOString(),
      principal: {
        id: 'usr_master_provisioner',
        tenantId: dbkId,
        branchId: null,
        roles: ['TDBK_MASTER_ADMIN'],
        permissions: ['*'],
        authTime: Date.now(),
        tokenSource: 'SERVICE_KEY',
        isMaster: true,
      },
      tenantContext: {
        tenantId: dbkId,
        name: dbkId,
        blueprintId: 'provisioning',
        status: 'PROVISIONING',
      },
      branchContext: null,
      correlationId: workflow.correlationId,
    });

    // 3. INITIALIZE_DNA
    workflowEngine.registerStepHandler('PROVISIONING_INITIALIZE_DNA', async ({ input, workflow }) => {
      const dbkId = input.dbkId as string;
      const legalName = input.legalName as string;
      const blueprintId = input.blueprintId as string;
      const blueprintVersion = input.blueprintVersion as string | undefined;

      const mockCtx = createStepContext(workflow, dbkId);

      try {
        const dna = await businessDnaManager.bindBlueprintToDbkPersistent(
          mockCtx,
          dbkId,
          legalName,
          blueprintId,
          blueprintVersion
        );
        return { success: true, output: { dbkId: dna.dbkId, sector: dna.identity.businessType } };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Failed to initialize Business DNA',
          failureClassification: 'PERMANENT',
        };
      }
    });

    // 4. ASSIGN_ENTITLEMENT
    workflowEngine.registerStepHandler('PROVISIONING_ASSIGN_ENTITLEMENT', async ({ input }) => {
      const dbkId = input.dbkId as string;
      const tier = (input.subscriptionTier as any) || 'FOUNDATION';

      // Subscription tier is already persisted on the authoritative DBK identity.
      // Do not create a second process-local entitlement authority here.
      const durableDbk = await dbkRegistry.getDbkInternal(dbkId);
      if (!durableDbk || durableDbk.subscriptionTier !== tier) {
        return { success: false, error: 'Durable DBK subscription tier does not match provisioning request', failureClassification: 'PERMANENT' };
      }
      return { success: true, output: { subscriptionTier: tier } };
    });

    // 5. INITIALIZE_CAPABILITIES
    workflowEngine.registerStepHandler('PROVISIONING_INITIALIZE_CAPABILITIES', async ({ input, workflow }) => {
      const dbkId = input.dbkId as string;
      const sector = input.sector as SectorType;
      const tier = (input.subscriptionTier as any) || 'FOUNDATION';
      const blueprintId = input.blueprintId as string | undefined;
      const blueprintVersion = input.blueprintVersion as string | undefined;

      const mockCtx = createStepContext(workflow, dbkId);

      const bp = blueprintId ? blueprintRegistry.getBlueprint(blueprintId, blueprintVersion) : undefined;
      const defaultCapIds = new Set(
        bp?.supportedCapabilities?.filter((sc) => sc.isDefault).map((sc) => sc.id) || []
      );
      const bpSupportedCapIds = new Set(
        bp?.supportedCapabilities?.map((sc) => sc.id) || []
      );

      const allCapabilities = capabilityRegistry.getAllCapabilities();
      const compatible = allCapabilities.filter(
        (c) =>
          (c.supportedBlueprints as string[]).includes('ALL') ||
          (c.supportedBlueprints as string[]).includes(sector) ||
          bpSupportedCapIds.has(c.capabilityId)
      );

      let initializedCount = 0;
      for (const cap of compatible) {
        const isEntitled = entitlementEngine.isTierSatisfied(tier, cap.entitlementRequirements.minimumTier);
        const isDefaultInBp = defaultCapIds.has(cap.capabilityId);

        let state: CapabilityLifecycleState = 'DISCOVERABLE';
        if (isEntitled) {
          if (isDefaultInBp || !cap.configurationSchema.requiresConfiguration) {
            state = 'ENABLED';
          } else {
            state = 'CONFIGURED';
          }
        }

        // Capability state is business truth. Provisioning must not report
        // success until the initialized record is durably committed.
        const record = dbkCapabilityManager.saveDbkCapabilityRecord(mockCtx, {
          dbkId,
          capabilityId: cap.capabilityId,
          capabilityVersion: cap.version,
          state: cap.lifecycleStatus === 'SUSPENDED' ? 'SUSPENDED' : state,
          configurationState: {
            isConfigured: isDefaultInBp || !cap.configurationSchema.requiresConfiguration,
          },
          entitlement: isEntitled ? 'ENTITLED' : 'UPGRADE_REQUIRED',
          updatedAt: new Date().toISOString(),
        });
        await dbkCapabilityManager.persistCapabilityRecord(mockCtx, record);
        initializedCount++;
      }

      return { success: true, output: { initializedCapabilities: initializedCount } };
    });

    // 6. INITIALIZE_BRANCH_TOPOLOGY
    workflowEngine.registerStepHandler('PROVISIONING_INITIALIZE_BRANCHES', async ({ input, workflow }) => {
      const dbkId = input.dbkId as string;
      const primaryBranchName = (input.primaryBranchName as string) || 'Headquarters';
      const secondaryBranches = (input.secondaryBranches as any[]) || [];
      const secondaryIds = new Set<string>();
      for (const sb of secondaryBranches) {
        if (!sb?.branchId || secondaryIds.has(sb.branchId)) {
          return { success: false, error: `Duplicate or missing secondary branch ID '${sb?.branchId || ''}' in provisioning request`, failureClassification: 'PERMANENT' };
        }
        secondaryIds.add(sb.branchId);
      }

      const mockCtx = createStepContext(workflow, dbkId);

      // Create HQ branch
      const hq = await branchManager.createHeadquartersBranch(mockCtx, dbkId, primaryBranchName);
      const branches = [hq];

      // Create secondary branches
      for (const sb of secondaryBranches) {
        const branch = await branchManager.createSecondaryBranch(mockCtx, dbkId, sb);
        branches.push(branch);
      }

      return { success: true, output: { branchCount: branches.length, branches } };
    });

    // 7. CREATE_WORKSPACE_STATE
    workflowEngine.registerStepHandler('PROVISIONING_CREATE_WORKSPACE_STATE', async ({ input, workflow }) => {
      const dbkId = input.dbkId as string;
      const mockCtx = createStepContext(workflow, dbkId);

      try {
        const workspace = await workspaceManager.compileWorkspaceState(mockCtx, dbkId);
        return { success: true, output: { workspaceVersion: workspace.workspaceVersion } };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Failed to compile workspace state',
          failureClassification: 'PERMANENT',
        };
      }
    });

    // 8. VERIFY_AND_ACTIVATE
    workflowEngine.registerStepHandler('PROVISIONING_VERIFY_AND_ACTIVATE', async ({ input, workflow }) => {
      const dbkId = input.dbkId as string;
      const mockCtx = createStepContext(workflow, dbkId);

      await dbkRegistry.updateStatus(mockCtx, dbkId, 'ACTIVE', 'Provisioning completed successfully');
      return { success: true, output: { status: 'ACTIVE' } };
    });

    this.handlersRegistered = true;
  }

  /**
   * Authoritative DBK Provisioning Flow.
   * AUTHORIZED: TDBK MASTER ADMIN or Business Owner portfolio authority.
   */
  public async provisionDbk(context: SecurityContext, request: ProvisionDbkRequest): Promise<ProvisionDbkResult> {
    this.registerProvisioningStepHandlers();
    // 1. Security Assertion: Authorized Business Owner or Master Admin can provision DBKs
    masterAuthority.assertOwnerOrMasterAuthority(context.principal, 'provisionDbk', context.requestId);

    // Business Owners may provision FREE or FOUNDATION tier DBKs. Commercial paid
    // tiers (GROWTH, PRO, ENTERPRISE) require TDBK Master authority to prevent
    // unauthorized entitlement grants.
    const PAID_COMMERCIAL_TIERS = new Set(['GROWTH', 'PRO', 'ENTERPRISE']);
    if (
      !masterAuthority.isMasterAdmin(context.principal) &&
      request.subscriptionTier &&
      PAID_COMMERCIAL_TIERS.has(request.subscriptionTier)
    ) {
      throw new AuthorizationError(
        'Business Owners may only provision FREE or FOUNDATION-tier DBKs. Paid subscription tiers (GROWTH, PRO, ENTERPRISE) require TDBK Master commercial authority.',
        context.requestId
      );
    }

    const correlationId = request.correlationId || context.correlationId || `corr_prov_${request.dbkId}_${Date.now()}`;
    const idempotencyKey = request.idempotencyKey || `idem_${request.dbkId}`;

    // 2. Validate Blueprint before claiming the durable provisioning idempotency key.
    // This prevents invalid requests from consuming a retry key.
    const bp = blueprintRegistry.getBlueprint(request.blueprintId, request.blueprintVersion);
    if (!bp) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        context.principal.id,
        'DBK_PROVISIONING_INVALID_BLUEPRINT',
        `blueprint:${request.blueprintId}`,
        'DENIED',
        {
          tenantId: request.dbkId,
          requestId: context.requestId,
          details: { error: `Blueprint '${request.blueprintId}' not found` },
        }
      );
      throw new KernelError(
        'VALIDATION_ERROR',
        `Invalid Blueprint: Blueprint '${request.blueprintId}' is not registered`,
        400,
        context.requestId
      );
    }

    // 3. Atomically claim the provisioning request. Firestore is authoritative;
    // there is no process-local idempotency authority to lose on restart.
    const claim = await idempotencyRepository.claimIdempotencyRecord(request.dbkId, idempotencyKey, {
      idempotencyKey,
      tenantId: request.dbkId,
      action: 'DBK_PROVISIONING',
      requestHash: `${request.dbkId}:${bp.id}:${bp.version}`,
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    if (claim === 'COMPLETED') {
      const completed = await idempotencyRepository.getIdempotencyRecord(request.dbkId, idempotencyKey);
      if (completed?.responsePayload) {
        const cached = completed.responsePayload as unknown as ProvisionDbkResult;
        return { ...cached, isIdempotentReplay: true };
      }
    }

    if (claim === 'IN_PROGRESS') {
      throw new KernelError(
        'CONFLICT',
        `Provisioning request '${idempotencyKey}' is already in progress`,
        409,
        context.requestId
      );
    }

    try {
    // 4. Prevent duplicate creation; allow recovery from PROVISIONING_FAILED.
    let initialDbk: DbkIdentity;
    const existingDbk = (await dbkRegistry.hasDbk(request.dbkId))
      ? await dbkRegistry.getDbk(context, request.dbkId)
      : undefined;

    if (existingDbk) {
      if (existingDbk.status !== 'PROVISIONING_FAILED') {
        throw new KernelError(
          'CONFLICT',
          `DBK with ID '${request.dbkId}' already exists in state '${existingDbk.status}'`,
          409,
          context.requestId
        );
      }
      // Recovery path: reset status to PROVISIONING using the authoritative recovery
      // primitive. The existing identity (legalName, blueprintId, tier, etc.) is
      // preserved — only the lifecycle state is reset.
      initialDbk = await dbkRegistry.beginProvisioningRecovery(
        context,
        request.dbkId,
        'Provisioning recovery initiated'
      );
    } else {
      // 5. Create DBK in PROVISIONING state
      initialDbk = {
        dbkId: request.dbkId,
        legalName: request.legalName,
        displayName: request.displayName || request.legalName,
        sector: bp.sector,
        blueprintId: bp.id,
        blueprintVersion: bp.version,
        subscriptionTier: request.subscriptionTier || 'FOUNDATION',
        status: 'PROVISIONING',
        masterOwner: context.principal.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: context.principal.id,
        configurationVersion: 1,
        workspaceVersion: 1,
        branchTopology: [],
        lifecycleHistory: [
          {
            transitionId: `trans_init_${Date.now()}`,
            fromStatus: 'PROVISIONING',
            toStatus: 'PROVISIONING',
            actorId: context.principal.id,
            actorRole: context.principal.roles[0] || 'TDBK_MASTER_ADMIN',
            timestamp: new Date().toISOString(),
            reason: 'Provisioning initiated',
            correlationId,
          },
        ],
        metadata: request.customPreferences || {},
      };

      await dbkRegistry.saveDbk(context, initialDbk);

      auditLogger.logEvent(
        'SECURITY_CONFIGURATION_CHANGE',
        context.principal.id,
        'DBK_CREATED',
        `dbk:${request.dbkId}`,
        'ALLOWED',
        {
          tenantId: request.dbkId,
          requestId: context.requestId,
          details: {
            blueprintId: bp.id,
            subscriptionTier: initialDbk.subscriptionTier,
            correlationId,
          },
        }
      );
    }

    // 6. Emit DBK_PROVISIONING_REQUESTED (fires for both new provisioning and recovery)
    eventBus.publishEvent(
      context,
      'dbk.provisioning_requested.v1',
      {
        dbkId: request.dbkId,
        blueprintId: bp.id,
        sector: bp.sector,
        subscriptionTier: initialDbk.subscriptionTier,
        correlationId,
      },
      'v1.0'
    );

    // 7. Define & Execute Provisioning Workflow using Phase 3 Engine
    const workflowSteps = [
      {
        stepId: 'step_1_validate_identity',
        stepType: 'PROVISIONING_VALIDATE_IDENTITY',
        input: { dbkId: request.dbkId, legalName: request.legalName },
      },
      {
        stepId: 'step_2_validate_blueprint',
        stepType: 'PROVISIONING_VALIDATE_BLUEPRINT',
        input: { blueprintId: request.blueprintId, blueprintVersion: request.blueprintVersion },
      },
      {
        stepId: 'step_3_init_dna',
        stepType: 'PROVISIONING_INITIALIZE_DNA',
        input: {
          dbkId: request.dbkId,
          legalName: request.legalName,
          blueprintId: bp.id,
          blueprintVersion: bp.version,
        },
      },
      {
        stepId: 'step_4_assign_entitlement',
        stepType: 'PROVISIONING_ASSIGN_ENTITLEMENT',
        input: { dbkId: request.dbkId, subscriptionTier: initialDbk.subscriptionTier },
      },
      {
        stepId: 'step_5_init_capabilities',
        stepType: 'PROVISIONING_INITIALIZE_CAPABILITIES',
        input: {
          dbkId: request.dbkId,
          sector: bp.sector,
          subscriptionTier: initialDbk.subscriptionTier,
          blueprintId: bp.id,
          blueprintVersion: bp.version,
        },
      },
      {
        stepId: 'step_6_init_branches',
        stepType: 'PROVISIONING_INITIALIZE_BRANCHES',
        input: {
          dbkId: request.dbkId,
          primaryBranchName: request.primaryBranchName,
          secondaryBranches: request.secondaryBranches,
        },
      },
      {
        stepId: 'step_7_create_workspace',
        stepType: 'PROVISIONING_CREATE_WORKSPACE_STATE',
        input: { dbkId: request.dbkId },
      },
      {
        stepId: 'step_8_activate',
        stepType: 'PROVISIONING_VERIFY_AND_ACTIVATE',
        input: { dbkId: request.dbkId },
      },
    ];

    const workflowCtx: SecurityContext = {
      ...context,
      tenantContext: {
        tenantId: request.dbkId,
        name: request.legalName,
        blueprintId: bp.id,
        status: 'PROVISIONING',
      },
      correlationId,
    };

    const workflowInstance = await workflowEngine.createPersistentWorkflow(
      workflowCtx,
      'DBK_PROVISIONING',
      'v1.0',
      workflowSteps,
      { dbkId: request.dbkId, blueprintId: bp.id }
    );

    const executedWorkflow = await workflowEngine.executeWorkflow(workflowCtx, workflowInstance.workflowId);

    if (executedWorkflow.status !== 'COMPLETED') {
      // Provisioning Failed
      await dbkRegistry.updateStatus(
        context,
        request.dbkId,
        'PROVISIONING_FAILED',
        executedWorkflow.failureReason || 'Provisioning workflow failed'
      );

      eventBus.publishEvent(
        context,
        'dbk.provisioning_failed.v1',
        {
          dbkId: request.dbkId,
          workflowId: executedWorkflow.workflowId,
          error: executedWorkflow.failureReason,
          correlationId,
        },
        'v1.0'
      );

      auditLogger.logEvent(
        'SECURITY_CONFIGURATION_CHANGE',
        context.principal.id,
        'DBK_PROVISIONING_FAILED',
        `dbk:${request.dbkId}`,
        'ERROR',
        {
          tenantId: request.dbkId,
          requestId: context.requestId,
          details: { error: executedWorkflow.failureReason, workflowId: executedWorkflow.workflowId },
        }
      );

      // Release the durable idempotency claim as a failed attempt so an
      // operator can safely retry provisioning without waiting for claim expiry.
      await idempotencyRepository.failIdempotencyRecord(request.dbkId, idempotencyKey, {
        error: executedWorkflow.failureReason || 'Provisioning workflow failed',
        workflowId: executedWorkflow.workflowId,
      });

      return {
        success: false,
        dbkId: request.dbkId,
        status: 'PROVISIONING_FAILED',
        workflowId: executedWorkflow.workflowId,
        blueprintId: bp.id,
        blueprintVersion: bp.version,
        subscriptionTier: initialDbk.subscriptionTier,
        branches: [],
        workspaceVersion: 1,
        error: executedWorkflow.failureReason || 'Workflow execution failed',
        correlationId,
      };
    }

    // 8. Provisioning Succeeded
    const finalDbk = (await dbkRegistry.getDbkInternal(request.dbkId))!;
    const branches = await branchManager.listPersistentBranches(context, request.dbkId);
    finalDbk.branchTopology = branches;
    await dbkRegistry.saveDbk(context, finalDbk);

    eventBus.publishEvent(
      context,
      'dbk.provisioning_completed.v1',
      {
        dbkId: request.dbkId,
        workflowId: executedWorkflow.workflowId,
        blueprintId: bp.id,
        branchesCount: branches.length,
        correlationId,
      },
      'v1.0'
    );

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      'DBK_PROVISIONED',
      `dbk:${request.dbkId}`,
      'ALLOWED',
      {
        tenantId: request.dbkId,
        requestId: context.requestId,
        details: {
          branchesCount: branches.length,
          workflowId: executedWorkflow.workflowId,
          subscriptionTier: finalDbk.subscriptionTier,
        },
      }
    );

    // Keep the legacy entitlement cache warm for synchronous test/UI compatibility.
    // Durable DBK identity remains the production authority.
    entitlementEngine.setDbkSubscriptionTier(request.dbkId, finalDbk.subscriptionTier);

    const result: ProvisionDbkResult = {
      success: true,
      dbkId: request.dbkId,
      status: 'ACTIVE',
      workflowId: executedWorkflow.workflowId,
      blueprintId: bp.id,
      blueprintVersion: bp.version,
      subscriptionTier: finalDbk.subscriptionTier,
      branches,
      workspaceVersion: finalDbk.workspaceVersion,
      correlationId,
    };

    // Persist the completed result before returning success. The in-memory map remains
    // only as a test/latency cache; restart recovery comes from Firestore.
    await idempotencyRepository.saveIdempotencyRecord(request.dbkId, idempotencyKey, {
      idempotencyKey,
      tenantId: request.dbkId,
      action: 'DBK_PROVISIONING',
      requestHash: `${request.dbkId}:${bp.id}:${bp.version}`,
      status: 'COMPLETED',
      responsePayload: result as unknown as Record<string, unknown>,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    });
    return result;
    } catch (err: any) {
      // Any unexpected exception after claiming the durable idempotency key must
      // release the claim as a failed attempt. Otherwise a crash/exception can
      // strand the request in IN_PROGRESS until expiry.
      await idempotencyRepository.failIdempotencyRecord(request.dbkId, idempotencyKey, {
        error: err?.message || 'Unexpected provisioning exception',
        requestId: context.requestId,
        correlationId,
      });
      throw err;
    }
  }
}

export const provisioningService = ProvisioningService.getInstance();
