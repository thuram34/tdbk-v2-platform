/** TDBK V2 — coordinated specialist workforce.
 * These are governed specialist roles sharing the existing command runtime.
 * A role is not an independently deployed model or a claim of autonomous execution.
 */
import { AgentAuthority, AgentActionKind } from './types';

export type AgentDomain =
  | 'ORCHESTRATION' | 'ENGINEERING' | 'INFRASTRUCTURE' | 'SECURITY'
  | 'FINANCE' | 'REVENUE' | 'SALES' | 'EDUCATION' | 'RETAIL'
  | 'HEALTHCARE' | 'COMPLIANCE' | 'PAYMENTS' | 'LOGISTICS'
  | 'RESEARCH' | 'QUALITY';

export interface SpecialistAgent {
  id: string;
  name: string;
  domain: AgentDomain;
  mission: string;
  supportedActions: AgentActionKind[];
  authorityCeiling: AgentAuthority;
  executionMode: 'COORDINATOR' | 'SHARED_RUNTIME' | 'GOVERNED_ADVISORY';
  requiresHumanApprovalFor: string[];
}

export const TDBK_AGENT_CATALOG: readonly SpecialistAgent[] = [
  { id: 'chief-intelligence', name: 'Chief Intelligence Agent', domain: 'ORCHESTRATION', mission: 'Decompose objectives, assign specialists, sequence work and consolidate verified outcomes.', supportedActions: [], authorityCeiling: 'MASTER', executionMode: 'COORDINATOR', requiresHumanApprovalFor: ['cross-tenant changes', 'irreversible operations', 'financial commitments'] },
  { id: 'engineering', name: 'Engineering Agent', domain: 'ENGINEERING', mission: 'Own application architecture, implementation and technical debt.', supportedActions: ['RECOMPILE_WORKSPACE', 'REFRESH_DBK_TOPOLOGY'], authorityCeiling: 'SAFE_REPAIR', executionMode: 'SHARED_RUNTIME', requiresHumanApprovalFor: ['production deployments', 'destructive migrations'] },
  { id: 'infrastructure', name: 'Infrastructure Agent', domain: 'INFRASTRUCTURE', mission: 'Assess runtime health, deployment readiness and infrastructure dependencies.', supportedActions: ['INSPECT_PLATFORM'], authorityCeiling: 'DIAGNOSE', executionMode: 'SHARED_RUNTIME', requiresHumanApprovalFor: ['infrastructure changes', 'production restarts'] },
  { id: 'security', name: 'Security Agent', domain: 'SECURITY', mission: 'Review identity, tenant isolation, permissions and security controls.', supportedActions: ['INSPECT_PLATFORM'], authorityCeiling: 'DIAGNOSE', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['credential rotation', 'access policy changes'] },
  { id: 'finance', name: 'Finance Agent', domain: 'FINANCE', mission: 'Support ledger integrity, reconciliation, cash-flow and financial reporting.', supportedActions: [], authorityCeiling: 'DIAGNOSE', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['payments', 'journal posting', 'financial adjustments'] },
  { id: 'revenue', name: 'Revenue Agent', domain: 'REVENUE', mission: 'Identify monetization opportunities, pricing gaps and revenue performance actions.', supportedActions: [], authorityCeiling: 'DIAGNOSE', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['pricing publication', 'commercial commitments'] },
  { id: 'sales', name: 'Sales Agent', domain: 'SALES', mission: 'Coordinate lead qualification, customer acquisition and sales pipeline workflows.', supportedActions: [], authorityCeiling: 'WORKFLOW', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['external customer messages', 'offers and contracts'] },
  { id: 'education', name: 'Education Agent', domain: 'EDUCATION', mission: 'Specialize in school admissions, academics, attendance, fees and parent services.', supportedActions: [], authorityCeiling: 'DIAGNOSE', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['student record changes', 'fee adjustments'] },
  { id: 'retail', name: 'Retail Agent', domain: 'RETAIL', mission: 'Specialize in inventory, procurement, POS, serials, warranties and stock control.', supportedActions: [], authorityCeiling: 'DIAGNOSE', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['stock adjustments', 'purchases', 'refunds'] },
  { id: 'healthcare', name: 'Healthcare Agent', domain: 'HEALTHCARE', mission: 'Specialize in compliant healthcare and pharmacy business workflows.', supportedActions: [], authorityCeiling: 'DIAGNOSE', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['clinical decisions', 'prescriptions', 'patient record changes'] },
  { id: 'compliance', name: 'Compliance Agent', domain: 'COMPLIANCE', mission: 'Coordinate statutory obligations, KRA/eTIMS readiness and audit evidence.', supportedActions: ['INSPECT_CONNECTORS'], authorityCeiling: 'DIAGNOSE', executionMode: 'SHARED_RUNTIME', requiresHumanApprovalFor: ['tax submissions', 'fiscal configuration changes'] },
  { id: 'payments', name: 'Payments Agent', domain: 'PAYMENTS', mission: 'Specialize in M-Pesa, payment callbacks, settlement and reconciliation workflows.', supportedActions: ['INSPECT_CONNECTORS', 'ACTIVATE_CONNECTOR'], authorityCeiling: 'CONNECTOR', executionMode: 'SHARED_RUNTIME', requiresHumanApprovalFor: ['live payment initiation', 'settlement changes', 'credential changes'] },
  { id: 'logistics', name: 'Logistics Agent', domain: 'LOGISTICS', mission: 'Specialize in fleet, dispatch, delivery and operational tracking.', supportedActions: [], authorityCeiling: 'DIAGNOSE', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['dispatch commitments', 'fleet purchases'] },
  { id: 'research', name: 'Research Agent', domain: 'RESEARCH', mission: 'Gather market, competitor, product and technical intelligence for decisions.', supportedActions: [], authorityCeiling: 'DIAGNOSE', executionMode: 'GOVERNED_ADVISORY', requiresHumanApprovalFor: ['paid research tools', 'external publication'] },
  { id: 'quality-assurance', name: 'Quality Assurance Agent', domain: 'QUALITY', mission: 'Validate acceptance criteria, test outcomes and post-action verification evidence.', supportedActions: ['PLAN_SAFE_REPAIR'], authorityCeiling: 'DIAGNOSE', executionMode: 'SHARED_RUNTIME', requiresHumanApprovalFor: ['production test data changes'] },
] as const;

export function getSpecialistAgent(id: string): SpecialistAgent | undefined {
  return TDBK_AGENT_CATALOG.find((agent) => agent.id === id);
}
