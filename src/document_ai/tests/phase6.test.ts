import { describe, it, expect } from 'vitest';
import { runPhase6TestSuite } from './phase6TestRunner';

describe('TDBK V2 Test Suite', () => {
  it('should pass all tests', async () => {
    const summary = await runPhase6TestSuite();
    for (const testCase of summary.results) {
      expect(testCase.status === 'PASS' ? 'PASSED' : testCase.status, `[${testCase.id}] ${testCase.name} failed: ${testCase.details || ''}`).toBe('PASSED');
    }
  });
});
