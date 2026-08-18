import { describe, it, expect } from 'vitest';
import { Phase1TestRunner } from './phase1TestRunner';

describe('TDBK V2 Phase 1 — Blueprint Compiler & Business DNA Test Suite', () => {
  it('should pass all 17 mandatory Phase 1 test cases', async () => {
    const summary = await Phase1TestRunner.runAllTests();

    summary.results.forEach((test) => {
      if (!test.passed) {
        console.error(`[PHASE1_TEST_FAIL] ${test.id} (${test.name}): ${test.actual}`);
      }
      expect(test.passed).toBe(true);
    });

    expect(summary.passedCount).toBe(17);
    expect(summary.failedCount).toBe(0);
  });
});
