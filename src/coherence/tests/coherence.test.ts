import { describe, it, expect } from 'vitest';
import { runCoherenceTestSuite } from './coherenceTestRunner';

describe('TDBK V2 Role-Based Coherence Engine (RBCE) Test Suite', () => {
  it('should pass all RBCE verification tests', async () => {
    const summary = await runCoherenceTestSuite();
    for (const res of summary.results) {
      if (!res.passed) {
        console.error(`FAILED TEST [${res.category}] ${res.testName}: ${res.message}`, res.evidence);
      }
    }
    expect(summary.failedTests).toBe(0);
    expect(summary.passedTests).toBe(summary.totalTests);
  });
});
