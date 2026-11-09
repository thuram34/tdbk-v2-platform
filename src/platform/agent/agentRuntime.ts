import { instructionParser } from './instructionParser';
import { agentAuthorityPolicy } from './authorityPolicy';
import { agentAudit } from './agentAudit';
import { agentActionExecutor } from './actionExecutor';
import { agentVerificationEngine } from './verificationEngine';
import { agentRepairPlanner } from './repairPlanner';
import { controlPlaneTool } from './tools/controlPlaneTool';
import { businessStateTool } from './tools/businessStateTool';
import { workflowTool } from './tools/workflowTool';
import { tdbkAgentTeamCoordinator } from './agentTeamCoordinator';
import { agentExecutionRepository } from '../../persistence/firestore/repositories/agentExecutionRepository';
import { agentActionExecutionRepository } from '../../persistence/firestore/repositories/agentActionExecutionRepository';
import { AgentInstruction, AgentRunResult } from './types';

const EXECUTABLE_ACTIONS = new Set([
  'SUSPEND_DBK','REACTIVATE_DBK','ARCHIVE_DBK','RESTORE_DBK','RECOVER_WORKFLOWS','EXECUTE_WORKFLOW','REBUILD_BUSINESS_STATE',
  'ENABLE_CAPABILITY','DISABLE_CAPABILITY','PROVISION_DBK','COMPOSE_BUSINESS','ACTIVATE_BUSINESS','INSPECT_CONNECTORS',
  'ACTIVATE_CONNECTOR','ENSURE_HEADQUARTERS_BRANCH','REFRESH_DBK_TOPOLOGY','RECOMPILE_WORKSPACE',
]);

