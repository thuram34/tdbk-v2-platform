import { dbkLifecycleManager } from '../lifecycle/lifecycleManager';
import { durableJobRuntime } from '../runtime/durableJobRuntime';
import { businessStateEngine } from '../businessState/businessStateEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { dbkRegistry } from '../dbkRegistry';
import { branchManager } from '../branch/branchManager';
import { workspaceManager } from '../workspace/workspaceManager';
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

      case 'ENABLE_CAPABILITY':
        if (!tenantId || !action.capabilityId) throw new Error('DBK and capability are required.');
        return this.completed(action, await dbkCapabilityManager.enableCapabilityPersistent(instruction.context, tenantId, action.capabilityId, 'ENTITLED', false));

      case 'DISABLE_CAPABILITY':
        if (!tenantId || !action.capabilityId) throw new Error('DBK and capability are required.');
        return this.completed(action, await dbkCapabilityManager.disableCapabilityPersistent(instruction.context, tenantId, action.capabilityId));

      case 'REBUILD_BUSINESS_STATE':
        if (!tenantId) throw new Error('Authoritative tenant context is required.');
        return this.completed(action, await businessStateEngine.project(instruction.context, tenantId));

      case 'ENSURE_HEADQUARTERS_BRANCH':
        if (!tenantId) throw new Error('Authoritative DBK target is required.');
        return this.completed(
          action,
          await branchManager.createHeadquartersBranch(instruction.context, tenantId, 'Headquarters'),
        );

      case 'REFRESH_DBK_TOPOLOGY': {
        if (!tenantId) throw new Error('Authoritative DBK target is required.');
        const dbk = await dbkRegistry.getDbk(instruction.context, tenantId);
        if (!dbk) throw new Error(`DBK '${tenantId}' not found.`);
        const branches = await branchManager.listPersistentBranches(instruction.context, tenantId);
        dbk.branchTopology = branches;
        await dbkRegistry.saveDbk(instruction.context, dbk);
        return this.completed(action, { dbkId: tenantId, branchCount: branches.length, branches });
      }

      case 'RECOMPILE_WORKSPACE':
        if (!tenantId) throw new Error('Authoritative DBK target is required.');
        return this.completed(
          action,
          await workspaceManager.compileWorkspaceState(instruction.context, tenantId),
        );

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
