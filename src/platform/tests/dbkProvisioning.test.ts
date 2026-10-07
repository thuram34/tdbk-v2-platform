import { describe, expect, it } from 'vitest';
import { runDbkProvisioningTestSuite } from './dbkProvisioningTestRunner';

describe('TDBK DBK provisioning acceptance', () => {
  it('proves provisioning creates an active DBK with isolated workspace, branch, capabilities and correct experience projection', async () => {
    const summary = await runDbkProvisioningTestSuite();

    for (const testCase of summary.results) {
      expect(
        testCase.passed,
        `[${testCase.id}] ${testCase.name} failed: ${testCase.details}`,
      ).toBe(true);
    }

    expect(summary.failed, 'DBK provisioning acceptance suite has failures').toBe(0);
    expect(summary.passed).toBe(summary.total);
  }, 120_000);
});
