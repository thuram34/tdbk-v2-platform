import { describe, expect, it } from 'vitest';
import { flowOrchestrator } from './flowOrchestrator';
import { AuthenticationError, AuthorizationError } from '../../kernel/errors/kernelErrors';
import { SecurityContext } from '../../kernel/types';

const testContext = (): SecurityContext => ({
  requestId: 'req_flow_test',
  correlationId: 'corr_flow_test',
  timestamp: new Date().toISOString(),
  principal: {
    id: 'usr_flow_test', email: 'flow@test.local', isMaster: false,
    tenantId: 'tenant_flow', branchId: 'branch_hq', roles: ['OWNER'], permissions: [],
    authTime: Math.floor(Date.now() / 1000), tokenSource: 'JWT',
  },
  tenantContext: { tenantId: 'tenant_flow' } as any,
  branchContext: { branchId: 'branch_hq', tenantId: 'tenant_flow' } as any,
  ipAddress: '127.0.0.1', userAgent: 'vitest',
});

describe('FlowOrchestrator', () => {
  it('coordinates successful stages', async () => {
    const result = await flowOrchestrator.execute({
      name: 'test-order',
      context: testContext(),
      execute: async (_state, advance) => {
        const identity = await advance('IDENTITY', async () => ({
          stage: 'IDENTITY', status: 'COMPLETED' as const, output: { authenticated: true },
        }));
        return advance('RUNTIME', async () => ({
          stage: 'RUNTIME', status: 'COMPLETED' as const,
          output: { commandAccepted: identity.authenticated },
        }));
      },
    });
    expect(result.state.status).toBe('COMPLETED');
    expect(result.state.completedStages).toEqual(['IDENTITY', 'RUNTIME']);
    expect(result.output).toEqual({ commandAccepted: true });
  });

  it('preserves authentication failure as a security failure', async () => {
    await expect(flowOrchestrator.execute({
      name: 'auth-failure',
      context: testContext(),
      execute: async (_state, advance) => advance('IDENTITY', async () => {
        throw new AuthenticationError('Authentication unavailable', 'req_flow_test');
      }),
    })).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('preserves authorization failure', async () => {
    await expect(flowOrchestrator.execute({
      name: 'authorization-failure',
      context: testContext(),
      execute: async (_state, advance) => advance('CAPABILITY', async () => {
        throw new AuthorizationError('Capability denied', 'req_flow_test');
      }),
    })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('does not turn WAITING into COMPLETED', async () => {
    const result = await flowOrchestrator.execute({
      name: 'external-wait',
      context: testContext(),
      execute: async (_state, advance) => advance('INTEGRATION', async () => ({
        stage: 'INTEGRATION', status: 'WAITING' as const, output: { reconciliationRequired: true },
      })),
    });
    expect(result.state.status).toBe('WAITING');
    expect(result.state.completedStages).toEqual([]);
  });
});
