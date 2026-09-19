/** TDBK V2 — COMMAND AGENT CONTRACTS */
import { SecurityContext } from '../../kernel/types';

export type AgentAuthority = 'OBSERVE' | 'DIAGNOSE' | 'SAFE_REPAIR' | 'WORKFLOW' | 'BUSINESS' | 'CONNECTOR' | 'ADMIN' | 'MASTER';

export type AgentActionKind =
  | 'INSPECT_PLATFORM'
  | 'INSPECT_DBKS'
  | 'INSPECT_BUSINESS_STATE'
  | 'INSPECT_WORKFLOWS'
  | 'PLAN_SAFE_REPAIR'
  | 'PROVISION_DBK'
  | 'COMPOSE_BUSINESS'
  | 'ACTIVATE_BUSINESS'
  | 'REBUILD_BUSINESS_STATE'
  | 'ENABLE_CAPABILITY'
  | 'DISABLE_CAPABILITY'
  | 'ENSURE_HEADQUARTERS_BRANCH'
  | 'REFRESH_DBK_TOPOLOGY'
  | 'RECOMPILE_WORKSPACE'
  | 'SUSPEND_DBK'
  | 'REACTIVATE_DBK'
  | 'ARCHIVE_DBK'
  | 'RESTORE_DBK'
  | 'RECOVER_WORKFLOWS'
  | 'EXECUTE_WORKFLOW';

export interface AgentInstruction {
  instructionId: string;
  text: string;
  context: SecurityContext;
  requestedAuthority?: AgentAuthority;
}

export interface AgentAction {
  actionId: string;
  kind: AgentActionKind;
  authority: AgentAuthority;
  tenantId?: string;
  workflowId?: string;
  capabilityId?: string;
  legalName?: string;
  blueprintId?: string;
  blueprintVersion?: string;
  subscriptionTier?: 'FREE' | 'FOUNDATION' | 'GROWTH' | 'PRO' | 'ENTERPRISE';
  primaryBranchName?: string;
  description: string;
  requiresAuthorization: boolean;
}

export interface AgentPlan {
  instructionId: string;
  intent: string;
  actions: AgentAction[];
  generatedAt: string;
}

export interface AgentVerification {
  verified: boolean;
  summary: string;
  data?: unknown;
}

export interface AgentActionResult {
  actionId: string;
  status: 'COMPLETED' | 'AUTHORIZATION_REQUIRED' | 'FAILED';
  data?: unknown;
  verification?: AgentVerification;
  error?: string;
}

export interface AgentRunResult {
  instructionId: string;
  plan: AgentPlan;
  results: AgentActionResult[];
  completedAt: string;
}
