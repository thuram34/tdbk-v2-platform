import { masterAuthority } from '../../kernel/master/masterAuthority';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { workspaceManager } from '../../platform/workspace/workspaceManager';
import { capabilityRegistry } from '../../capability/registry';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import type { SecurityContext } from '../../kernel/types';
import { experienceCustomizationRepository } from './repository';
import type {
  CustomActionButton,
  CustomMenuItem,
  CustomQuestionnaireDefinition,
  CustomWorkflowDefinition,
  ExperienceCustomization,
  ExperienceCustomizationInput,
  CustomWorkflowRun,
} from './types';

const EMPTY = (dbkId: string): ExperienceCustomization => ({
  dbkId, version: 0, menuItems: [], buttons: [], questionnaires: [], workflows: [],
  updatedAt: new Date(0).toISOString(), updatedBy: 'SYSTEM',
});

const validateAccessRules = (item: { requiredRoles?: string[]; requiredPermissions?: string[] }) => {
  for (const values of [item.requiredRoles, item.requiredPermissions]) {
    if (values !== undefined && (!Array.isArray(values) || values.length > 20 || values.some(value => typeof value !== 'string' || !value.trim() || value.length > 100))) {
      throw new KernelError('VALIDATION_ERROR', 'Role and permission rules must be valid lists of at most 20 entries.', 422);
    }
  }
};

const uniqueIds = (items: Array<{ id: string }>, label: string) => {
  const ids = items.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new KernelError('VALIDATION_ERROR', `Duplicate ${label} IDs are not allowed.`, 422);
};

export class ExperienceCustomizationService {
  private assertCanConfigure(context: SecurityContext, dbkId: string) {
    const principal = context.principal;
    const isPlatformAdmin = masterAuthority.isMasterAdmin(principal) || masterAuthority.isOwnerPortfolio(principal);
    const isBusinessOwner = masterAuthority.isBusinessOwner(principal);
    const allowedRole = ['TENANT_ADMIN', 'SYSTEM_ADMIN', 'OWNER_OPERATOR', 'BUSINESS_OWNER', 'STORE_OWNER', 'SHOP_MANAGER', 'SCHOOL_PRINCIPAL', 'LOGISTICS_DIRECTOR', 'MEDICAL_DIRECTOR'].some(role => principal.roles.includes(role));
    const hasPermission = principal.permissions.includes('*') || principal.permissions.includes('admin:*') || principal.permissions.includes('experience:configure');
    if (!isPlatformAdmin && !isBusinessOwner && !allowedRole && !hasPermission) {
      throw new KernelError('AUTHORIZATION_ERROR', 'You do not have permission to customize this workspace.', 403, context.requestId);
    }
    void dbkId;
  }

