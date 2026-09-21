import { describe, expect, it, vi } from 'vitest';
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

  it('parses complete DBK provisioning commands', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_provision',
      text: 'Provision DBK shop_mombasa name: Mombasa Retail blueprint: retail tier: foundation',
      context: {} as any,
    });
    expect(result.intent).toBe('DBK_PROVISIONING');
    expect(result.actions[0]).toMatchObject({
      kind: 'PROVISION_DBK',
      tenantId: 'shop_mombasa',
      legalName: 'Mombasa Retail',
      blueprintId: 'retail',
      subscriptionTier: 'FOUNDATION',
      authority: 'ADMIN',
      requiresAuthorization: true,
    });
  });

  it('parses connector activation commands', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_connector_activate',
      text: 'Activate M-Pesa connector for DBK shop_mombasa',
      context: {} as any,
    });
    expect(result.intent).toBe('CONNECTOR_ACTIVATION');
    expect(result.actions[0]).toMatchObject({
      kind: 'ACTIVATE_CONNECTOR',
      tenantId: 'shop_mombasa',
      bridgeId: 'bridge_mpesa',
      authority: 'CONNECTOR',
      requiresAuthorization: true,
    });
  });

  it('parses arbitrary registered bridge IDs without truncating their first character', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_generic_connector_activate',
      text: 'Activate bridge stripe for DBK shop_mombasa',
      context: {} as any,
    });
    expect(result.actions[0].bridgeId).toBe('stripe');
  });

  it('allows tenant-authorized connector activation', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize({
      instructionId: 'i_connector_auth',
      text: 'Activate M-Pesa connector for DBK shop_mombasa',
      context: {
        requestId: 'req_connector_auth',
        principal: {
          id: 'owner',
          isMaster: false,
          tenantId: 'shop_mombasa',
          branchId: null,
          roles: ['OWNER_OPERATOR'],
          permissions: [],
          authTime: Date.now(),
          tokenSource: 'SESSION',
        },
      } as any,
      requestedAuthority: 'CONNECTOR',
    }, {
      actionId: 'a_connector',
      kind: 'ACTIVATE_CONNECTOR',
      authority: 'CONNECTOR',
      description: 'activate connector',
      requiresAuthorization: true,
      tenantId: 'shop_mombasa',
      bridgeId: 'bridge_mpesa',
    });
    expect(result.allowed).toBe(true);
  });

  it('parses end-to-end business activation commands', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_activate_business',
      text: 'Activate business for DBK shop_mombasa',
      context: {} as any,
    });
    expect(result.intent).toBe('BUSINESS_ACTIVATION');
    expect(result.actions[0]).toMatchObject({
      kind: 'ACTIVATE_BUSINESS',
      tenantId: 'shop_mombasa',
      authority: 'ADMIN',
      requiresAuthorization: true,
    });
  });

  it('allows tenant-authorized business activation', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize({
      instructionId: 'i_activate_auth',
      text: 'Activate business for DBK shop_mombasa',
      context: {
        requestId: 'req_activate_auth',
        principal: {
          id: 'owner',
          isMaster: false,
          tenantId: 'shop_mombasa',
          branchId: null,
          roles: ['BUSINESS_OWNER'],
          permissions: [],
          authTime: Date.now(),
          tokenSource: 'SESSION',
        },
      } as any,
      requestedAuthority: 'ADMIN',
    }, {
      actionId: 'a_activate',
      kind: 'ACTIVATE_BUSINESS',
      authority: 'ADMIN',
      description: 'activate business',
      requiresAuthorization: true,
      tenantId: 'shop_mombasa',
    });
    expect(result.allowed).toBe(true);
  });

  it('parses blueprint-driven business composition commands', () => {
    const parser = new TdbkInstructionParser();
    const result = parser.parse({
      instructionId: 'i_compose',
      text: 'Compose business for DBK shop_mombasa',
      context: {} as any,
    });
    expect(result.intent).toBe('BUSINESS_COMPOSITION');
    expect(result.actions[0]).toMatchObject({
      kind: 'COMPOSE_BUSINESS',
      tenantId: 'shop_mombasa',
      authority: 'ADMIN',
      requiresAuthorization: true,
    });
  });

  it('allows tenant-authorized business composition', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize({
      instructionId: 'i_compose_auth',
      text: 'Compose business for DBK shop_mombasa',
      context: {
        requestId: 'req_compose_auth',
        principal: {
          id: 'owner',
          isMaster: false,
          tenantId: 'shop_mombasa',
          branchId: null,
          roles: ['OWNER_OPERATOR'],
          permissions: [],
          authTime: Date.now(),
          tokenSource: 'SESSION',
        },
      } as any,
      requestedAuthority: 'ADMIN',
    }, {
      actionId: 'a_compose',
      kind: 'COMPOSE_BUSINESS',
      authority: 'ADMIN',
      description: 'compose business',
      requiresAuthorization: true,
      tenantId: 'shop_mombasa',
    });
    expect(result.allowed).toBe(true);
  });

  it('requires owner or master authority for provisioning', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize({
      instructionId: 'i_provision_auth',
      text: 'Provision DBK shop_mombasa name: Mombasa Retail blueprint: retail',
      context: {
        requestId: 'req_provision_auth',
        principal: {
          id: 'owner',
          isMaster: false,
          tenantId: null,
          branchId: null,
          roles: ['BUSINESS_OWNER'],
          permissions: [],
          authTime: Date.now(),
          tokenSource: 'SESSION',
        },
      } as any,
      requestedAuthority: 'ADMIN',
    }, {
      actionId: 'a_provision',
      kind: 'PROVISION_DBK',
      authority: 'ADMIN',
      description: 'provision',
      requiresAuthorization: true,
      tenantId: 'shop_mombasa',
      legalName: 'Mombasa Retail',
      blueprintId: 'retail',
    });
    expect(result.allowed).toBe(true);
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

  it('does not let a tenant staff member escalate a mutation using requested authority', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize({
      instructionId: 'i_staff_escalation',
      text: 'Disable capability pos for DBK shop_mombasa',
      context: {
        requestId: 'req_staff_escalation',
        principal: {
          id: 'staff', isMaster: false, tenantId: 'shop_mombasa', branchId: null,
          roles: ['STAFF'], permissions: [], authTime: Date.now(), tokenSource: 'SESSION',
        },
      } as any,
      requestedAuthority: 'ADMIN',
    }, {
      actionId: 'a_staff_escalation', kind: 'DISABLE_CAPABILITY', authority: 'ADMIN',
      description: 'disable capability', requiresAuthorization: true, tenantId: 'shop_mombasa', capabilityId: 'pos',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('capabilities:write');
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


describe('TDBK command agent execution replay binding', () => {
  it('rejects reuse of an execution id across principal or scope changes', async () => {
    const { tdbkAgentRuntime } = await import('../agent/agentRuntime');
    const { agentExecutionRepository } = await import('../../persistence/firestore/repositories/agentExecutionRepository');

    vi.spyOn(agentExecutionRepository, 'get').mockResolvedValue({
      executionId: 'replay-1',
      instructionId: 'replay-1',
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      principalId: 'principal-a',
      instruction: 'Inspect DBKs',
      intent: 'TDBK_OPERATIONAL_INSPECTION',
      status: 'VERIFIED',
      plan: { instructionId: 'replay-1', intent: 'TDBK_OPERATIONAL_INSPECTION', actions: [], generatedAt: new Date().toISOString() },
      results: [],
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    } as any);

    await expect(
      tdbkAgentRuntime.run({
        instructionId: 'replay-1',
        text: 'Inspect DBKs',
        context: {
          requestId: 'req-replay',
          principal: {
            id: 'principal-b',
            tenantId: 'tenant-b',
            branchId: 'branch-b',
          },
          tenantContext: { tenantId: 'tenant-b' },
        } as any,
      } as any),
    ).rejects.toThrow('Agent instruction replay conflict');

    vi.restoreAllMocks();
  });
});
