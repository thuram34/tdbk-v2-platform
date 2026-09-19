import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { AgentAction, AgentAuthority, AgentInstruction } from './types';

const rank: Record<AgentAuthority, number> = {
  OBSERVE: 1,
  DIAGNOSE: 2,
  SAFE_REPAIR: 3,
  WORKFLOW: 4,
  BUSINESS: 5,
  CONNECTOR: 6,
  ADMIN: 7,
  MASTER: 8,
};

export class AgentAuthorityPolicy {
  public async authorize(instruction: AgentInstruction, action: AgentAction): Promise<{ allowed: boolean; reason: string }> {
    if (!instruction.context.principal) {
      return { allowed: false, reason: 'Authenticated principal required.' };
    }

    if (action.requiresAuthorization && !masterAuthority.isMasterAdmin(instruction.context.principal)) {
      const requested = instruction.requestedAuthority || 'OBSERVE';
      if (!(requested in rank)) {
        return { allowed: false, reason: `Unknown agent authority '${requested}'.` };
      }
      if (rank[requested] < rank[action.authority]) {
        return {
          allowed: false,
          reason: `Instruction authority '${requested}' is below required '${action.authority}'.`,
        };
      }
    }

    const tenantId =
      action.tenantId ||
      instruction.context.tenantContext?.tenantId ||
      instruction.context.principal.tenantId;

    if (action.authority === 'MASTER' || action.kind === 'SUSPEND_DBK' || action.kind === 'REACTIVATE_DBK' || action.kind === 'ARCHIVE_DBK' || action.kind === 'RESTORE_DBK') {
      if (!masterAuthority.isMasterAdmin(instruction.context.principal)) {
        return { allowed: false, reason: 'TDBK MASTER authority required for DBK lifecycle mutation.' };
      }
      return { allowed: true, reason: 'TDBK MASTER lifecycle authority verified.' };
    }

    if (action.kind === 'PROVISION_DBK') {
      try {
        masterAuthority.assertOwnerOrMasterAuthority(
          instruction.context.principal,
          'agent.provisionDbk',
          instruction.context.requestId,
        );
        return { allowed: true, reason: 'Business Owner or TDBK MASTER provisioning authority verified.' };
      } catch (error) {
        return { allowed: false, reason: error instanceof Error ? error.message : 'Business Owner or TDBK MASTER authority required for DBK provisioning.' };
      }
    }

    if (action.kind === 'COMPOSE_BUSINESS') {
      if (!tenantId) return { allowed: false, reason: 'Authoritative tenant context is required for business composition.' };
      try {
        masterAuthority.assertTenantAuthority(instruction.context, tenantId, 'agent.businessComposition');
        return { allowed: true, reason: 'Tenant authority verified for blueprint-driven business composition.' };
      } catch (error) {
        return { allowed: false, reason: error instanceof Error ? error.message : 'Tenant authority required for business composition.' };
      }
    }

    if (
      action.kind === 'ENABLE_CAPABILITY' ||
      action.kind === 'DISABLE_CAPABILITY' ||
      action.kind === 'REBUILD_BUSINESS_STATE' ||
      action.kind === 'ENSURE_HEADQUARTERS_BRANCH' ||
      action.kind === 'REFRESH_DBK_TOPOLOGY'
    ) {
      if (!tenantId) return { allowed: false, reason: 'Authoritative tenant context is required for DBK mutation.' };
      try {
        masterAuthority.assertTenantAuthority(instruction.context, tenantId, 'agent.dbkConstruction');
        return { allowed: true, reason: 'Tenant authority verified for agent-controlled DBK construction/repair.' };
      } catch (error) {
        return { allowed: false, reason: error instanceof Error ? error.message : 'Tenant authority required for agent-controlled DBK mutation.' };
      }
    }

    if (action.kind === 'RECOMPILE_WORKSPACE') {
      if (!tenantId) return { allowed: false, reason: 'Authoritative tenant context is required for workspace compilation.' };
      try {
        masterAuthority.assertTenantAuthority(instruction.context, tenantId, 'agent.workspaceCompilation');
        return { allowed: true, reason: 'Tenant authority verified for workspace compilation.' };
      } catch (error) {
        return { allowed: false, reason: error instanceof Error ? error.message : 'Tenant authority required for workspace compilation.' };
      }
    }

    if (action.kind === 'RECOVER_WORKFLOWS' || action.kind === 'EXECUTE_WORKFLOW') {
      if (!tenantId) return { allowed: false, reason: 'Authoritative tenant context is required for workflow mutation.' };

      const result = await rbacEngine.authorizeAsync(
        instruction.context.principal,
        'execute',
        action.kind === 'RECOVER_WORKFLOWS' ? 'workflow:recover' : 'workflow:execute',
        {
          tenantId,
          branchId: instruction.context.branchContext?.branchId || instruction.context.principal.branchId,
          requiredPermission: action.kind === 'RECOVER_WORKFLOWS' ? 'workflow:recover' : 'workflow:execute',
          requestId: instruction.context.requestId,
        },
      );
      return result.allowed
        ? { allowed: true, reason: result.reason }
        : { allowed: false, reason: result.reason };
    }

    if (action.authority === 'MASTER') {
      try {
        masterAuthority.assertMasterAuthority(
          instruction.context.principal,
          'agent.masterAction',
          instruction.context.requestId,
        );
        return { allowed: true, reason: 'TDBK MASTER authority verified.' };
      } catch {
        return { allowed: false, reason: 'TDBK MASTER authority required.' };
      }
    }

    if (!action.requiresAuthorization) {
      return { allowed: true, reason: 'Action is within the agent observation boundary.' };
    }

    return { allowed: false, reason: 'Explicit authorization is required for this mutation.' };
  }
}

export const agentAuthorityPolicy = new AgentAuthorityPolicy();
