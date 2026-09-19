import { AgentAction, AgentInstruction } from './types';

export class TdbkInstructionParser {
  public parse(instruction: AgentInstruction): { intent: string; actions: AgentAction[] } {
    const text = instruction.text.trim().toLowerCase();
    const actions: AgentAction[] = [];

    const targetTenantId =
      instruction.context.tenantContext?.tenantId ||
      instruction.context.principal.tenantId ||
      this.extractIdentifier(text, /\bdbk[:\s_-]*([a-z0-9_-]+)\b/i) ||
      this.extractIdentifier(text, /\btenant[:\s_-]*([a-z0-9_-]+)\b/i);

    const workflowId = this.extractIdentifier(text, /\b(wf_[a-z0-9_-]+)\b/i);

    const add = (
      kind: AgentAction['kind'],
      authority: AgentAction['authority'],
      description: string,
      requiresAuthorization = false,
      tenantId?: string,
      actionWorkflowId?: string,
    ) => {
      actions.push({
        actionId: `act_${instruction.instructionId}_${actions.length + 1}`,
        kind,
        authority,
        description,
        requiresAuthorization,
        ...(tenantId ? { tenantId } : {}),
        ...(actionWorkflowId ? { workflowId: actionWorkflowId } : {}),
      });
    };

    if (/(suspend|disable|pause)\b/.test(text)) {
      add('SUSPEND_DBK', 'ADMIN', `Suspend DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'DBK_SUSPENSION', actions };
    }

    if (/(reactivate|activate|resume)\b/.test(text)) {
      add('REACTIVATE_DBK', 'ADMIN', `Reactivate DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'DBK_REACTIVATION', actions };
    }

    if (/(archive)\b/.test(text)) {
      add('ARCHIVE_DBK', 'ADMIN', `Archive DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'DBK_ARCHIVAL', actions };
    }

    if (/(restore|unarchive)\b/.test(text)) {
      add('RESTORE_DBK', 'ADMIN', `Restore DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'DBK_RESTORATION', actions };
    }

    if (/(recover|resume|retry).*(workflow|workflows|jobs|job)/.test(text)) {
      add('RECOVER_WORKFLOWS', 'WORKFLOW', 'Recover and resume durable workflows for the authorized tenant.', true, targetTenantId);
      return { intent: 'WORKFLOW_RECOVERY', actions };
    }

    if (/(execute|run|resume).*(wf_[a-z0-9_-]+)/.test(text) && workflowId) {
      add('EXECUTE_WORKFLOW', 'WORKFLOW', `Execute durable workflow ${workflowId}.`, true, targetTenantId, workflowId);
      return { intent: 'WORKFLOW_EXECUTION', actions };
    }

    if (/(repair|fix|correct|heal)/.test(text)) {
      add('PLAN_SAFE_REPAIR', 'SAFE_REPAIR', 'Identify safe configuration inconsistencies and produce a repair plan.', true);
      return { intent: 'SAFE_REPAIR_ANALYSIS', actions };
    }

    if (/(workflow|workflows|job|jobs)/.test(text)) {
      add('INSPECT_WORKFLOWS', 'OBSERVE', 'Inspect workflow activity and durable jobs.');
    }
    if (/(business state|projection|projected state|state)/.test(text)) {
      add('INSPECT_BUSINESS_STATE', 'DIAGNOSE', 'Inspect canonical DBK business-state projections.', false, targetTenantId);
    }
    if (/(dbk|tenant|businesses|every business|all dbks|every dbk)/.test(text)) {
      add('INSPECT_DBKS', 'OBSERVE', 'Inspect registered DBKs and their operational state.');
    }
    if (/(platform|health|system|tdbk)/.test(text) && actions.length === 0) {
      add('INSPECT_PLATFORM', 'OBSERVE', 'Inspect the TDBK control plane and platform health.');
    }
    if (actions.length === 0) {
      add('INSPECT_PLATFORM', 'OBSERVE', 'Inspect the TDBK control plane and platform health.');
    }

    return { intent: 'TDBK_OPERATIONAL_INSPECTION', actions };
  }

  private extractIdentifier(text: string, pattern: RegExp): string | undefined {
    const match = text.match(pattern);
    return match?.[1];
  }
}

export const instructionParser = new TdbkInstructionParser();