  private validate(
    input: ExperienceCustomizationInput,
    enabledCapabilities: string[],
    principal: SecurityContext['principal'],
  ) {
    const menuItems = Array.isArray(input.menuItems) ? input.menuItems : [];
    const buttons = Array.isArray(input.buttons) ? input.buttons : [];
    const forms = Array.isArray(input.questionnaires) ? input.questionnaires : [];
    const workflows = Array.isArray(input.workflows) ? input.workflows : [];

    if (menuItems.length > 30 || buttons.length > 40 || forms.length > 25 || workflows.length > 25) {
      throw new KernelError('VALIDATION_ERROR', 'Customization limit exceeded.', 422);
    }
    uniqueIds(menuItems, 'menu item');
    const menuTargets = menuItems.map(item => `${item.targetType || 'CAPABILITY'}:${item.targetId || item.capabilityId || ''}`);
    if (new Set(menuTargets).size !== menuTargets.length) {
      throw new KernelError('VALIDATION_ERROR', 'A destination can appear only once in the customized menu.', 422);
    }
    uniqueIds(buttons, 'button');
    uniqueIds(forms, 'questionnaire');
    uniqueIds(workflows, 'workflow');

    const requireCapability = (capabilityId: string) => {
      const capability = capabilityRegistry.getCapability(capabilityId);
      if (!capability) {
        throw new KernelError('VALIDATION_ERROR', `Capability '${capabilityId}' is not registered.`, 422);
      }
      if (!enabledCapabilities.includes(capabilityId)) {
        throw new KernelError('VALIDATION_ERROR', `Capability '${capabilityId}' is not enabled for this workspace.`, 422);
      }
      const ownerOverride = masterAuthority.isMasterAdmin(principal) || masterAuthority.isOwnerPortfolio(principal) || masterAuthority.isBusinessOwner(principal);
      if (!ownerOverride) {
        const roleAllowed = capability.requiredRoles.length === 0 || capability.requiredRoles.some(role => principal.roles.includes(role));
        const permissionAllowed = capability.requiredPermissions.length === 0 || capability.requiredPermissions.every(permission => rbacEngine.hasPermission(principal, permission));
        if (!roleAllowed || !permissionAllowed) throw new KernelError('AUTHORIZATION_ERROR', `You cannot configure navigation for capability '${capabilityId}'.`, 403);
      }
    };

    for (const item of menuItems as CustomMenuItem[]) {
      validateAccessRules(item);
      if (!['OVERVIEW','CORE_OPERATIONS','RECORDS','FINANCE','OPERATIONS','DISCOVERY','SETTINGS'].includes(item.category) || typeof item.enabled !== 'boolean' || !item.label?.trim() || item.label.length > 80 || !item.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || (item.iconName?.length || 0) > 50) throw new KernelError('VALIDATION_ERROR', 'Menu items require a valid ID, label (max 80 characters) and icon.', 422);
      const targetType = item.targetType || 'CAPABILITY';
      const targetId = item.targetId || item.capabilityId || '';
      if (targetType === 'CAPABILITY') requireCapability(targetId);
      else if (targetType === 'QUESTIONNAIRE' && !forms.some(form => form.id === targetId && form.enabled)) {
        throw new KernelError('VALIDATION_ERROR', `Menu item references missing questionnaire '${targetId}'.`, 422);
      } else if (targetType === 'WORKFLOW' && !workflows.some(flow => flow.id === targetId && flow.enabled)) {
        throw new KernelError('VALIDATION_ERROR', `Menu item references missing workflow '${targetId}'.`, 422);
      } else if (!['CAPABILITY','QUESTIONNAIRE','WORKFLOW'].includes(targetType)) {
        throw new KernelError('VALIDATION_ERROR', 'Menu item destination type is invalid.', 422);
      }
      if (!Number.isInteger(item.displayOrder) || item.displayOrder < 0) throw new KernelError('VALIDATION_ERROR', 'Menu display order must be a non-negative integer.', 422);
    }

    for (const form of forms as CustomQuestionnaireDefinition[]) {
      if (typeof form.enabled !== 'boolean' || !form.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(form.id) || !form.title?.trim() || form.title.length > 120 || !form.submitLabel?.trim() || form.submitLabel.length > 40 || (form.description?.length || 0) > 500) throw new KernelError('VALIDATION_ERROR', 'Questionnaires require a title (max 120), description (max 500) and submit label (max 40).', 422);
      requireCapability(form.targetCapabilityId);
      if (!Array.isArray(form.fields) || !form.fields.length || form.fields.length > 40) throw new KernelError('VALIDATION_ERROR', 'A questionnaire must contain between 1 and 40 fields.', 422);
      uniqueIds(form.fields, `field in questionnaire '${form.id}'`);
      const keys = form.fields.map(field => field.key);
      if (new Set(keys).size !== keys.length) throw new KernelError('VALIDATION_ERROR', 'Questionnaire field keys must be unique.', 422);
      for (const field of form.fields) {
        if (typeof field.required !== 'boolean' || !['TEXT','TEXTAREA','NUMBER','DATE','SELECT','MULTI_SELECT','CHECKBOX'].includes(field.type)) throw new KernelError('VALIDATION_ERROR', `Unsupported questionnaire field type for '${field.label}'.`, 422);
        if (!field.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(field.id) || !/^[a-z][a-zA-Z0-9_]{0,63}$/.test(field.key) || !field.label?.trim() || field.label.length > 120 || (field.placeholder?.length || 0) > 200 || (field.helpText?.length || 0) > 200) throw new KernelError('VALIDATION_ERROR', 'Questionnaire fields require a valid key and label (max 120 characters).', 422);
        if (['SELECT', 'MULTI_SELECT'].includes(field.type) && (!Array.isArray(field.options) || field.options.length === 0 || field.options.length > 30)) {
          throw new KernelError('VALIDATION_ERROR', `Field '${field.label}' requires between 1 and 30 selectable options.`, 422);
        }
        if (field.options && (field.options.some(option => !option.label?.trim() || option.label.length > 80 || !option.value?.trim() || option.value.length > 80) || new Set(field.options.map(option => option.value)).size !== field.options.length)) {
          throw new KernelError('VALIDATION_ERROR', `Field '${field.label}' has invalid or duplicate options.`, 422);
        }
      }
    }

    for (const workflow of workflows as CustomWorkflowDefinition[]) {
      if (typeof workflow.enabled !== 'boolean' || !workflow.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(workflow.id) || !workflow.name?.trim() || workflow.name.length > 120 || (workflow.description?.length || 0) > 500 || !Array.isArray(workflow.steps) || workflow.steps.length === 0 || workflow.steps.length > 30) {
        throw new KernelError('VALIDATION_ERROR', 'Workflows require a name and between 1 and 30 steps.', 422);
      }
      uniqueIds(workflow.steps, `step in workflow '${workflow.id}'`);
      for (const step of workflow.steps) {
        if (!step.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(step.id) || !step.title?.trim() || step.title.length > 120 || (step.description?.length || 0) > 500 || (step.assigneeRole?.length || 0) > 64) throw new KernelError('VALIDATION_ERROR', 'Workflow steps require a title (max 120 characters).', 422);
        if (step.questionnaireId && !forms.some(form => form.id === step.questionnaireId && form.enabled)) {
          throw new KernelError('VALIDATION_ERROR', `Workflow step references missing questionnaire '${step.questionnaireId}'.`, 422);
        }
      }
    }

    for (const button of buttons as CustomActionButton[]) {
      validateAccessRules(button);
      if (typeof button.enabled !== 'boolean' || !button.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(button.id) || !button.label?.trim() || button.label.length > 80 || (button.iconName?.length || 0) > 50) throw new KernelError('VALIDATION_ERROR', 'Buttons require a label (max 80 characters) and valid icon.', 422);
      if (!['PRIMARY','SECONDARY','DANGER'].includes(button.variant)) throw new KernelError('VALIDATION_ERROR', 'Button variant is invalid.', 422);
      if (!button.action || !['NAVIGATE_CAPABILITY','OPEN_QUESTIONNAIRE','START_WORKFLOW'].includes(button.action.type)) throw new KernelError('VALIDATION_ERROR', 'Button action is invalid.', 422);
      if (button.action.type === 'NAVIGATE_CAPABILITY') requireCapability(button.action.targetId);
      if (button.action.type === 'OPEN_QUESTIONNAIRE' && !forms.some(form => form.id === button.action.targetId && form.enabled)) {
        throw new KernelError('VALIDATION_ERROR', `Button references missing questionnaire '${button.action.targetId}'.`, 422);
      }
      if (button.action.type === 'START_WORKFLOW' && !workflows.some(flow => flow.id === button.action.targetId && flow.enabled)) {
        throw new KernelError('VALIDATION_ERROR', `Button references missing workflow '${button.action.targetId}'.`, 422);
      }
    }
  }

