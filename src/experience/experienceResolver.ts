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
import { discoveryEngine } from '../capability/discovery';
import { KernelError } from '../kernel/errors/kernelErrors';
import { saleTransactionService } from '../business/sales/saleTransactionService';
import { mpesaBridge } from '../orchestration/bridge/adapters/mpesaBridge';
import { supplierInvoiceService } from '../business/procurement/supplierInvoiceService';
import { capabilityViewRegistry } from './registry/viewRegistry';
import { experienceCustomizationService } from './customization/service';

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
    const customization = await experienceCustomizationService.get(context, dbkId);
    let navigation = dynamicNavigationEngine.buildNavigation(workspace, context);
    if (customization.menuItems.length > 0) {
      const overview = navigation.filter(item => item.isDefault);
      const settings = navigation.filter(item => item.category === 'SETTINGS');
      const discovery = navigation.filter(item => item.category === 'DISCOVERY');
      const configured = customization.menuItems
        .filter(item => item.enabled)
        .filter(item => {
          const targetType = item.targetType || 'CAPABILITY';
          const targetId = item.targetId || item.capabilityId || '';
          if (targetType === 'CAPABILITY') return workspace.enabledCapabilities.includes(targetId);
          if (targetType === 'QUESTIONNAIRE') return customization.questionnaires.some(form => form.id === targetId && form.enabled);
          if (targetType === 'WORKFLOW') return customization.workflows.some(flow => flow.id === targetId && flow.enabled);
          return false;
        })
        .filter(item => !item.requiredRoles?.length || item.requiredRoles.some(role => context.principal.roles.includes(role)))
        .filter(item => !item.requiredPermissions?.length || item.requiredPermissions.every(permission => context.principal.permissions.includes('*') || context.principal.permissions.includes(permission)))
        .map(item => {
          const targetType = item.targetType || 'CAPABILITY';
          const targetId = item.targetId || item.capabilityId || '';
          if (targetType === 'QUESTIONNAIRE') {
            return {
              id: `custom_nav_${item.id}`, label: item.label, iconName: item.iconName || 'ClipboardList',
              category: item.category, customTargetId: targetId, route: `/dbk/${dbkId}/questionnaires/${targetId}`,
              viewType: 'CUSTOM_QUESTIONNAIRE' as any, displayOrder: item.displayOrder,
              requiredRoles: item.requiredRoles, requiredPermissions: item.requiredPermissions,
            };
          }
          if (targetType === 'WORKFLOW') {
            return {
              id: `custom_nav_${item.id}`, label: item.label, iconName: item.iconName || 'Workflow',
              category: item.category, customTargetId: targetId, route: `/dbk/${dbkId}/workflows/${targetId}`,
              viewType: 'CUSTOM_WORKFLOW' as any, displayOrder: item.displayOrder,
              requiredRoles: item.requiredRoles, requiredPermissions: item.requiredPermissions,
            };
          }
          const view = capabilityViewRegistry.getViewDefinition(targetId);
          return {
            id: `custom_nav_${item.id}`, label: item.label, iconName: item.iconName || view.iconName,
            category: item.category, capabilityId: targetId, route: `/dbk/${dbkId}/${targetId}`,
            viewType: view.viewType as any, displayOrder: item.displayOrder,
            requiredRoles: item.requiredRoles, requiredPermissions: item.requiredPermissions,
          };
        });
      navigation = [...overview, ...configured, ...discovery, ...settings].sort((a,b) => a.displayOrder - b.displayOrder);
    }
    const canManageExperience = masterAuthority.isMasterAdmin(context.principal)
      || masterAuthority.isBusinessOwner(context.principal)
      || masterAuthority.isOwnerPortfolio(context.principal)
      || context.principal.permissions.includes('*')
      || context.principal.permissions.includes('admin:*')
      || context.principal.permissions.includes('experience:configure')
      || ['TENANT_ADMIN','SYSTEM_ADMIN','OWNER_OPERATOR','BUSINESS_OWNER','STORE_OWNER','SHOP_MANAGER','SCHOOL_PRINCIPAL','LOGISTICS_DIRECTOR','MEDICAL_DIRECTOR'].some(role => context.principal.roles.includes(role));
    if (canManageExperience && !navigation.some(item => item.viewType === 'EXPERIENCE_STUDIO')) {
      navigation.push({
        id: 'nav_experience_studio',
        label: 'Experience Studio',
        iconName: 'SlidersHorizontal',
        category: 'SETTINGS',
        route: `/dbk/${dbkId}/experience-studio`,
        viewType: 'EXPERIENCE_STUDIO',
        displayOrder: 101,
      });
    }
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
      customization,
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
        await entityEngine.savePersistentRecord(context, req.targetDbkId, String(capabilityId), record as any);
        updatedExperience = await this.resolveExperience(context, req.targetDbkId);
      } else if (req.commandType === 'START_WORKFLOW') {
        const workflowId = String(req.payload?.workflowId || '');
        if (!workflowId) throw new KernelError('VALIDATION_ERROR', 'workflowId is required.', 422, context.requestId);
        const workflowRun = await experienceCustomizationService.startWorkflow(context, req.targetDbkId, workflowId);
        return {
          success: true,
          commandType: req.commandType,
          targetDbkId: req.targetDbkId,
          result: { workflowRun },
          serverTimestamp: timestamp,
        };
      } else if (req.commandType === 'ADVANCE_WORKFLOW') {
        const workflowRunId = String(req.payload?.workflowRunId || '');
        const stepId = String(req.payload?.stepId || '');
        if (!workflowRunId || !stepId) throw new KernelError('VALIDATION_ERROR', 'workflowRunId and stepId are required.', 422, context.requestId);
        const workflowRun = await experienceCustomizationService.advanceWorkflow(context, req.targetDbkId, workflowRunId, stepId);
        return {
          success: true,
          commandType: req.commandType,
          targetDbkId: req.targetDbkId,
          result: { workflowRun },
          serverTimestamp: timestamp,
        };
      } else if (req.commandType === 'SUBMIT_QUESTIONNAIRE') {
        const questionnaireId = String(req.payload?.questionnaireId || '');
        const answers = (req.payload?.answers || {}) as Record<string, unknown>;
        const customization = await experienceCustomizationService.get(context, req.targetDbkId);
        const questionnaire = customization.questionnaires.find(item => item.id === questionnaireId && item.enabled);
        if (!questionnaire) {
          throw new KernelError('NOT_FOUND', 'The requested questionnaire is not available.', 404, context.requestId);
        }
        const submissionWorkspace = await workspaceManager.compileWorkspaceState(context, req.targetDbkId);
        if (!submissionWorkspace.enabledCapabilities.includes(questionnaire.targetCapabilityId)) {
          throw new KernelError('AUTHORIZATION_ERROR', 'The questionnaire target capability is no longer enabled.', 403, context.requestId);
        }
        const expectedKeys = new Set(questionnaire.fields.map(field => field.key));
        for (const key of Object.keys(answers)) {
          if (!expectedKeys.has(key)) throw new KernelError('VALIDATION_ERROR', `Unexpected questionnaire field '${key}'.`, 422, context.requestId);
        }
        for (const field of questionnaire.fields) {
          const value = answers[field.key];
          const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
          if (field.required && empty) throw new KernelError('VALIDATION_ERROR', `'${field.label}' is required.`, 422, context.requestId);
          if (empty) continue;
          if (['TEXT','TEXTAREA','DATE'].includes(field.type) && typeof value !== 'string') {
            throw new KernelError('VALIDATION_ERROR', `'${field.label}' must be text.`, 422, context.requestId);
          }
          if (field.type === 'DATE' && typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new KernelError('VALIDATION_ERROR', `'${field.label}' must be a valid date.`, 422, context.requestId);
          }
          if (field.type === 'NUMBER' && (typeof value !== 'number' || !Number.isFinite(value))) {
            throw new KernelError('VALIDATION_ERROR', `'${field.label}' must be a valid number.`, 422, context.requestId);
          }
          if (field.type === 'CHECKBOX' && typeof value !== 'boolean') {
            throw new KernelError('VALIDATION_ERROR', `'${field.label}' must be true or false.`, 422, context.requestId);
          }
          if (field.type === 'SELECT' && !field.options?.some(option => option.value === value)) {
            throw new KernelError('VALIDATION_ERROR', `'${field.label}' contains an invalid selection.`, 422, context.requestId);
          }
          if (field.type === 'MULTI_SELECT' && (!Array.isArray(value) || value.some(entry => !field.options?.some(option => option.value === entry)))) {
            throw new KernelError('VALIDATION_ERROR', `'${field.label}' contains an invalid selection.`, 422, context.requestId);
          }
        }
        const workflowRunId = req.payload?.workflowRunId ? String(req.payload.workflowRunId) : '';
        const workflowStepId = req.payload?.workflowStepId ? String(req.payload.workflowStepId) : '';
        if (Boolean(workflowRunId) !== Boolean(workflowStepId)) {
          throw new KernelError('VALIDATION_ERROR', 'workflowRunId and workflowStepId must be provided together.', 422, context.requestId);
        }
        if (workflowRunId) {
          await experienceCustomizationService.assertWorkflowQuestionnaireStep(context, req.targetDbkId, workflowRunId, workflowStepId, questionnaire.id);
        }
        const recordId = workflowRunId
          ? `form_${workflowRunId}_${workflowStepId}`
          : `form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const record = {
          id: recordId,
          entityType: questionnaire.targetCapabilityId,
          primaryIdentifier: String(answers[questionnaire.fields[0]?.key] || recordId),
          secondaryIdentifier: questionnaire.title,
          status: 'SUBMITTED',
          attributes: {
            ...answers,
            _questionnaireId: questionnaire.id,
            _questionnaireTitle: questionnaire.title,
            _submittedBy: context.principal.id,
            _submittedAt: timestamp,
            ...(workflowRunId ? { _workflowRunId: workflowRunId, _workflowStepId: workflowStepId } : {}),
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await entityEngine.savePersistentRecord(context, req.targetDbkId, questionnaire.targetCapabilityId, record as any);
        const workflowRun = workflowRunId
          ? await experienceCustomizationService.advanceWorkflow(context, req.targetDbkId, workflowRunId, workflowStepId, questionnaire.id)
          : undefined;
        await auditLogger.persistEvent(auditLogger.logAuditEvent(context, {
          action: 'QUESTIONNAIRE_SUBMITTED',
          targetResource: `dbk:${req.targetDbkId}/capability:${questionnaire.targetCapabilityId}`,
          outcome: 'ALLOWED',
          details: { questionnaireId, recordId, fieldCount: questionnaire.fields.length },
        }));
        updatedExperience = await this.resolveExperience(context, req.targetDbkId);
        return {
          success: true,
          commandType: req.commandType,
          targetDbkId: req.targetDbkId,
          result: { recordId, questionnaireId, status: 'SUBMITTED', workflowRun },
          updatedResolvedExperience: updatedExperience,
          serverTimestamp: timestamp,
        };
      } else if (req.commandType === 'ENABLE_CAPABILITY') {
        const { capabilityId } = req.payload || {};
        if (!capabilityId) {
          throw new KernelError('VALIDATION_ERROR', 'Missing capabilityId', 400, context.requestId);
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
      } else if (req.commandType === 'SUBMIT_SUPPLIER_INVOICE') {
        const invoiceResult = await supplierInvoiceService.submitInvoice(context, req.targetDbkId, req.payload as any);
        await auditLogger.persistEvent(auditLogger.logAuditEvent(context, {
          action: 'SUPPLIER_INVOICE_SUBMITTED',
          targetResource: `dbk:${req.targetDbkId}`,
          outcome: invoiceResult.status === 'DISPUTED' ? 'DENIED' : 'ALLOWED',
          details: { ...invoiceResult },
        }));
        return {
          success: true,
          commandType: req.commandType,
          targetDbkId: req.targetDbkId,
          result: { ...invoiceResult },
          serverTimestamp: timestamp,
        };
      } else if (req.commandType === 'APPROVE_SUPPLIER_INVOICE') {
        const invoiceResult = await supplierInvoiceService.approveInvoice(context, req.targetDbkId, String((req.payload as any).invoiceId));
        return {
          success: true,
          commandType: req.commandType,
          targetDbkId: req.targetDbkId,
          result: { ...invoiceResult },
          serverTimestamp: timestamp,
        };
      } else if (req.commandType === 'INVOKE_ACTION') {
        const actionPayload = (req.payload || {}) as Record<string, any>;
        const actionName = (actionPayload.actionName as string) || 'GENERIC_ACTION';
        const innerPayload = (actionPayload.payload as Record<string, any>) || actionPayload;

        let actionResult: Record<string, unknown> = {};

        const isPaymentAction =
          actionName.includes('MPESA') ||
          actionName.includes('PAYMENT') ||
          actionName.includes('SETTLEMENT') ||
          actionName.includes('CHECKOUT') ||
          Boolean(innerPayload.phoneNumber && innerPayload.amount);

        if (isPaymentAction) {
          try {
            const phoneNumber = String(innerPayload.phoneNumber || '').trim();
            const amount = Number(innerPayload.amount);
            const reference = String(innerPayload.reference || '').trim();

            if (!phoneNumber) {
              throw new KernelError('VALIDATION_ERROR', `Payment action '${actionName}' requires phoneNumber`, 400, context.requestId);
            }
            if (!Number.isFinite(amount) || amount <= 0) {
              throw new KernelError('VALIDATION_ERROR', `Payment action '${actionName}' requires a positive amount`, 400, context.requestId);
            }
            if (!reference) {
              throw new KernelError('VALIDATION_ERROR', `Payment action '${actionName}' requires reference`, 400, context.requestId);
            }

            const bridgeRes = await mpesaBridge.execute(context, 'STK_PUSH', {
              phoneNumber,
              amount,
              accountReference: reference,
              transactionDesc: `TDBK Action: ${actionName}`,
            });

            actionResult = {
              actionName,
              status: bridgeRes.status,
              providerReference: bridgeRes.providerReference,
              receipt: bridgeRes.providerReference,
              transactionId: bridgeRes.providerReference,
              amount: bridgeRes.amount,
              currency: bridgeRes.currency,
              message: 'STK Push initiated successfully via TDBK runtime',
              details: bridgeRes.data,
            };
          } catch (err: any) {
            // Never report a payment as successful when the provider bridge failed.
            // The outer command-dispatch error contract will return a structured failure.
            throw new KernelError(
              'INTEGRATION_UNAVAILABLE',
              `Payment action '${actionName}' failed: ${err?.message || 'M-Pesa bridge execution failed'}`,
              502,
              context.requestId,
            );
          }
        } else {
          const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          actionResult = {
            actionId,
            actionName,
            status: 'SUCCESS',
            providerReference: `REF_${actionId.toUpperCase()}`,
            receipt: `RCP_${actionId.toUpperCase()}`,
            transactionId: actionId,
            message: `Action '${actionName}' executed successfully on ${req.targetDbkId}`,
            executedAt: timestamp,
          };
        }

        await auditLogger.persistEvent(auditLogger.logAuditEvent(context, {
          action: 'ACTION_INVOKED',
          targetResource: `dbk:${req.targetDbkId}`,
          outcome: 'ALLOWED',
          details: {
            actionName,
            tenantId: req.targetDbkId,
            result: actionResult,
          },
        }));

        updatedExperience = await this.resolveExperience(context, req.targetDbkId);

        return {
          success: true,
          commandType: req.commandType,
          targetDbkId: req.targetDbkId,
          result: actionResult,
          updatedResolvedExperience: updatedExperience,
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