export class TdbkAgentRuntime {
  public async run(instruction: AgentInstruction): Promise<AgentRunResult> {
    const tenantId = instruction.context.tenantContext?.tenantId || instruction.context.principal.tenantId || null;
    const branchId = instruction.context.branchContext?.branchId || instruction.context.principal.branchId || null;
    const startedAt = new Date().toISOString();
    agentAudit.instruction(instruction);
    const parsed = instructionParser.parse(instruction);
    const plan = {
      instructionId: instruction.instructionId,
      intent: parsed.intent,
      actions: parsed.actions,
      generatedAt: startedAt,
      teamAssignments: tdbkAgentTeamCoordinator.coordinate(parsed.actions),
    };
    const leaseOwner = `${instruction.context.principal.id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

    // Replay binding is a security gate and must run before any action can be
    // authorized or executed. Agent execution identity is durable and global;
    // compare the existing binding before attempting a new claim.
    const existing = await agentExecutionRepository.getSystem(instruction.instructionId)
      || (tenantId ? await agentExecutionRepository.get(tenantId, instruction.instructionId) : null);
    if (existing) {
      const sameIdentity =
        existing.executionId === instruction.instructionId &&
        existing.instructionId === instruction.instructionId &&
        existing.tenantId === tenantId &&
        existing.branchId === branchId &&
        existing.principalId === instruction.context.principal.id &&
        existing.instruction === instruction.text.slice(0, 2000);
      if (!sameIdentity) throw new Error('Agent instruction replay conflict: executionId is already bound to a different principal, scope, or instruction.');
    }

    const claim = await agentExecutionRepository.claim({
      executionId: instruction.instructionId, instructionId: instruction.instructionId, tenantId, branchId,
      principalId: instruction.context.principal.id, instruction: instruction.text.slice(0, 2000),
      intent: plan.intent, status: 'PLANNED', plan, results: [], createdAt: startedAt, completedAt: startedAt,
    }, leaseOwner);

    if (claim.status === 'COMPLETED') {
      const savedPlan = claim.record.plan;
      return {
        instructionId: claim.record.instructionId,
        plan: {
          ...savedPlan,
          teamAssignments: savedPlan.teamAssignments || tdbkAgentTeamCoordinator.coordinate(savedPlan.actions),
        },
        results: claim.record.results,
        completedAt: claim.record.completedAt,
      };
    }
    if (claim.status === 'IN_PROGRESS') throw new Error('Agent instruction is already executing under an active durable lease.');

    const results = [] as AgentRunResult['results'];
    for (const action of plan.actions) {
      const decision = await agentAuthorityPolicy.authorize(instruction, action);
      if (!decision.allowed) {
        const result = { actionId: action.actionId, status: 'AUTHORIZATION_REQUIRED' as const, error: decision.reason };
        results.push(result); agentAudit.action(instruction, action, result); continue;
      }
      try {
        const actionExecutionId = instruction.instructionId + ':' + action.actionId;
        const targetFingerprint = JSON.stringify({
          tenantId: action.tenantId || tenantId, branchId, principalId: instruction.context.principal.id,
          kind: action.kind, workflowId: action.workflowId || null, capabilityId: action.capabilityId || null,
          bridgeId: action.bridgeId || null, blueprintId: action.blueprintId || null,
        });
        const actionClaim = await agentActionExecutionRepository.claim({
          executionId: actionExecutionId, instructionId: instruction.instructionId, actionId: action.actionId,
          tenantId, branchId, principalId: instruction.context.principal.id, actionKind: action.kind,
          targetFingerprint, leaseOwner,
        });
        if (actionClaim.status === 'IN_PROGRESS') {
          const result = { actionId: action.actionId, status: 'FAILED' as const, error: 'Agent action is already executing under an active durable lease.' };
          results.push(result); agentAudit.action(instruction, action, result); continue;
        }

        let result;
        if (actionClaim.status === 'COMPLETED') {
          result = actionClaim.record.result;
          if (!result) throw new Error('Completed agent action has no durable result.');
        } else if (EXECUTABLE_ACTIONS.has(action.kind)) {
          result = await agentActionExecutor.execute(instruction, action);
        } else {
          let data: unknown;
          if (action.kind === 'PLAN_SAFE_REPAIR') data = await agentRepairPlanner.plan(instruction.context);
          else if (action.kind === 'INSPECT_PLATFORM' || action.kind === 'INSPECT_DBKS') data = await controlPlaneTool.execute(instruction.context);
          else if (action.kind === 'INSPECT_WORKFLOWS') data = await workflowTool.execute(instruction.context);
          else if (action.kind === 'INSPECT_BUSINESS_STATE') {
            const target = action.tenantId || instruction.context.tenantContext?.tenantId || instruction.context.principal.tenantId;
            if (!target) throw new Error('Business-state inspection requires a tenant context.');
            data = await businessStateTool.execute(instruction.context, target);
          } else data = { planned: true, message: 'No mutation was executed for this action.' };
          result = { actionId: action.actionId, status: 'COMPLETED' as const, data };
        }

        // Persist the action result before postcondition verification: replay must
        // never execute a completed mutation twice after a process crash.
        if (actionClaim.status === 'ACQUIRED') {
          if (result.status === 'COMPLETED') await agentActionExecutionRepository.complete(actionExecutionId, leaseOwner, result);
          else await agentActionExecutionRepository.fail(actionExecutionId, leaseOwner, result);
        }
        if (result.status === 'COMPLETED') {
          const verification = await agentVerificationEngine.verify(instruction, action, result.data);
          result = { ...result, verification };
          if (!verification.verified) result.status = 'FAILED';
        }
        results.push(result); agentAudit.action(instruction, action, result);
      } catch (error) {
        const result = { actionId: action.actionId, status: 'FAILED' as const, error: error instanceof Error ? error.message : String(error) };
        results.push(result); agentAudit.action(instruction, action, result);
      }
    }

    const hasFailure = results.some((result) => result.status === 'FAILED');
    const needsAuthorization = results.some((result) => result.status === 'AUTHORIZATION_REQUIRED');
    const hasUnverified = results.some((result) => result.verification && !result.verification.verified);
    const completedAt = new Date().toISOString();
    const result: AgentRunResult = { instructionId: instruction.instructionId, plan, results, completedAt };
    const status = hasFailure ? (hasUnverified ? 'VERIFICATION_FAILED' : 'FAILED') : needsAuthorization ? 'AUTHORIZATION_REQUIRED' : 'VERIFIED';

    await agentExecutionRepository.save({
      executionId: instruction.instructionId, instructionId: instruction.instructionId, tenantId, branchId,
      principalId: instruction.context.principal.id, instruction: instruction.text.slice(0, 2000), intent: plan.intent,
      status, plan, results, createdAt: claim.record.createdAt, completedAt, leaseOwner,
    });
    return result;
  }
}

export const tdbkAgentRuntime = new TdbkAgentRuntime();
