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
import { auditLogger } from '../../kernel/audit/auditLogger';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { SectorType } from '../../blueprint/types';

export class ProvisioningService {
  private static instance: ProvisioningService;
  // Idempotency store: key -> ProvisionDbkResult
  private idempotencyStore: Map<string, ProvisionDbkResult> = new Map();
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
    this.idempotencyStore.clear();
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
        const dna = businessDnaManager.bindBlueprintToDbk(
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

      entitlementEngine.setDbkSubscriptionTier(dbkId, tier);
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
      compatible.forEach((cap) => {
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

        dbkCapabilityManager.saveDbkCapabilityRecord(mockCtx, {
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
        initializedCount++;
      });

      return { success: true, output: { initializedCapabilities: initializedCount } };
    });

    // 6. INITIALIZE_BRANCH_TOPOLOGY
    workflowEngine.registerStepHandler('PROVISIONING_INITIALIZE_BRANCHES', async ({ input, workflow }) => {
      const dbkId = input.dbkId as string;
      const primaryBranchName = (input.primaryBranchName as string) || 'Headquarters';
      const secondaryBranches = (input.secondaryBranches as any[]) || [];

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

    const correlationId = request.correlationId || context.correlationId || `corr_prov_${request.dbkId}_${Date.now()}`;
    const idempotencyKey = request.idempotencyKey || `idem_${request.dbkId}`;

    // 2. Idempotency Check
    if (this.idempotencyStore.has(idempotencyKey)) {
      const cached = this.idempotencyStore.get(idempotencyKey)!;
      auditLogger.logEvent(
        'AUTHORIZATION_ALLOWED',
        context.principal.id,
        'DBK_PROVISIONING_IDEMPOTENT_REPLAY',
        `dbk:${request.dbkId}`,
        'ALLOWED',
        {
          tenantId: request.dbkId,
          requestId: context.requestId,
          details: { idempotencyKey, originalWorkflowId: cached.workflowId },
        }
      );
      return {
        ...cached,
        isIdempotentReplay: true,
      };
    }

    // 3. Prevent duplicate creation under same dbkId with different keys
    if (await dbkRegistry.hasDbk(request.dbkId)) {
      const existing = await dbkRegistry.getDbk(context, request.dbkId);
      if (existing && existing.status !== 'PROVISIONING_FAILED') {
        throw new KernelError(
          'CONFLICT',
          `DBK with ID '${request.dbkId}' already exists in state '${existing.status}'`,
          409,
          context.requestId
        );
      }
    }

    // 4. Validate Blueprint up front
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

    // 5. Create DBK in PROVISIONING state
    const initialDbk: DbkIdentity = {
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

    // 6. Emit DBK_PROVISIONING_REQUESTED & STARTED
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
    const finalDbk = (await dbkRegistry.getDbk(context, request.dbkId))!;
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

    // Store in idempotency store
    this.idempotencyStore.set(idempotencyKey, result);

    return result;
  }
}

export const provisioningService = ProvisioningService.getInstance();
