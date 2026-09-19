import { describe, expect, it } from 'vitest';
import { TdbkInstructionParser } from '../agent/instructionParser';
import { AgentAuthorityPolicy } from '../agent/authorityPolicy';

describe('TDBK command agent', () => {
  it('turns operational instructions into typed plans', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({ instructionId: 'i1', text: 'Inspect every DBK and tell me which ones need attention.', context: {} as any });
    expect(result.intent).toBe('TDBK_OPERATIONAL_INSPECTION');
    expect(result.actions.some((a) => a.kind === 'INSPECT_DBKS')).toBe(true);
  });

  it('never executes a mutation-capable action without authorization', () => {
    const policy = new AgentAuthorityPolicy();
    const result = policy.authorize({ instructionId: 'i2', text: 'Repair safe issues', context: {} as any }, { actionId: 'a1', kind: 'PLAN_SAFE_REPAIR', authority: 'SAFE_REPAIR', description: 'repair', requiresAuthorization: true });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('explicit authorization');
  });
});
