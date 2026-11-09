import { describe, expect, it } from 'vitest';
import { TDBK_AGENT_CATALOG } from './agentCatalog';
import { TdbkAgentTeamCoordinator } from './agentTeamCoordinator';
import { AgentAction } from './types';

const action = (kind: AgentAction['kind']): AgentAction => ({
  actionId: `test-${kind}`,
  kind,
  authority: 'OBSERVE',
  description: `Test ${kind}`,
  requiresAuthorization: false,
});

describe('TDBK coordinated specialist workforce', () => {
  it('registers the chief coordinator and all 14 specialist roles', () => {
    expect(TDBK_AGENT_CATALOG).toHaveLength(15);
    expect(TDBK_AGENT_CATALOG.map((agent) => agent.id)).toContain('chief-intelligence');
    expect(new Set(TDBK_AGENT_CATALOG.map((agent) => agent.id)).size).toBe(15);
  });

  it('assigns a lead and collaborators for every command action kind', () => {
    const kinds: AgentAction['kind'][] = [
      'INSPECT_PLATFORM', 'INSPECT_DBKS', 'INSPECT_BUSINESS_STATE', 'INSPECT_WORKFLOWS',
      'INSPECT_CONNECTORS', 'ACTIVATE_CONNECTOR', 'PLAN_SAFE_REPAIR', 'PROVISION_DBK',
      'COMPOSE_BUSINESS', 'ACTIVATE_BUSINESS', 'REBUILD_BUSINESS_STATE', 'ENABLE_CAPABILITY',
      'DISABLE_CAPABILITY', 'ENSURE_HEADQUARTERS_BRANCH', 'REFRESH_DBK_TOPOLOGY',
      'RECOMPILE_WORKSPACE', 'SUSPEND_DBK', 'REACTIVATE_DBK', 'ARCHIVE_DBK',
      'RESTORE_DBK', 'RECOVER_WORKFLOWS', 'EXECUTE_WORKFLOW',
    ];
    const coordinator = new TdbkAgentTeamCoordinator();
    const assignments = coordinator.coordinate(kinds.map(action));

    expect(assignments).toHaveLength(kinds.length);
    for (const assignment of assignments) {
      expect(TDBK_AGENT_CATALOG.some((agent) => agent.id === assignment.leadAgentId)).toBe(true);
      expect(assignment.collaboratorAgentIds.length).toBeGreaterThan(0);
      expect(assignment.rationale.length).toBeGreaterThan(20);
    }
  });

  it('keeps advisory specialists inside the governed advisory boundary', () => {
    const assignment = new TdbkAgentTeamCoordinator().coordinate([action('INSPECT_BUSINESS_STATE')])[0];
    expect(assignment.leadAgentId).toBe('finance');
    expect(assignment.executionBoundary).toBe('GOVERNED_ADVISORY');
  });

  it('routes connector activation through payment, compliance, security and QA', () => {
    const assignment = new TdbkAgentTeamCoordinator().coordinate([action('ACTIVATE_CONNECTOR')])[0];
    expect(assignment.leadAgentId).toBe('payments');
    expect(assignment.collaboratorAgentIds).toEqual(['compliance', 'security', 'quality-assurance']);
  });
});
