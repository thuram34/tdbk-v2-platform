import { dbkRegistry } from '../dbkRegistry';
import { AgentAction, AgentInstruction, AgentVerification } from './types';

export class AgentVerificationEngine {
  public async verify(
    instruction: AgentInstruction,
    action: AgentAction,
    data: unknown,
  ): Promise<AgentVerification> {
    if (!['SUSPEND_DBK', 'REACTIVATE_DBK', 'ARCHIVE_DBK', 'RESTORE_DBK'].includes(action.kind)) {
      return {
        verified: true,
        summary: 'Execution returned successfully; no postcondition-specific verifier is required for this action.',
      };
    }

    const tenantId =
      action.tenantId ||
      instruction.context.tenantContext?.tenantId ||
      instruction.context.principal.tenantId;
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
