import { masterAuthority } from '../../kernel/master/masterAuthority';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { workspaceManager } from '../../platform/workspace/workspaceManager';
import { capabilityRegistry } from '../../capability/registry';
import type { SecurityContext } from '../../kernel/types';
import { experienceCustomizationRepository } from './repository';
import type {
  CustomActionButton,
  CustomMenuItem,
  CustomQuestionnaireDefinition,
  CustomWorkflowDefinition,
  ExperienceCustomization,
  ExperienceCustomizationInput,
} from './types';

const EMPTY = (dbkId: string): ExperienceCustomization => ({
  dbkId, version: 0, menuItems: [], buttons: [], questionnaires: [], workflows: [],
  updatedAt: new Date(0).toISOString(), updatedBy: 'SYSTEM',
});

const uniqueIds = (items: Array<{ id: string }>, label: string) => {
  const ids = items.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new KernelError('VALIDATION_ERROR', `Duplicate ${label} IDs are not allowed.`, 422);
};

export class ExperienceCustomizationService {
  private assertCanConfigure(context: SecurityContext, dbkId: string) {
    const principal = context.principal;
    const isPlatformAdmin = masterAuthority.isMasterAdmin(principal);
    const isBusinessOwner = masterAuthority.isBusinessOwner(principal);
    const allowedRole = ['TENANT_ADMIN', 'OWNER_OPERATOR', 'BUSINESS_OWNER', 'STORE_OWNER', 'SHOP_MANAGER', 'SCHOOL_PRINCIPAL', 'LOGISTICS_DIRECTOR', 'MEDICAL_DIRECTOR'].some(role => principal.roles.includes(role));
    const hasPermission = principal.permissions.includes('*') || principal.permissions.includes('admin:*') || principal.permissions.includes('experience:configure');
    if (!isPlatformAdmin && !isBusinessOwner && !allowedRole && !hasPermission) {
      throw new KernelError('AUTHORIZATION_ERROR', 'You do not have permission to customize this workspace.', 403, context.requestId);
    }
    void dbkId;
  }

  private validate(
    input: ExperienceCustomizationInput,
    enabledCapabilities: string[],
  ) {
    const menuItems = input.menuItems || [];
    const buttons = input.buttons || [];
    const forms = input.questionnaires || [];
    const workflows = input.workflows || [];

    if (menuItems.length > 30 || buttons.length > 40 || forms.length > 25 || workflows.length > 25) {
      throw new KernelError('VALIDATION_ERROR', 'Customization limit exceeded.', 422);
    }
    uniqueIds(menuItems, 'menu item');
    const menuCapabilityIds = menuItems.map(item => item.capabilityId);
    if (new Set(menuCapabilityIds).size !== menuCapabilityIds.length) {
      throw new KernelError('VALIDATION_ERROR', 'A capability can appear only once in the customized menu.', 422);
    }
    uniqueIds(buttons, 'button');
    uniqueIds(forms, 'questionnaire');
    uniqueIds(workflows, 'workflow');

    const requireCapability = (capabilityId: string) => {
      if (!capabilityRegistry.getCapability(capabilityId)) {
        throw new KernelError('VALIDATION_ERROR', `Capability '${capabilityId}' is not registered.`, 422);
      }
      if (!enabledCapabilities.includes(capabilityId)) {
        throw new KernelError('VALIDATION_ERROR', `Capability '${capabilityId}' is not enabled for this workspace.`, 422);
      }
    };

    for (const item of menuItems as CustomMenuItem[]) {
      if (!item.label?.trim() || !item.id?.trim()) throw new KernelError('VALIDATION_ERROR', 'Menu items require an ID and label.', 422);
      requireCapability(item.capabilityId);
      if (!Number.isInteger(item.displayOrder) || item.displayOrder < 0) throw new KernelError('VALIDATION_ERROR', 'Menu display order must be a non-negative integer.', 422);
    }

    for (const form of forms as CustomQuestionnaireDefinition[]) {
      if (!form.title?.trim() || !form.submitLabel?.trim()) throw new KernelError('VALIDATION_ERROR', 'Questionnaires require a title and submit label.', 422);
      requireCapability(form.targetCapabilityId);
      if (!form.fields.length || form.fields.length > 40) throw new KernelError('VALIDATION_ERROR', 'A questionnaire must contain between 1 and 40 fields.', 422);
      uniqueIds(form.fields, `field in questionnaire '${form.id}'`);
      const keys = form.fields.map(field => field.key);
      if (new Set(keys).size !== keys.length) throw new KernelError('VALIDATION_ERROR', 'Questionnaire field keys must be unique.', 422);
      for (const field of form.fields) {
        if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(field.key) || !field.label?.trim()) throw new KernelError('VALIDATION_ERROR', 'Questionnaire fields require a valid key and label.', 422);
        if (['SELECT', 'MULTI_SELECT'].includes(field.type) && (!field.options || field.options.length === 0)) {
          throw new KernelError('VALIDATION_ERROR', `Field '${field.label}' requires selectable options.`, 422);
        }
      }
    }

