/** Deterministic team assignment for the TDBK command runtime. */
import { AgentAction, AgentAssignment } from './types';
import { TDBK_AGENT_CATALOG } from './agentCatalog';

const ACTION_OWNERS: Record<AgentAction['kind'], { lead: string; collaborators: string[]; rationale: string }> = {
  INSPECT_PLATFORM: { lead: 'infrastructure', collaborators: ['security', 'quality-assurance'], rationale: 'Platform health requires infrastructure inspection with security and verification review.' },
  INSPECT_DBKS: { lead: 'chief-intelligence', collaborators: ['security', 'quality-assurance'], rationale: 'Portfolio inspection is coordinated centrally and reviewed for isolation and completeness.' },
  INSPECT_BUSINESS_STATE: { lead: 'finance', collaborators: ['engineering', 'quality-assurance'], rationale: 'Canonical business state is reviewed for integrity, projection health and correctness.' },
  INSPECT_WORKFLOWS: { lead: 'engineering', collaborators: ['quality-assurance'], rationale: 'Workflow state is assessed by engineering and checked for operational correctness.' },
  INSPECT_CONNECTORS: { lead: 'payments', collaborators: ['compliance', 'security'], rationale: 'Connector readiness is reviewed across payment, compliance and security concerns.' },
  ACTIVATE_CONNECTOR: { lead: 'payments', collaborators: ['compliance', 'security', 'quality-assurance'], rationale: 'Connector activation requires payment/compliance/security coordination and postcondition checks.' },
  PLAN_SAFE_REPAIR: { lead: 'quality-assurance', collaborators: ['engineering', 'security'], rationale: 'Repair candidates are diagnosed and reviewed before any separately authorized mutation.' },
  PROVISION_DBK: { lead: 'chief-intelligence', collaborators: ['engineering', 'security', 'quality-assurance'], rationale: 'DBK provisioning spans platform orchestration, tenant security and verification.' },
  COMPOSE_BUSINESS: { lead: 'engineering', collaborators: ['education', 'retail', 'healthcare', 'logistics', 'quality-assurance'], rationale: 'Business composition requires sector capability alignment and verification.' },
  ACTIVATE_BUSINESS: { lead: 'chief-intelligence', collaborators: ['engineering', 'security', 'quality-assurance'], rationale: 'Activation is coordinated centrally and checked against tenant and workspace invariants.' },
  REBUILD_BUSINESS_STATE: { lead: 'engineering', collaborators: ['finance', 'quality-assurance'], rationale: 'State projection repair requires engineering ownership and integrity verification.' },
  ENABLE_CAPABILITY: { lead: 'engineering', collaborators: ['security', 'quality-assurance'], rationale: 'Capability changes require implementation, entitlement and verification checks.' },
  DISABLE_CAPABILITY: { lead: 'engineering', collaborators: ['security', 'quality-assurance'], rationale: 'Capability removal is reviewed for authorization, dependencies and postconditions.' },
  ENSURE_HEADQUARTERS_BRANCH: { lead: 'engineering', collaborators: ['security', 'quality-assurance'], rationale: 'Branch creation requires tenant-scoped construction and verification.' },
  REFRESH_DBK_TOPOLOGY: { lead: 'engineering', collaborators: ['infrastructure', 'quality-assurance'], rationale: 'Topology refresh requires platform consistency and verification.' },
  RECOMPILE_WORKSPACE: { lead: 'engineering', collaborators: ['education', 'retail', 'healthcare', 'quality-assurance'], rationale: 'Workspace compilation must preserve sector-specific user experiences.' },
  SUSPEND_DBK: { lead: 'chief-intelligence', collaborators: ['security', 'quality-assurance'], rationale: 'High-impact lifecycle changes require central coordination and security review.' },
  REACTIVATE_DBK: { lead: 'chief-intelligence', collaborators: ['security', 'quality-assurance'], rationale: 'Reactivation requires central coordination and operational verification.' },
  ARCHIVE_DBK: { lead: 'chief-intelligence', collaborators: ['security', 'finance', 'quality-assurance'], rationale: 'Archival has lifecycle, audit and financial-retention implications.' },
  RESTORE_DBK: { lead: 'chief-intelligence', collaborators: ['security', 'engineering', 'quality-assurance'], rationale: 'Restoration requires lifecycle governance, tenant isolation and verification.' },
  RECOVER_WORKFLOWS: { lead: 'engineering', collaborators: ['infrastructure', 'quality-assurance'], rationale: 'Workflow recovery requires durable execution and infrastructure health checks.' },
  EXECUTE_WORKFLOW: { lead: 'engineering', collaborators: ['security', 'quality-assurance'], rationale: 'Workflow execution requires authorization, orchestration and outcome verification.' },
};

export class TdbkAgentTeamCoordinator {
  public coordinate(actions: AgentAction[]): AgentAssignment[] {
    return actions.map((action) => {
      const route = ACTION_OWNERS[action.kind];
      const lead = TDBK_AGENT_CATALOG.find((agent) => agent.id === route.lead);
      if (!lead) throw new Error(`No registered lead agent for action '${action.kind}'.`);
      return {
        actionId: action.actionId,
        leadAgentId: route.lead,
        collaboratorAgentIds: route.collaborators,
        rationale: route.rationale,
        executionBoundary: lead.executionMode === 'GOVERNED_ADVISORY' ? 'GOVERNED_ADVISORY' : 'SHARED_RUNTIME',
      };
    });
  }
}

export const tdbkAgentTeamCoordinator = new TdbkAgentTeamCoordinator();
