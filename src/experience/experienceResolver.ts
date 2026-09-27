import { SecurityContext } from '../kernel/types';
import { DbkBranch } from '../platform/types';
import { workspaceManager } from '../platform/workspace/workspaceManager';
import { dbkRegistry } from '../platform/dbkRegistry';
import { dynamicNavigationEngine } from './navigation/navigationEngine';
import { dashboardComposer } from './dashboard/dashboardComposer';
import { DbkExperienceResolved, ExperienceCommandRequest, ExperienceCommandResponse, ExperienceDiscoveryItem } from './types';
import { masterAuthority } from '../kernel/master/masterAuthority';
import { auditLogger } from '../kernel/audit/auditLogger';
import { entityEngine } from './entity/entityEngine';
import { dbkCapabilityManager } from '../capability/dbkCapabilityManager';
import { capabilityRegistry } from '../capability/registry';
import { rbacEngine } from '../kernel/authorization/rbacEngine';
import { branchAuthority } from '../kernel/branch/branchAuthority';
import { discoveryEngine } from '../capability/discovery';
import { KernelError } from '../kernel/errors/kernelErrors';
import { saleTransactionService } from '../business/sales/saleTransactionService';

export class ExperienceResolver {
  private static instance: ExperienceResolver;

  private constructor() {}

  public static getInstance(): ExperienceResolver {
    if (!ExperienceResolver.instance) {
      ExperienceResolver.instance = new ExperienceResolver();
    }
    return ExperienceResolver.instance;
  }

