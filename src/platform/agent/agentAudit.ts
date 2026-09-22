import { auditLogger } from '../../kernel/audit/auditLogger';
import { AgentInstruction, AgentAction, AgentActionResult } from './types';

export class AgentAudit {
  instruction(i: AgentInstruction) {
    auditLogger.logEvent('WORKFLOW_EXECUTION', i.context.principal.id, 'AGENT_INSTRUCTION_RECEIVED', 'agent', 'ALLOWED', {
      tenantId: i.context.tenantContext?.tenantId || i.context.principal.tenantId || null,
      branchId: i.context.branchContext?.branchId || i.context.principal.branchId || null,
      requestId: i.context.requestId,
      details: { instructionId: i.instructionId, text: i.text.slice(0, 500) },
    });
  }

  action(i: AgentInstruction, a: AgentAction, r: AgentActionResult) {
    auditLogger.logEvent(r.status === 'FAILED' ? 'SECURITY_CONFIGURATION_CHANGE' : 'WORKFLOW_EXECUTION', i.context.principal.id, 'AGENT_ACTION', `agent:${a.kind}`, r.status === 'FAILED' ? 'ERROR' : 'ALLOWED', {
      tenantId: a.tenantId || i.context.tenantContext?.tenantId || i.context.principal.tenantId || null,
      branchId: i.context.branchContext?.branchId || i.context.principal.branchId || null,
      requestId: i.context.requestId,
      details: { instructionId: i.instructionId, actionId: a.actionId, authority: a.authority, status: r.status, error: r.error },
    });
  }
}

export const agentAudit = new AgentAudit();
