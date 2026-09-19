import { masterAuthority } from '../../kernel/master/masterAuthority';
import { AgentAction, AgentAuthority, AgentInstruction } from './types';

const rank: Record<AgentAuthority, number> = { OBSERVE: 1, DIAGNOSE: 2, SAFE_REPAIR: 3, WORKFLOW: 4, BUSINESS: 5, CONNECTOR: 6, ADMIN: 7, MASTER: 8 };

export class AgentAuthorityPolicy {
  public authorize(instruction: AgentInstruction, action: AgentAction): { allowed: boolean; reason: string } {
    if (!instruction.context.principal) return { allowed: false, reason: 'Authenticated principal required.' };
    if (action.requiresAuthorization) return { allowed: false, reason: 'Mutation-capable action requires explicit authorization.' };
    const requested = instruction.requestedAuthority || 'OBSERVE';
    if (rank[requested] < rank[action.authority]) return { allowed: false, reason: `Instruction authority '${requested}' is below required '${action.authority}'.` };
    if (action.authority === 'MASTER') {
      try { masterAuthority.assertMasterAuthority(instruction.context.principal, 'agent.masterAction', instruction.context.requestId); return { allowed: true, reason: 'TDBK MASTER authority verified.' }; }
      catch { return { allowed: false, reason: 'TDBK MASTER authority required.' }; }
    }
    return { allowed: true, reason: 'Action is within the agent authority boundary.' };
  }
}
export const agentAuthorityPolicy = new AgentAuthorityPolicy();
