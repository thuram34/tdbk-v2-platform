import { instructionParser } from './instructionParser';
import { agentAuthorityPolicy } from './authorityPolicy';
import { agentAudit } from './agentAudit';
import { controlPlaneTool } from './tools/controlPlaneTool';
import { businessStateTool } from './tools/businessStateTool';
import { workflowTool } from './tools/workflowTool';
import { AgentInstruction, AgentRunResult } from './types';

export class TdbkAgentRuntime {
  public async run(instruction: AgentInstruction): Promise<AgentRunResult> {
    agentAudit.instruction(instruction);
    const parsed = instructionParser.parse(instruction);
    const plan = { instructionId: instruction.instructionId, intent: parsed.intent, actions: parsed.actions, generatedAt: new Date().toISOString() };
    const results = [] as AgentRunResult['results'];

    for (const action of plan.actions) {
      const decision = agentAuthorityPolicy.authorize(instruction, action);
      if (!decision.allowed) {
        const result = { actionId: action.actionId, status: 'AUTHORIZATION_REQUIRED' as const, error: decision.reason };
        results.push(result); agentAudit.action(instruction, action, result); continue;
      }
      try {
        let data: unknown;
        if (action.kind === 'INSPECT_PLATFORM' || action.kind === 'INSPECT_DBKS') data = await controlPlaneTool.execute(instruction.context);
        else if (action.kind === 'INSPECT_WORKFLOWS') data = await workflowTool.execute(instruction.context);
        else if (action.kind === 'INSPECT_BUSINESS_STATE') {
          const tenantId = action.tenantId || instruction.context.tenantContext?.tenantId || instruction.context.principal.tenantId;
          if (!tenantId) throw new Error('Business-state inspection requires a tenant context.');
          data = await businessStateTool.execute(instruction.context, tenantId);
        } else data = { planned: true, message: 'No mutation was executed; explicit authorization is required for safe repair.' };
        const result = { actionId: action.actionId, status: 'COMPLETED' as const, data };
        results.push(result); agentAudit.action(instruction, action, result);
      } catch (error) {
        const result = { actionId: action.actionId, status: 'FAILED' as const, error: error instanceof Error ? error.message : String(error) };
        results.push(result); agentAudit.action(instruction, action, result);
      }
    }
    return { instructionId: instruction.instructionId, plan, results, completedAt: new Date().toISOString() };
  }
}
export const tdbkAgentRuntime = new TdbkAgentRuntime();
