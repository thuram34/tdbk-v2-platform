import { AgentAction, AgentInstruction } from './types';

export class TdbkInstructionParser {
  public parse(instruction: AgentInstruction): { intent: string; actions: AgentAction[] } {
    const text = instruction.text.trim().toLowerCase();
    const actions: AgentAction[] = [];
    const add = (kind: AgentAction['kind'], authority: AgentAction['authority'], description: string, requiresAuthorization = false, tenantId?: string) => {
      actions.push({
        actionId: `act_${instruction.instructionId}_${actions.length + 1}`,
        kind,
        authority,
        description,
        requiresAuthorization,
        ...(tenantId ? { tenantId } : {}),
      });
    };

    if (/(repair|fix|correct|heal)/.test(text)) {
      add('PLAN_SAFE_REPAIR', 'SAFE_REPAIR', 'Identify safe configuration inconsistencies and produce a repair plan.', true);
      return { intent: 'SAFE_REPAIR_ANALYSIS', actions };
    }

    if (/(workflow|workflows|job|jobs)/.test(text)) {
      add('INSPECT_WORKFLOWS', 'OBSERVE', 'Inspect workflow activity and durable jobs.');
    }
    if (/(business state|projection|projected state|state)/.test(text)) {
      add('INSPECT_BUSINESS_STATE', 'DIAGNOSE', 'Inspect canonical DBK business-state projections.');
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
}

export const instructionParser = new TdbkInstructionParser();