  public async startWorkflow(context: SecurityContext, dbkId: string, workflowId: string): Promise<CustomWorkflowRun> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'START_CUSTOM_WORKFLOW');
    const customization = await experienceCustomizationRepository.get(dbkId);
    const workflow = customization?.workflows.find(item => item.id === workflowId && item.enabled);
    if (!customization || !workflow) throw new KernelError('NOT_FOUND', 'The selected workflow is not available.', 404, context.requestId);
    const questionnaireIds = Array.from(new Set(workflow.steps.map(step => step.questionnaireId).filter((id): id is string => Boolean(id))));
    const questionnaireSnapshots = questionnaireIds.map(id => customization.questionnaires.find(item => item.id === id && item.enabled)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (questionnaireSnapshots.length !== questionnaireIds.length) throw new KernelError('VALIDATION_ERROR', 'A workflow questionnaire is no longer available.', 422, context.requestId);
    const now = new Date().toISOString();
    const run: CustomWorkflowRun = {
      runId: `wfr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      dbkId,
      workflowId,
      configurationVersion: customization.version,
      workflowSnapshot: structuredClone(workflow),
      questionnaireSnapshots: structuredClone(questionnaireSnapshots),
      status: 'IN_PROGRESS',
      currentStepIndex: 0,
      completedStepIds: [],
      startedBy: context.principal.id,
      startedAt: now,
      updatedAt: now,
    };
    await experienceCustomizationRepository.createWorkflowRun(dbkId, run);
    auditLogger.logEvent('WORKFLOW_EXECUTION', context.principal.id, 'CUSTOM_WORKFLOW_STARTED', `dbk:${dbkId}/workflow:${workflowId}`, 'ALLOWED', {
      tenantId: dbkId, requestId: context.requestId, details: { runId: run.runId },
    });
    return run;
  }

  public async assertWorkflowQuestionnaireStep(
    context: SecurityContext,
    dbkId: string,
    runId: string,
    stepId: string,
    questionnaireId: string,
  ): Promise<void> {
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(runId)) throw new KernelError('VALIDATION_ERROR', 'Invalid workflow run ID.', 422, context.requestId);
    await masterAuthority.assertTenantAuthority(context, dbkId, 'SUBMIT_WORKFLOW_QUESTIONNAIRE');
    const run = await experienceCustomizationRepository.getWorkflowRun(dbkId, runId);
    if (!run || run.dbkId !== dbkId || run.status !== 'IN_PROGRESS') throw new KernelError('NOT_FOUND', 'Active workflow run not found.', 404, context.requestId);
    const step = run.workflowSnapshot?.steps[run.currentStepIndex];
    const questionnaire = run.questionnaireSnapshots?.find(item => item.id === questionnaireId && item.enabled);
    if (!step || !questionnaire || step.id !== stepId || step.questionnaireId !== questionnaireId) {
      throw new KernelError('CONFLICT', 'The questionnaire does not match the current workflow step.', 409, context.requestId);
    }
    const privileged = masterAuthority.isMasterAdmin(context.principal) || masterAuthority.isOwnerPortfolio(context.principal) || masterAuthority.isBusinessOwner(context.principal);
    if (step.assigneeRole && !privileged && !context.principal.roles.includes(step.assigneeRole)) {
      throw new KernelError('AUTHORIZATION_ERROR', `This step is assigned to role '${step.assigneeRole}'.`, 403, context.requestId);
    }
  }

  public async advanceWorkflow(
    context: SecurityContext,
    dbkId: string,
    runId: string,
    stepId: string,
    completedQuestionnaireId?: string,
  ): Promise<CustomWorkflowRun> {
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(runId)) throw new KernelError('VALIDATION_ERROR', 'Invalid workflow run ID.', 422, context.requestId);
    await masterAuthority.assertTenantAuthority(context, dbkId, 'ADVANCE_CUSTOM_WORKFLOW');
    const run = await experienceCustomizationRepository.getWorkflowRun(dbkId, runId);
    if (!run || run.dbkId !== dbkId || !run.workflowSnapshot) throw new KernelError('NOT_FOUND', 'Workflow run not found.', 404, context.requestId);
    const workflow = run.workflowSnapshot;
    if (run.status === 'COMPLETED') return run;
    const step = workflow.steps[run.currentStepIndex];
    if (!step || step.id !== stepId) {
      if (run.completedStepIds.includes(stepId)) return run;
      throw new KernelError('CONFLICT', 'This is not the current workflow step.', 409, context.requestId);
    }
    const privileged = masterAuthority.isMasterAdmin(context.principal) || masterAuthority.isOwnerPortfolio(context.principal) || masterAuthority.isBusinessOwner(context.principal);
    if (step.assigneeRole && !privileged && !context.principal.roles.includes(step.assigneeRole)) {
      throw new KernelError('AUTHORIZATION_ERROR', `This step is assigned to role '${step.assigneeRole}'.`, 403, context.requestId);
    }
    if (step.questionnaireId && step.questionnaireId !== completedQuestionnaireId) {
      throw new KernelError('VALIDATION_ERROR', 'Complete the linked questionnaire before advancing this step.', 422, context.requestId);
    }
    if (!step.questionnaireId && completedQuestionnaireId) {
      throw new KernelError('VALIDATION_ERROR', 'This workflow step does not accept a questionnaire submission.', 422, context.requestId);
    }
    const completedStepIds = [...run.completedStepIds, step.id];
    const nextIndex = run.currentStepIndex + 1;
    const now = new Date().toISOString();
    const next: CustomWorkflowRun = {
      ...run,
      completedStepIds,
      currentStepIndex: nextIndex,
      status: nextIndex >= workflow.steps.length ? 'COMPLETED' : 'IN_PROGRESS',
      updatedAt: now,
      ...(nextIndex >= workflow.steps.length ? { completedAt: now } : {}),
    };
    const saved = await experienceCustomizationRepository.advanceWorkflowRun(dbkId, runId, run.currentStepIndex, next);
    auditLogger.logEvent('WORKFLOW_EXECUTION', context.principal.id, 'CUSTOM_WORKFLOW_STEP_COMPLETED', `dbk:${dbkId}/workflow:${workflow.id}`, 'ALLOWED', {
      tenantId: dbkId, requestId: context.requestId, details: { runId, stepId, status: saved.status, currentStepIndex: saved.currentStepIndex },
    });
    return saved;
  }

  public async getWorkflowRun(context: SecurityContext, dbkId: string, runId: string): Promise<CustomWorkflowRun | null> {
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(runId)) throw new KernelError('VALIDATION_ERROR', 'Invalid workflow run ID.', 422, context.requestId);
    await masterAuthority.assertTenantAuthority(context, dbkId, 'READ_CUSTOM_WORKFLOW_RUN');
    const run = await experienceCustomizationRepository.getWorkflowRun(dbkId, runId);
    if (!run || run.dbkId !== dbkId) return null;
    return run;
  }

  public async get(context: SecurityContext, dbkId: string): Promise<ExperienceCustomization> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'READ_EXPERIENCE_CUSTOMIZATION');
    return (await experienceCustomizationRepository.get(dbkId)) || EMPTY(dbkId);
  }

  public async save(context: SecurityContext, dbkId: string, input: ExperienceCustomizationInput): Promise<ExperienceCustomization> {
    if (!input || typeof input !== 'object') throw new KernelError('VALIDATION_ERROR', 'A customization payload is required.', 422, context.requestId);
    await masterAuthority.assertTenantAuthority(context, dbkId, 'WRITE_EXPERIENCE_CUSTOMIZATION');
    this.assertCanConfigure(context, dbkId);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) throw new KernelError('VALIDATION_ERROR', 'expectedVersion must be a non-negative integer.', 422, context.requestId);
    const normalized: ExperienceCustomizationInput = {
      expectedVersion: input.expectedVersion,
      menuItems: Array.isArray(input.menuItems) ? input.menuItems : [],
      buttons: Array.isArray(input.buttons) ? input.buttons : [],
      questionnaires: Array.isArray(input.questionnaires) ? input.questionnaires : [],
      workflows: Array.isArray(input.workflows) ? input.workflows : [],
    };
    const workspace = await workspaceManager.compileWorkspaceState(context, dbkId);
    this.validate(normalized, workspace.enabledCapabilities, context.principal);

    const savedAt = new Date().toISOString();
    const value: ExperienceCustomization = {
      dbkId,
      version: input.expectedVersion + 1,
      menuItems: normalized.menuItems,
      buttons: normalized.buttons,
      questionnaires: normalized.questionnaires,
      workflows: normalized.workflows,
      updatedAt: savedAt,
      updatedBy: context.principal.id,
    };
    const saved = await experienceCustomizationRepository.save(dbkId, value, normalized.expectedVersion);

    auditLogger.logEvent('SECURITY_CONFIGURATION_CHANGE', context.principal.id, 'EXPERIENCE_CUSTOMIZATION_UPDATED', `dbk:${dbkId}`, 'ALLOWED', {
      tenantId: dbkId,
      requestId: context.requestId,
      details: { version: saved.version, menuItems: saved.menuItems.length, buttons: saved.buttons.length, questionnaires: saved.questionnaires.length, workflows: saved.workflows.length },
    });
    return saved;
  }
}

export const experienceCustomizationService = new ExperienceCustomizationService();
