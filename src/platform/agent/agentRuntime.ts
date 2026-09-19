import { instructionParser } from './instructionParser';
import { agentAuthorityPolicy } from './authorityPolicy';
import { agentAudit } from './agentAudit';
import { agentActionExecutor } from './actionExecutor';
import { agentVerificationEngine } from './verificationEngine';
import { agentRepairPlanner } from './repairPlanner';
import { controlPlaneTool } from './tools/controlPlaneTool';
import { businessStateTool } from './tools/businessStateTool';
import { workflowTool } from './tools/workflowTool';
import { agentExecutionRepository } from '../../persistence/firestore/repositories/agentExecutionRepository';
import { AgentInstruction, AgentRunResult } from './types';

const EXECUTABLE_ACTIONS = new Set([
  'SUSPEND_DBK',
  'REACTIVATE_DBK',
  'ARCHIVE_DBK',
  'RESTORE_DBK',
  'RECOVER_WORKFLOWS',
  'EXECUTE_WORKFLOW',
  'REBUILD_BUSINESS_STATE',
  'ENABLE_CAPABILITY',
  'DISABLE_CAPABILITY',
  'PROVISION_DBK',
  'COMPOSE_BUSINESS',
  'ACTIVATE_BUSINESS',
  'INSPECT_CONNECTORS',
  'ACTIVATE_CONNECTOR',
  'ENSURE_HEADQUARTERS_BRANCH',
  'REFRESH_DBK_TOPOLOGY',
  'RECOMPILE_WORKSPACE',
]);

export class TdbkAgentRuntime {
  public async run(instruction: AgentInstruction): Promise<AgentRunResult> {
    const tenantId = instruction.context.tenantContext?.tenantId || instruction.context.principal.tenantId || null;
    const existing = tenantId
      ? await agentExecutionRepository.get(tenantId, instruction.instructionId)
      : await agentExecutionRepository.getSystem(instruction.instructionId);

    if (existing && ['EXECUTED', 'VERIFIED', 'AUTHORIZATION_REQUIRED'].includes(existing.status)) {
      return {
        instructionId: existing.instructionId,
        plan: existing.plan,
        results: existing.results,
        completedAt: existing.completedAt,
      };
    }

    const startedAt = new Date().toISOString();
    agentAudit.instruction(instruction);
    const parsed = instructionParser.parse(instruction);
    const plan = {
      instructionId: instruction.instructionId,
      intent: parsed.intent,
      actions: parsed.actions,
      generatedAt: startedAt,
    };
    const results = [] as AgentRunResult['results'];

    for (const action of plan.actions) {
      const decision = await agentAuthorityPolicy.authorize(instruction, action);
      if (!decision.allowed) {
        const result = {
          actionId: action.actionId,
          status: 'AUTHORIZATION_REQUIRED' as const,
          error: decision.reason,
        };
        results.push(result);
        agentAudit.action(instruction, action, result);
        continue;
      }

      try {
        let result;
        if (EXECUTABLE_ACTIONS.has(action.kind)) {
          result = await agentActionExecutor.execute(instruction, action);
        } else {
          let data: unknown;
          if (action.kind === 'PLAN_SAFE_REPAIR') {
            data = await agentRepairPlanner.plan(instruction.context);
          } else if (action.kind === 'INSPECT_PLATFORM' || action.kind === 'INSPECT_DBKS') {
            data = await controlPlaneTool.execute(instruction.context);
          } else if (action.kind === 'INSPECT_WORKFLOWS') {
            data = await workflowTool.execute(instruction.context);
          } else if (action.kind === 'INSPECT_BUSINESS_STATE') {
            const target = action.tenantId || instruction.context.tenantContext?.tenantId || instruction.context.principal.tenantId;
            if (!target) throw new Error('Business-state inspection requires a tenant context.');
            data = await businessStateTool.execute(instruction.context, target);
          } else {
            data = { planned: true, message: 'No mutation was executed for this action.' };
          }
          result = { actionId: action.actionId, status: 'COMPLETED' as const, data };
        }

        if (result.status === 'COMPLETED') {
          const verification = await agentVerificationEngine.verify(instruction, action, result.data);
          result = { ...result, verification };
          if (!verification.verified) result.status = 'FAILED';
        }

        results.push(result);
        agentAudit.action(instruction, action, result);
      } catch (error) {
        const result = {
          actionId: action.actionId,
          status: 'FAILED' as const,
          error: error instanceof Error ? error.message : String(error),
        };
        results.push(result);
        agentAudit.action(instruction, action, result);
      }
    }

    const hasFailure = results.some((result) => result.status === 'FAILED');
    const needsAuthorization = results.some((result) => result.status === 'AUTHORIZATION_REQUIRED');
    const hasUnverified = results.some((result) => result.verification && !result.verification.verified);
    const completedAt = new Date().toISOString();
    const result: AgentRunResult = { instructionId: instruction.instructionId, plan, results, completedAt };

    const status = hasFailure
      ? (hasUnverified ? 'VERIFICATION_FAILED' : 'FAILED')
      : needsAuthorization
        ? 'AUTHORIZATION_REQUIRED'
        : 'VERIFIED';

    await agentExecutionRepository.save({
      executionId: instruction.instructionId,
      instructionId: instruction.instructionId,
      tenantId,
      branchId: instruction.context.branchContext?.branchId || instruction.context.principal.branchId || null,
      principalId: instruction.context.principal.id,
      instruction: instruction.text.slice(0, 2000),
      intent: plan.intent,
      status,
      plan,
      results,
      createdAt: startedAt,
      completedAt,
    });

    return result;
  }
}

export const tdbkAgentRuntime = new TdbkAgentRuntime();
