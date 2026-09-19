import { describe, expect, it } from 'vitest';
import { TdbkInstructionParser } from '../agent/instructionParser';
import { AgentAuthorityPolicy } from '../agent/authorityPolicy';

describe('TDBK command agent', () => {
  it('turns operational instructions into typed plans', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i1',
      text: 'Inspect every DBK and tell me which ones need attention.',
      context: {} as any,
    });
    expect(result.intent).toBe('TDBK_OPERATIONAL_INSPECTION');
    expect(result.actions.some((a) => a.kind === 'INSPECT_DBKS')).toBe(true);
  });

  it('parses an executable DBK lifecycle command', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i2',
      text: 'Suspend DBK shop_mombasa',
      context: {} as any,
    });
    expect(result.intent).toBe('DBK_SUSPENSION');
    expect(result.actions[0]).toMatchObject({
      kind: 'SUSPEND_DBK',
      authority: 'ADMIN',
      tenantId: 'shop_mombasa',
      requiresAuthorization: true,
    });
  });

  it('prefers an explicit DBK target over ambient tenant context', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_target',
      text: 'Suspend DBK shop_mombasa',
      context: {
        principal: { tenantId: 'wrong_tenant' },
        tenantContext: { tenantId: 'wrong_tenant' },
      } as any,
    });
    expect(result.actions[0].tenantId).toBe('shop_mombasa');
  });

  it('does not confuse workflow resume with DBK reactivation', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_workflow_resume',
      text: 'Resume workflow wf_123',
      context: {} as any,
    });
    expect(result.intent).toBe('WORKFLOW_RECOVERY');
    expect(result.actions[0].kind).toBe('RECOVER_WORKFLOWS');
  });

  it('parses a capability mutation with explicit DBK and capability targets', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_cap',
      text: 'Enable capability pos for DBK shop_mombasa',
      context: {} as any,
    });
    expect(result.intent).toBe('CAPABILITY_ENABLE');
    expect(result.actions[0]).toMatchObject({
      kind: 'ENABLE_CAPABILITY',
      tenantId: 'shop_mombasa',
      capabilityId: 'pos',
      authority: 'ADMIN',
      requiresAuthorization: true,
    });
  });

  it('parses capability disable commands', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_cap_disable',
      text: 'Disable capability pos for DBK shop_mombasa',
      context: {} as any,
    });
    expect(result.intent).toBe('CAPABILITY_DISABLE');
    expect(result.actions[0].kind).toBe('DISABLE_CAPABILITY');
  });

  it('parses DBK construction commands for headquarters and topology repair', () => {
    const parser = new TdbkInstructionParser();

    const hq = parser.parse({
      instructionId: 'i_hq',
      text: 'Ensure headquarters branch for DBK shop_mombasa',
      context: {} as any,
    });
    expect(hq.intent).toBe('ENSURE_HEADQUARTERS_BRANCH');
    expect(hq.actions[0]).toMatchObject({
      kind: 'ENSURE_HEADQUARTERS_BRANCH',
      tenantId: 'shop_mombasa',
      authority: 'ADMIN',
      requiresAuthorization: true,
    });

    const topology = parser.parse({
      instructionId: 'i_topology',
      text: 'Refresh branch topology for DBK shop_mombasa',
      context: {} as any,
    });
    expect(topology.intent).toBe('REFRESH_DBK_TOPOLOGY');
    expect(topology.actions[0].kind).toBe('REFRESH_DBK_TOPOLOGY');
  });

  it('parses workspace recompilation commands', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_workspace',
      text: 'Recompile workspace for DBK shop_mombasa',
      context: {} as any,
    });
    expect(result.intent).toBe('RECOMPILE_WORKSPACE');
    expect(result.actions[0]).toMatchObject({
      kind: 'RECOMPILE_WORKSPACE',
      tenantId: 'shop_mombasa',
      authority: 'DIAGNOSE',
      requiresAuthorization: true,
    });
  });

  it('requires stronger requested authority before executing a mutation', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize(
      {
        instructionId: 'i3',
        text: 'Suspend DBK shop_mombasa',
        context: {
          principal: {
            id: 'user',
            isMaster: false,
            tenantId: 'shop_mombasa',
            branchId: null,
            roles: ['OWNER_OPERATOR'],
            permissions: ['*'],
            authTime: Date.now(),
            tokenSource: 'SESSION',
          },
        },
        requestedAuthority: 'OBSERVE',
      } as any,
      {
        actionId: 'a1',
        kind: 'SUSPEND_DBK',
        authority: 'ADMIN',
        description: 'suspend',
        requiresAuthorization: true,
        tenantId: 'shop_mombasa',
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("below required 'ADMIN'");
  });

  it('requires real TDBK MASTER authority for lifecycle mutation', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize(
      {
        instructionId: 'i4',
        text: 'Suspend DBK shop_mombasa',
        context: {
          principal: {
            id: 'user',
            email: 'user@example.com',
            isMaster: false,
            tenantId: 'shop_mombasa',
            branchId: null,
            roles: ['OWNER_OPERATOR'],
            permissions: ['*'],
            authTime: Date.now(),
            tokenSource: 'SESSION',
          },
        } as any,
        requestedAuthority: 'ADMIN',
      },
      {
        actionId: 'a1',
        kind: 'SUSPEND_DBK',
        authority: 'ADMIN',
        description: 'suspend',
        requiresAuthorization: true,
        tenantId: 'shop_mombasa',
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('TDBK MASTER');
  });

  it('allows tenant-authorized DBK construction', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize(
      {
        instructionId: 'i6',
        text: 'Ensure headquarters branch for DBK shop_mombasa',
        context: {
          requestId: 'req_i6',
          principal: {
            id: 'owner',
            email: 'owner@example.com',
            isMaster: false,
            tenantId: 'shop_mombasa',
            branchId: null,
            roles: ['OWNER_OPERATOR'],
            permissions: ['branch:create'],
            authTime: Date.now(),
            tokenSource: 'SESSION',
          },
          tenantContext: {
            tenantId: 'shop_mombasa',
            name: 'Shop Mombasa',
            blueprintId: 'retail',
            status: 'ACTIVE',
          },
        } as any,
        requestedAuthority: 'ADMIN',
      },
      {
        actionId: 'a1',
        kind: 'ENSURE_HEADQUARTERS_BRANCH',
        authority: 'ADMIN',
        description: 'ensure HQ',
        requiresAuthorization: true,
        tenantId: 'shop_mombasa',
      },
    );
    expect(result.allowed).toBe(true);
  });

  it('allows an authenticated master lifecycle command', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize(
      {
        instructionId: 'i5',
        text: 'Suspend DBK shop_mombasa',
        context: {
          requestId: 'req_i5',
          principal: {
            id: 'master',
            email: 'master@example.com',
            isMaster: true,
            tenantId: null,
            branchId: null,
            roles: ['TDBK_MASTER_ADMIN'],
            permissions: ['*'],
            authTime: Date.now(),
            tokenSource: 'SERVICE_KEY',
          },
        } as any,
        requestedAuthority: 'ADMIN',
      },
      {
        actionId: 'a1',
        kind: 'SUSPEND_DBK',
        authority: 'ADMIN',
        description: 'suspend',
        requiresAuthorization: true,
        tenantId: 'shop_mombasa',
      },
    );
    expect(result.allowed).toBe(true);
  });
});
