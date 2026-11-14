import { afterEach, describe, expect, it, vi } from 'vitest';
import { MpesaBridge } from '../bridge/adapters/mpesaBridge';

describe('M-Pesa production callback verification gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects production callbacks even when callers supply a plausible signature and timestamp', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const bridge = new MpesaBridge();
    const result = await bridge.verifyCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: 'MR_FORGED_001',
          CheckoutRequestID: 'ws_CO_FORGED_001',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
        },
      },
      signature: 'VALID_SIG',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant_untrusted',
      correlationId: 'corr_untrusted',
    }, 'VALID_SIG');

    expect(result.verified).toBe(false);
    expect(result.replayProtectionPassed).toBe(false);
    expect(result.reason).toContain('PRODUCTION_CALLBACK_VERIFICATION_UNAVAILABLE');
  });

  it('keeps explicit invalid callback markers rejected outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const bridge = new MpesaBridge();
    const result = await bridge.verifyCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: 'MR_INVALID_001',
          CheckoutRequestID: 'ws_CO_INVALID_001',
          ResultCode: 0,
          ResultDesc: 'Test',
        },
      },
      signature: 'INVALID_SIG',
    });

    expect(result.verified).toBe(false);
  });
});