  public async resolveExperience(context: SecurityContext, dbkId: string, requestedBranchId?: string): Promise<DbkExperienceResolved> {
    // 1. Assert tenant access
    await masterAuthority.assertTenantAuthority(context, dbkId, 'resolveExperience');

    // 2. Compile workspace state
    const workspace = await workspaceManager.compileWorkspaceState(context, dbkId);
    const dbkRecord = await dbkRegistry.getDbkInternal(dbkId);

    // 3. Resolve active branch
    const branchCtxId = requestedBranchId || context.branchContext?.branchId || (context as any).branchId;
    let activeBranch: DbkBranch | undefined = workspace.activeBranches.find((b) => b.branchId === branchCtxId);
    if (!activeBranch) {
      activeBranch = workspace.activeBranches.find((b) => b.isHeadquarters) || workspace.activeBranches[0];
    }
    if (!activeBranch) {
      throw new KernelError('NOT_FOUND', `DBK '${dbkId}' has no persisted active branch`, 404, context.requestId);
    }

    // 4. Build navigation & dashboard
    const navigation = dynamicNavigationEngine.buildNavigation(workspace, context);
    const dashboardWidgets = dashboardComposer.composeDashboard(workspace);

    // 5. Build discovery items
    const discoverySurface = await discoveryEngine.discoverPersistentCapabilitiesForDbk(context, dbkId);
    const discoveryItems: ExperienceDiscoveryItem[] = discoverySurface.items.map((item) => {
      const cap = item.capability;
      const isEnabled = workspace.enabledCapabilities.includes(cap.capabilityId);
      let status: 'OPERATIONAL' | 'DISCOVERABLE' | 'UPGRADE_REQUIRED' | 'CONFIGURATION_REQUIRED' | 'SUSPENDED' =
        'DISCOVERABLE';

      if (isEnabled) {
        status = 'OPERATIONAL';
      } else if (item.rejectionReason === 'UPGRADE_REQUIRED' || item.entitlementStatus === 'UPGRADE_REQUIRED') {
        status = 'UPGRADE_REQUIRED';
      } else if (item.rejectionReason === 'CONFIGURATION_REQUIRED') {
        status = 'CONFIGURATION_REQUIRED';
      } else if (item.rejectionReason === 'SUSPENDED') {
        status = 'SUSPENDED';
      }

      return {
        capabilityId: cap.capabilityId,
        name: cap.name,
        category: cap.category,
        description: cap.description,
        minimumTier: cap.entitlementRequirements.minimumTier,
        isEntitled: item.entitlementStatus === 'ENTITLED' || isEnabled,
        isEnabled,
        status,
        iconName: cap.category === 'FINANCE' ? 'DollarSign' : cap.category === 'INVENTORY' ? 'Package' : 'Sparkles',
      };
    });

    const resolved: DbkExperienceResolved = {
      dbkId: workspace.dbkId,
      legalName: dbkRecord?.legalName || workspace.displayName,
      displayName: workspace.displayName,
      sector: workspace.sector,
      status: workspace.status,
      subscriptionTier: workspace.subscriptionTier,
      workspaceVersion: workspace.workspaceVersion,
      configurationVersion: workspace.configurationVersion,
      activeBranch: {
        branchId: activeBranch.branchId,
        name: activeBranch.name,
        isHeadquarters: activeBranch.isHeadquarters,
      },
      availableBranches: workspace.activeBranches.map((b) => ({
        branchId: b.branchId,
        name: b.name,
        isHeadquarters: b.isHeadquarters,
      })),
      terminology: workspace.terminology,
      navigation,
      dashboardWidgets,
      discoveryItems,
      connections: workspace.connections,
      currentPrincipal: {
        userId: context.principal.id,
        tenantId: context.principal.tenantId,
        roles: context.principal.roles,
        permissions: context.principal.permissions,
        isMaster: masterAuthority.isMasterAdmin(context.principal),
      },
      operationalState: workspace.status === 'ACTIVE' ? 'ACTIVE' : workspace.status === 'ARCHIVED' ? 'ARCHIVED' : 'SUSPENDED',
      serverTimestamp: new Date().toISOString(),
    };

    auditLogger.logEvent(
      'AUTHORIZATION_ALLOWED',
      context.principal.id,
      'EXPERIENCE_RESOLVED',
      `dbk:${dbkId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        branchId: activeBranch.branchId,
        requestId: context.requestId,
      }
    );

    return resolved;
  }

  public async dispatchCommand(context: SecurityContext, req: ExperienceCommandRequest): Promise<ExperienceCommandResponse> {
    const timestamp = new Date().toISOString();
    try {
      await masterAuthority.assertTenantAuthority(context, req.targetDbkId, 'dispatchCommand');

      let updatedExperience: DbkExperienceResolved | undefined;

      if (req.commandType === 'SWITCH_BRANCH') {
        const branchId = req.payload?.branchId as string;
        const workspace = await workspaceManager.compileWorkspaceState(context, req.targetDbkId);
        await branchAuthority.assertPersistentBranchContext(
          context.principal,
          req.targetDbkId,
          branchId,
          'SWITCH_BRANCH',
          context.requestId,
        );
        const branchExists = workspace.activeBranches.some((b) => b.branchId === branchId);
        if (!branchExists) {
          throw new KernelError('VALIDATION_ERROR', `Branch '${branchId}' not found on DBK '${req.targetDbkId}'`, 404, context.requestId);
        }
        updatedExperience = await this.resolveExperience(context, req.targetDbkId, branchId);
      } else if (req.commandType === 'SUBMIT_ENTITY') {
        const { capabilityId, record } = req.payload || {};
        if (!capabilityId || !record) {
          throw new KernelError('VALIDATION_ERROR', 'Missing capabilityId or record payload', 400, context.requestId);
        }
        const cap = capabilityRegistry.getCapability(String(capabilityId));
        const ownerOverride = masterAuthority.isMasterAdmin(context.principal) || masterAuthority.isOwnerPortfolio(context.principal);
        if (cap && !ownerOverride) {
          const roleAllowed = cap.requiredRoles.length === 0 || cap.requiredRoles.some((role) => context.principal.roles.includes(role));
          const permissionAllowed = cap.requiredPermissions.length === 0 || cap.requiredPermissions.every((permission) => rbacEngine.hasPermission(context.principal, permission));
          if (!roleAllowed || !permissionAllowed) {
            throw new KernelError('AUTHORIZATION_ERROR', 'You are not authorized to operate this capability.', 403, context.requestId);
          }
        }
        await entityEngine.savePersistentRecord(context, req.targetDbkId, String(capabilityId), record as any);
        updatedExperience = await this.resolveExperience(context, req.targetDbkId);
      } else if (req.commandType === 'ENABLE_CAPABILITY') {
        const { capabilityId } = req.payload || {};
        if (!capabilityId) {
          throw new KernelError('VALIDATION_ERROR', 'Missing capabilityId', 400, context.requestId);
        }
        const ownerOverride = masterAuthority.isMasterAdmin(context.principal) || masterAuthority.isOwnerPortfolio(context.principal);
        if (!ownerOverride && !context.principal.roles.some((role) => ['TENANT_ADMIN', 'SYSTEM_ADMIN'].includes(role)) && !rbacEngine.hasPermission(context.principal, 'admin:*')) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Capability administration requires tenant administrator authority.', 403, context.requestId);
        }
        const enabled = await dbkCapabilityManager.enableCapabilityPersistent(
          context,
          req.targetDbkId,
          String(capabilityId),
          'ENTITLED',
          false
        );
        await workspaceManager.incrementWorkspaceVersion(context, req.targetDbkId);
        updatedExperience = await this.resolveExperience(context, req.targetDbkId);
      } else if (req.commandType === 'CONFIGURE_CAPABILITY') {
        const { capabilityId, configData } = req.payload || {};
        if (!capabilityId) {
          throw new KernelError('VALIDATION_ERROR', 'Missing capabilityId', 400, context.requestId);
        }
        const ownerOverride = masterAuthority.isMasterAdmin(context.principal) || masterAuthority.isOwnerPortfolio(context.principal);
        if (!ownerOverride && !context.principal.roles.some((role) => ['TENANT_ADMIN', 'SYSTEM_ADMIN'].includes(role)) && !rbacEngine.hasPermission(context.principal, 'admin:*')) {
          throw new KernelError('AUTHORIZATION_ERROR', 'Capability administration requires tenant administrator authority.', 403, context.requestId);
        }
        await dbkCapabilityManager.configureCapabilityPersistent(
          context,
          req.targetDbkId,
          String(capabilityId),
          (configData as Record<string, unknown>) || {}
        );
        await workspaceManager.incrementWorkspaceVersion(context, req.targetDbkId);
        updatedExperience = await this.resolveExperience(context, req.targetDbkId);
      } else if (req.commandType === 'EXECUTE_SALE') {
        const saleResult = await saleTransactionService.executeSale(
          context,
          req.targetDbkId,
          req.payload as any,
        );

        await auditLogger.persistEvent(auditLogger.logAuditEvent(context, {
          action: 'SALE_EXECUTED',
          targetResource: `dbk:${req.targetDbkId}`,
          outcome: 'ALLOWED',
          details: {
            saleId: saleResult.saleId,
            totalAmountKes: saleResult.totalAmountKes,
            eventId: saleResult.eventId,
            idempotent: saleResult.idempotent,
          },
        }));

        return {
          success: true,
          commandType: req.commandType,
          targetDbkId: req.targetDbkId,
          result: { ...saleResult },
          serverTimestamp: timestamp,
        };
      } else {
        throw new KernelError('VALIDATION_ERROR', `Unknown commandType: '${req.commandType}'`, 400, context.requestId);
      }

      auditLogger.logAuditEvent(context, {
        action: `COMMAND_DISPATCHED:${req.commandType}`,
        targetResource: `dbk:${req.targetDbkId}`,
        outcome: 'ALLOWED',
        details: { tenantId: req.targetDbkId },
      });

      return {
        success: true,
        commandType: req.commandType,
        targetDbkId: req.targetDbkId,
        result: { message: `Successfully executed ${req.commandType}` },
        updatedResolvedExperience: updatedExperience,
        serverTimestamp: timestamp,
      };
    } catch (err: any) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        context.principal.id,
        `COMMAND_FAILED:${req.commandType}`,
        `dbk:${req.targetDbkId}`,
        'DENIED',
        {
          tenantId: req.targetDbkId,
          requestId: context.requestId,
          details: { error: err.message, code: err.code },
        }
      );

      return {
        success: false,
        commandType: req.commandType,
        targetDbkId: req.targetDbkId,
        error: {
          code: err.code || 'COMMAND_EXECUTION_FAILED',
          message: err.message || 'Unknown error during command execution',
        },
        serverTimestamp: timestamp,
      };
    }
  }
}

export const experienceResolver = ExperienceResolver.getInstance();
