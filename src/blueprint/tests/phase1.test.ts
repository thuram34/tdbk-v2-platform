import { describe, it, expect } from 'vitest';
import { Phase1TestRunner } from './phase1TestRunner';

describe('TDBK V2 Test Suite', () => {
  it('should pass all tests', async () => {
    const summary = await Phase1TestRunner.runAllTests();
    for (const testCase of summary.results) {
      expect(testCase.passed ? 'PASSED' : 'FAILED', `[${testCase.id}] ${testCase.name} failed: ${''}`).toBe('PASSED');
    }
  });
});
