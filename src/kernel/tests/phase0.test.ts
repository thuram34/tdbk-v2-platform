import { describe, it, expect } from 'vitest';
import { phase0TestRunner } from './phase0TestRunner';

describe('TDBK V2 Phase 0 Kernel Foundation & Security Test Suite', () => {
  it('should pass all phase 0 tests', async () => {
    const suiteResults = await phase0TestRunner.runAllTests();
    for (const testCase of suiteResults.results) {
      expect(testCase.status, `[${testCase.testId}] ${testCase.name} failed: ${testCase.actualResult}`).toBe('PASSED');
    }
  });
});
