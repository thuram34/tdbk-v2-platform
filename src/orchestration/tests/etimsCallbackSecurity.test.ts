import { describe, expect, it } from 'vitest';
import { EtimsBridge } from '../bridge/adapters/etimsBridge';

describe('eTIMS callback tenant authorization', () => {
  it('rejects a provider tenant that conflicts with authoritative context', async () => {
    const bridge = new EtimsBridge();
    const context = {
      requestId: 'req_etims_1',
      principal: { id: 'principal_1', tenantId: 'tenant_authoritative' },
      tenantContext: { tenantId: 'tenant_authoritative' },
    } as any;

    await expect(
      bridge.handleCallback(context, {
        tenantId: 'tenant_attacker',
        kraIcn: 'KRA-001',
        amount: 1000,
        status: 'SUCCESS',
      }),
    ).rejects.toThrow('eTIMS callback tenant conflicts with authoritative tenant context');
  });

  it('uses the authoritative tenant when callback metadata omits tenantId', async () => {
    const bridge = new EtimsBridge();
    const context = {
      requestId: 'req_etims_2',
      principal: { id: 'principal_1', tenantId: 'tenant_authoritative' },
      tenantContext: { tenantId: 'tenant_authoritative' },
    } as any;

    const result = await bridge.handleCallback(context, {
      kraIcn: 'KRA-002',
      amount: 2500,
      status: 'SUCCESS',
      correlationId: 'corr_002',
    });

    expect(result.providerReference).toBe('KRA-002');
    expect(result.amount).toBe(2500);
    expect(result.currency).toBe('KES');
  });
});