    for (const workflow of workflows as CustomWorkflowDefinition[]) {
      if (!workflow.name?.trim() || workflow.steps.length === 0 || workflow.steps.length > 30) {
        throw new KernelError('VALIDATION_ERROR', 'Workflows require a name and between 1 and 30 steps.', 422);
      }
      uniqueIds(workflow.steps, `step in workflow '${workflow.id}'`);
      for (const step of workflow.steps) {
        if (!step.title?.trim()) throw new KernelError('VALIDATION_ERROR', 'Workflow steps require a title.', 422);
        if (step.questionnaireId && !forms.some(form => form.id === step.questionnaireId)) {
          throw new KernelError('VALIDATION_ERROR', `Workflow step references missing questionnaire '${step.questionnaireId}'.`, 422);
        }
      }
    }

    for (const button of buttons as CustomActionButton[]) {
      if (!button.label?.trim()) throw new KernelError('VALIDATION_ERROR', 'Buttons require a label.', 422);
      if (button.action.type === 'NAVIGATE_CAPABILITY') requireCapability(button.action.targetId);
      if (button.action.type === 'OPEN_QUESTIONNAIRE' && !forms.some(form => form.id === button.action.targetId)) {
        throw new KernelError('VALIDATION_ERROR', `Button references missing questionnaire '${button.action.targetId}'.`, 422);
      }
      if (button.action.type === 'START_WORKFLOW' && !workflows.some(flow => flow.id === button.action.targetId)) {
        throw new KernelError('VALIDATION_ERROR', `Button references missing workflow '${button.action.targetId}'.`, 422);
      }
    }
  }

  public async get(context: SecurityContext, dbkId: string): Promise<ExperienceCustomization> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'READ_EXPERIENCE_CUSTOMIZATION');
    return (await experienceCustomizationRepository.get(dbkId)) || EMPTY(dbkId);
  }

  public async save(context: SecurityContext, dbkId: string, input: ExperienceCustomizationInput): Promise<ExperienceCustomization> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'WRITE_EXPERIENCE_CUSTOMIZATION');
    this.assertCanConfigure(context, dbkId);
    const workspace = await workspaceManager.compileWorkspaceState(context, dbkId);
    this.validate(input, workspace.enabledCapabilities);

    const savedAt = new Date().toISOString();
    const value: ExperienceCustomization = {
      dbkId,
      version: input.expectedVersion + 1,
      menuItems: input.menuItems,
      buttons: input.buttons,
      questionnaires: input.questionnaires,
      workflows: input.workflows,
      updatedAt: savedAt,
      updatedBy: context.principal.id,
    };
    const saved = await experienceCustomizationRepository.save(dbkId, value, input.expectedVersion);

    auditLogger.logEvent('SECURITY_CONFIGURATION_CHANGE', context.principal.id, 'EXPERIENCE_CUSTOMIZATION_UPDATED', `dbk:${dbkId}`, 'ALLOWED', {
      tenantId: dbkId,
      requestId: context.requestId,
      details: { version: saved.version, menuItems: saved.menuItems.length, buttons: saved.buttons.length, questionnaires: saved.questionnaires.length, workflows: saved.workflows.length },
    });
    return saved;
  }
}

export const experienceCustomizationService = new ExperienceCustomizationService();
