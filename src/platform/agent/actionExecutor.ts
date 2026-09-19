import { dbkLifecycleManager } from '../lifecycle/lifecycleManager';
import { durableJobRuntime } from '../runtime/durableJobRuntime';
import { AgentAction, AgentActionResult, AgentInstruction } from './types';

export class AgentActionExecutor {
  public async execute(instruction: AgentInstruction, action: AgentAction): Promise<AgentActionResult> {
    const tenantId =
      action.tenantId ||
      instruction.context.tenantContext?.tenantId ||
      instruction.context.principal.tenantId;

    switch (action.kind) {
      case 'SUSPEND_DBK':
        if (!tenantId) throw new Error('DBK target is required.');
        return this.completed(action, await dbkLifecycleManager.suspendDbk(instruction.context, tenantId, this.reason(instruction)));

      case 'REACTIVATE_DBK':
        if (!tenantId) throw new Error('DBK target is required.');
        return this.completed(action, await dbkLifecycleManager.reactivateDbk(instruction.context, tenantId, this.reason(instruction)));

      case 'ARCHIVE_DBK':
        if (!tenantId) throw new Error('DBK target is required.');
        return this.completed(action, await dbkLifecycleManager.archiveDbk(instruction.context, tenantId, this.reason(instruction)));

      case 'RESTORE_DBK':
        if (!tenantId) throw new Error('DBK target is required.');
        return this.completed(action, await dbkLifecycleManager.restoreDbk(instruction.context, tenantId, this.reason(instruction)));

      case 'RECOVER_WORKFLOWS':
        if (!tenantId) throw new Error('Authoritative tenant context is required.');
        return this.completed(action, await durableJobRuntime.recover({
          ...instruction.context,
          tenantContext: instruction.context.tenantContext || {
            tenantId,
            name: tenantId,
            blueprintId: 'agent-runtime',
            status: 'ACTIVE',
          },
        }));

      case 'EXECUTE_WORKFLOW':
        if (!tenantId || !action.workflowId) throw new Error('Tenant and workflow ID are required.');
        return this.completed(
          action,
          await durableJobRuntime.execute({
            ...instruction.context,
            tenantContext: instruction.context.tenantContext || {
              tenantId,
              name: tenantId,
              blueprintId: 'agent-runtime',
              status: 'ACTIVE',
            },
          }, action.workflowId),
        );

      default:
        throw new Error(`Action '${action.kind}' is not executable by the command executor.`);
    }
  }

  private completed(action: AgentAction, data: unknown): AgentActionResult {
    return { actionId: action.actionId, status: 'COMPLETED', data };
  }

  private reason(instruction: AgentInstruction): string {
    return `Authorized by TDBK Command Agent instruction ${instruction.instructionId}: ${instruction.text.slice(0, 300)}`;
  }
}

export const agentActionExecutor = new AgentActionExecutor();
