import { dbkRegistry } from '../dbkRegistry';
import { businessStateEngine } from '../businessState/businessStateEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { branchManager } from '../branch/branchManager';
import { workspaceManager } from '../workspace/workspaceManager';
import { AgentAction, AgentInstruction, AgentVerification } from './types';

export class AgentVerificationEngine {
  public async verify(
    instruction: AgentInstruction,
    action: AgentAction,
    data: unknown,
  ): Promise<AgentVerification> {
    const tenantId = action.tenantId || instruction.context.tenantContext?.tenantId || instruction.context.principal.tenantId;

    if (action.kind === 'PROVISION_DBK') {
      if (!tenantId) return { verified: false, summary: 'Provisioning verification requires an authoritative DBK target.' };
      const dbk = await dbkRegistry.getDbk(instruction.context, tenantId);
      const branches = await branchManager.listPersistentBranches(instruction.context, tenantId);
      const provisioningResult = data as { success?: boolean; status?: string; workflowId?: string } | undefined;
      const verified = Boolean(
        dbk &&
        dbk.dbkId === tenantId &&
        dbk.status === 'ACTIVE' &&
        branches.some((branch) => branch.dbkId === tenantId && branch.isHeadquarters && branch.status === 'ACTIVE') &&
        provisioningResult?.success === true,
      );
      return {
        verified,
        summary: verified
          ? `Verified DBK '${tenantId}' is ACTIVE with an ACTIVE headquarters branch after provisioning.`
          : `Provisioning verification failed for DBK '${tenantId}': authoritative identity, ACTIVE status, or headquarters branch is missing.`,
        data: {
          dbkId: tenantId,
          status: dbk?.status ?? null,
          branchCount: branches.length,
          hasActiveHeadquarters: branches.some((branch) => branch.isHeadquarters && branch.status === 'ACTIVE'),
          workflowId: provisioningResult?.workflowId ?? null,
          executionResult: data,
        },
      };
    }

    if (action.kind === 'ENABLE_CAPABILITY' || action.kind === 'DISABLE_CAPABILITY') {
      if (!tenantId || !action.capabilityId) return { verified: false, summary: 'Capability verification requires an authoritative DBK and capability target.' };
      const record = await dbkCapabilityManager.hydratePersistentCapability(instruction.context, tenantId, action.capabilityId);
      const expected = action.kind === 'ENABLE_CAPABILITY' ? ['ENABLED', 'CONFIGURED'] : ['DISABLED'];
      const verified = Boolean(record && expected.includes(record.state));
      return { verified, summary: verified ? `Verified capability '${action.capabilityId}' is ${record?.state} for DBK '${tenantId}'.` : `Capability verification failed for '${action.capabilityId}' on DBK '${tenantId}'.`, data: { dbkId: tenantId, capabilityId: action.capabilityId, state: record?.state ?? null, executionResult: data } };
    }

    if (action.kind === 'REBUILD_BUSINESS_STATE') {
      if (!tenantId) return { verified: false, summary: 'Business-state repair verification requires an authoritative DBK target.' };
      const current = await dbkRegistry.getDbk(instruction.context, tenantId);
      if (!current) return { verified: false, summary: `DBK '${tenantId}' could not be read during repair verification.` };
      const snapshot = await businessStateEngine.getCurrent(instruction.context, tenantId);
      const verified = Boolean(snapshot && snapshot.version > 0 && snapshot.dbkId === tenantId);
      return {
        verified,
        summary: verified
          ? `Verified canonical business state exists for DBK '${tenantId}' at version ${snapshot?.version}.`
          : `Verification failed: canonical business state is still missing for DBK '${tenantId}'.`,
        data: { dbkId: tenantId, stateVersion: snapshot?.version ?? null, executionResult: data },
      };
    }

    if (action.kind === 'ENSURE_HEADQUARTERS_BRANCH') {
      if (!tenantId) return { verified: false, summary: 'Headquarters verification requires an authoritative DBK target.' };
      const hq = await branchManager.getPersistentBranch(instruction.context, tenantId, `${tenantId}_hq`);
      const verified = Boolean(hq && hq.dbkId === tenantId && hq.isHeadquarters && hq.status === 'ACTIVE');
      return {
        verified,
        summary: verified
          ? `Verified headquarters branch '${tenantId}_hq' is ACTIVE for DBK '${tenantId}'.`
          : `Verification failed: headquarters branch '${tenantId}_hq' is not active for DBK '${tenantId}'.`,
        data: { dbkId: tenantId, branchId: hq?.branchId ?? null, executionResult: data },
      };
    }

    if (action.kind === 'REFRESH_DBK_TOPOLOGY') {
      if (!tenantId) return { verified: false, summary: 'Topology verification requires an authoritative DBK target.' };
      const dbk = await dbkRegistry.getDbk(instruction.context, tenantId);
      const branches = await branchManager.listPersistentBranches(instruction.context, tenantId);
      const verified = Boolean(dbk && JSON.stringify(dbk.branchTopology) === JSON.stringify(branches));
      return {
        verified,
        summary: verified
          ? `Verified DBK '${tenantId}' branchTopology matches authoritative branch storage.`
          : `Verification failed: DBK '${tenantId}' branchTopology does not match authoritative branch storage.`,
        data: { dbkId: tenantId, branchCount: branches.length, executionResult: data },
      };
    }

    if (action.kind === 'RECOMPILE_WORKSPACE') {
      if (!tenantId) return { verified: false, summary: 'Workspace verification requires an authoritative DBK target.' };
      const workspace = await workspaceManager.compileWorkspaceState(instruction.context, tenantId);
      const dbk = await dbkRegistry.getDbk(instruction.context, tenantId);
      const verified = Boolean(workspace && dbk && workspace.dbkId === dbk.dbkId && workspace.status === dbk.status);
      return {
        verified,
        summary: verified
          ? `Verified workspace projection for DBK '${tenantId}' compiles from authoritative DBK state.`
          : `Workspace verification failed for DBK '${tenantId}'.`,
        data: { dbkId: tenantId, workspaceVersion: workspace.workspaceVersion, executionResult: data },
      };
    }

    if (!['SUSPEND_DBK', 'REACTIVATE_DBK', 'ARCHIVE_DBK', 'RESTORE_DBK'].includes(action.kind)) {
      return {
        verified: true,
        summary: 'Execution returned successfully; no postcondition-specific verifier is required for this action.',
      };
    }

    if (!tenantId) {
      return { verified: false, summary: 'Postcondition verification requires an authoritative DBK target.' };
    }

    const dbk = await dbkRegistry.getDbk(instruction.context, tenantId);
    if (!dbk) {
      return {
        verified: false,
        summary: `DBK '${tenantId}' could not be read back from the authoritative registry.`,
      };
    }

    const expectedStatus: Record<string, string> = {
      SUSPEND_DBK: 'SUSPENDED',
      REACTIVATE_DBK: 'ACTIVE',
      ARCHIVE_DBK: 'ARCHIVED',
      RESTORE_DBK: 'ACTIVE',
    };
    const expected = expectedStatus[action.kind];
    const verified = dbk.status === expected;

    return {
      verified,
      summary: verified
        ? `Verified DBK '${tenantId}' status is ${expected} in the authoritative registry.`
        : `Verification failed: DBK '${tenantId}' status is ${dbk.status}; expected ${expected}.`,
      data: { dbkId: tenantId, expectedStatus: expected, actualStatus: dbk.status, executionResult: data },
    };
  }
}

export const agentVerificationEngine = new AgentVerificationEngine();
