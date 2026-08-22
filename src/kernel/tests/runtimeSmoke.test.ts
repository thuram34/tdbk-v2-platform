import { describe, it, expect } from 'vitest';
import { runtimeSmokeTestRunner } from './runtimeSmokeTest';

describe('TDBK V2 Test Suite', () => {
  it('should pass all tests', async () => {
    const suiteResults = await runtimeSmokeTestRunner.runAllTests();
    for (const testCase of suiteResults.results) {
      expect(testCase.status, `[${testCase.testId}] ${testCase.name} failed: ${testCase.details}`).toBe('PASSED');
    }
  });
});
