/**
 * TDBK V2 MULTI-BUSINESS SUITE EXPORT
 */

import { describe, it, expect } from 'vitest';
import { runMultiBusinessTestSuite } from './multiBusinessTestRunner';

describe('TDBK V2 Multi-Business & Owner Portfolio Invariant Suite (MULTI_BUSINESS_01 - 15)', () => {
  it('executes all multi-business and owner portfolio test cases successfully', async () => {
    const summary = await runMultiBusinessTestSuite();
    // Log failures if any for debugging
    if (summary.failed > 0) {
      console.error('Multi-business test failures:', summary.results.filter(r => !r.passed));
    }
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(15);
  });
});
