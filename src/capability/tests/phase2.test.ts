/**
 * VITEST AUTOMATED TEST SUITE FOR PHASE 2 CAPABILITY & ENTITLEMENT ENGINE
 */

import { describe, it, expect } from 'vitest';
import { Phase2TestRunner } from './phase2TestRunner';

describe('TDBK V2 Phase 2 Capability & Entitlement Engine Test Suite', async () => {
  const summary = await Phase2TestRunner.runAllTests();

  for (const testCase of summary.results) {
    it(`[${testCase.id}] ${testCase.name}`, () => {
      expect(testCase.passed, testCase.errorDetails || `${testCase.expected} vs ${testCase.actual}`).toBe(true);
    });
  }
});
