import { describe, it, expect } from 'vitest';
import { runPhase5TestSuite } from './phase5TestRunner';

describe('TDBK V2 Test Suite', () => {
  it('should pass all tests', async () => {
    const summary = await runPhase5TestSuite();
    for (const testCase of summary.results) {
      expect(testCase.status === 'PASS' ? 'PASSED' : testCase.status, `[${testCase.id}] ${testCase.name} failed: ${testCase.error || testCase.details || ''}`).toBe('PASSED');
    }
  });
});
