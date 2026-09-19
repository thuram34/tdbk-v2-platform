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

  it('requires stronger requested authority before executing a mutation', async () => {
    const policy = new AgentAuthorityPolicy();
    const result = await policy.authorize(
      { instructionId: 'i3', text: 'Suspend DBK shop_mombasa', context: {} as any, requestedAuthority: 'OBSERVE' },
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
