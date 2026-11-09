import type { ExperienceNavCategory } from '../types';

export type QuestionnaireFieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'CHECKBOX';

export interface CustomQuestionnaireField {
  id: string;
  key: string;
  label: string;
  type: QuestionnaireFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface CustomQuestionnaireDefinition {
  id: string;
  title: string;
  description?: string;
  targetCapabilityId: string;
  submitLabel: string;
  fields: CustomQuestionnaireField[];
  enabled: boolean;
}

export type CustomButtonAction =
  | { type: 'NAVIGATE_CAPABILITY'; targetId: string }
  | { type: 'OPEN_QUESTIONNAIRE'; targetId: string }
  | { type: 'START_WORKFLOW'; targetId: string };

export interface CustomActionButton {
  id: string;
  label: string;
  iconName?: string;
  variant: 'PRIMARY' | 'SECONDARY' | 'DANGER';
  action: CustomButtonAction;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  enabled: boolean;
}

export interface CustomMenuItem {
  id: string;
  label: string;
  iconName: string;
  category: ExperienceNavCategory;
  targetType?: 'CAPABILITY' | 'QUESTIONNAIRE' | 'WORKFLOW';
  targetId?: string;
  capabilityId?: string;
  displayOrder: number;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  enabled: boolean;
}

export interface CustomWorkflowStep {
  id: string;
  title: string;
  description?: string;
  assigneeRole?: string;
  questionnaireId?: string;
}

export interface CustomWorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: CustomWorkflowStep[];
  enabled: boolean;
}

export interface ExperienceCustomization {
  dbkId: string;
  version: number;
  menuItems: CustomMenuItem[];
  buttons: CustomActionButton[];
  questionnaires: CustomQuestionnaireDefinition[];
  workflows: CustomWorkflowDefinition[];
  updatedAt: string;
  updatedBy: string;
}

export type ExperienceCustomizationInput = Omit<ExperienceCustomization, 'dbkId' | 'version' | 'updatedAt' | 'updatedBy'> & {
  expectedVersion: number;
};

export type CustomWorkflowRunStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface CustomWorkflowRun {
  runId: string;
  dbkId: string;
  workflowId: string;
  configurationVersion: number;
  workflowSnapshot: CustomWorkflowDefinition;
  questionnaireSnapshots: CustomQuestionnaireDefinition[];
  status: CustomWorkflowRunStatus;
  currentStepIndex: number;
  completedStepIds: string[];
  startedBy: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}
