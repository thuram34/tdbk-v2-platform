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

  it('fails closed when no provider-verifiable callback authentication contract is configured', async () => {
    const bridge = new EtimsBridge();
    const context = {
      requestId: 'req_etims_2',
      principal: { id: 'principal_1', tenantId: 'tenant_authoritative' },
      tenantContext: { tenantId: 'tenant_authoritative' },
    } as any;

    const callback = {
      kraIcn: 'KRA-002',
      amount: 2500,
      status: 'SUCCESS',
      signature: 'VALID_SIG',
      correlationId: 'corr_002',
    };

    const verification = await bridge.verifyCallback(callback, 'VALID_SIG');
    expect(verification.verified).toBe(false);
    expect(verification.reason).toBe('ETIMS_CALLBACK_AUTHENTICATION_NOT_CONFIGURED');

    await expect(bridge.handleCallback(context, callback)).rejects.toThrow(
      'ETIMS_CALLBACK_AUTHENTICATION_NOT_CONFIGURED',
    );
  });
});
