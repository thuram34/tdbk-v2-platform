import { AgentAction, AgentInstruction } from './types';

export class TdbkInstructionParser {
  public parse(instruction: AgentInstruction): { intent: string; actions: AgentAction[] } {
    const text = instruction.text.trim().toLowerCase();
    const actions: AgentAction[] = [];

    const explicitTenantId =
      this.extractIdentifier(text, /\bdbk[:\s_-]*([a-z0-9][a-z0-9_-]*)\b/i) ||
      this.extractIdentifier(text, /\btenant[:\s_-]*([a-z0-9][a-z0-9_-]*)\b/i);
    const targetTenantId =
      explicitTenantId ||
      instruction.context.tenantContext?.tenantId ||
      instruction.context.principal.tenantId;
    const workflowId = this.extractIdentifier(text, /\b(wf_[a-z0-9_-]+)\b/i);
    const capabilityId = this.extractIdentifier(text, /\bcapability[:\s_-]*([a-z0-9][a-z0-9_-]*)\b/i);

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

    if (/(enable|activate|install).*\bcapability\b/.test(text)) {
      add('ENABLE_CAPABILITY', 'ADMIN', `Enable capability ${capabilityId || '(target required)'} for DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      if (actions[actions.length - 1]) actions[actions.length - 1].capabilityId = capabilityId;
      return { intent: 'CAPABILITY_ENABLE', actions };
    }
    if (/(disable|deactivate|remove).*\bcapability\b/.test(text)) {
      add('DISABLE_CAPABILITY', 'ADMIN', `Disable capability ${capabilityId || '(target required)'} for DBK ${targetTenantId || '(target required)'}. `, true, targetTenantId);
      if (actions[actions.length - 1]) actions[actions.length - 1].capabilityId = capabilityId;
      return { intent: 'CAPABILITY_DISABLE', actions };
    }

    if (/\b(ensure|create|initialize|add).*\b(headquarters|hq)\b/.test(text)) {
      add('ENSURE_HEADQUARTERS_BRANCH', 'ADMIN', `Ensure the headquarters branch exists for DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'ENSURE_HEADQUARTERS_BRANCH', actions };
    }
    if (/\b(refresh|rebuild|synchronize|sync).*\b(branch|branches|topology)\b/.test(text)) {
      add('REFRESH_DBK_TOPOLOGY', 'ADMIN', `Refresh the authoritative branch topology for DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'REFRESH_DBK_TOPOLOGY', actions };
    }
    if (/\b(recompile|compile|rebuild|refresh|sync|synchronize).*\b(workspace|workspace state)\b/.test(text)) {
      add('RECOMPILE_WORKSPACE', 'DIAGNOSE', `Compile the authoritative workspace projection for DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'RECOMPILE_WORKSPACE', actions };
    }

    if (/\b(provision|onboard)\b/.test(text)) {
      const provisionId = explicitTenantId;
      const legalNameMatch = text.match(/\b(?:legal\s+name|name)[:\s]+(.+?)(?=\s+(?:blueprint|tier|subscription|hq|headquarters)[:\s]|$)/i);
      const blueprintId = this.extractIdentifier(text, /\bblueprint[:\s_-]*([a-z0-9][a-z0-9_-]*)\b/i);
      const blueprintVersion = this.extractIdentifier(text, /\bversion[:\s_-]*([0-9][a-z0-9._-]*)\b/i);
      const tier = this.extractIdentifier(text, /\b(?:tier|subscription)[:\s_-]*(free|foundation|growth|pro|enterprise)\b/i) as AgentAction['subscriptionTier'];
      const primaryBranchNameMatch = text.match(/\b(?:hq|headquarters)[:\s]+(.+?)(?=\s+(?:blueprint|tier|subscription|name|legal\s+name)[:\s]|$)/i);

      if (!provisionId || !legalNameMatch?.[1] || !blueprintId) {
        add('INSPECT_DBKS', 'OBSERVE', 'Provisioning request is missing dbk, legal name, or blueprint parameters; inspect before construction.');
        return { intent: 'PROVISIONING_REQUEST_INCOMPLETE', actions };
      }

      add(
        'PROVISION_DBK',
        'ADMIN',
        `Provision DBK ${provisionId} using blueprint ${blueprintId}.`,
        true,
        provisionId,
      );
      const action = actions[actions.length - 1];
      action.legalName = legalNameMatch[1].trim();
      action.blueprintId = blueprintId;
      action.blueprintVersion = blueprintVersion;
      action.subscriptionTier = tier;
      action.primaryBranchName = primaryBranchNameMatch?.[1]?.trim();
      return { intent: 'DBK_PROVISIONING', actions };
    }

    if (/(recover|resume|retry).*\b(workflow|workflows|jobs|job)\b/.test(text)) {
      add('RECOVER_WORKFLOWS', 'WORKFLOW', 'Recover and resume durable workflows for the authorized tenant.', true, targetTenantId);
      return { intent: 'WORKFLOW_RECOVERY', actions };
    }
    if (/(execute|run|resume).*\bwf_[a-z0-9_-]+\b/.test(text) && workflowId) {
      add('EXECUTE_WORKFLOW', 'WORKFLOW', `Execute durable workflow ${workflowId}.`, true, targetTenantId, workflowId);
      return { intent: 'WORKFLOW_EXECUTION', actions };
    }
    if (/(suspend|disable|pause)\b/.test(text)) {
      add('SUSPEND_DBK', 'ADMIN', `Suspend DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'DBK_SUSPENSION', actions };
    }
    if (/\b(reactivate|activate)\b/.test(text)) {
      add('REACTIVATE_DBK', 'ADMIN', `Reactivate DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'DBK_REACTIVATION', actions };
    }
    if (/\barchive\b/.test(text)) {
      add('ARCHIVE_DBK', 'ADMIN', `Archive DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'DBK_ARCHIVAL', actions };
    }
    if (/\b(restore|unarchive)\b/.test(text)) {
      add('RESTORE_DBK', 'ADMIN', `Restore DBK ${targetTenantId || '(target required)'}.`, true, targetTenantId);
      return { intent: 'DBK_RESTORATION', actions };
    }
    if (/(repair|fix|correct|heal)/.test(text)) {
      add('PLAN_SAFE_REPAIR', 'SAFE_REPAIR', 'Identify safe configuration inconsistencies and produce a repair plan.', true);
      return { intent: 'SAFE_REPAIR_ANALYSIS', actions };
    }
    if (/(workflow|workflows|job|jobs)/.test(text)) add('INSPECT_WORKFLOWS', 'OBSERVE', 'Inspect workflow activity and durable jobs.');
    if (/(business state|projection|projected state|state)/.test(text)) add('INSPECT_BUSINESS_STATE', 'DIAGNOSE', 'Inspect canonical DBK business-state projections.', false, targetTenantId);
    if (/(dbk|tenant|businesses|every business|all dbks|every dbk)/.test(text)) add('INSPECT_DBKS', 'OBSERVE', 'Inspect registered DBKs and their operational state.');
    if (/(platform|health|system|tdbk)/.test(text) && actions.length === 0) add('INSPECT_PLATFORM', 'OBSERVE', 'Inspect the TDBK control plane and platform health.');
    if (actions.length === 0) add('INSPECT_PLATFORM', 'OBSERVE', 'Inspect the TDBK control plane and platform health.');
    return { intent: 'TDBK_OPERATIONAL_INSPECTION', actions };
  }

  private extractIdentifier(text: string, pattern: RegExp): string | undefined {
    return text.match(pattern)?.[1];
  }
}

export const instructionParser = new TdbkInstructionParser();
