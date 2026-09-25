import { describe, expect, it } from 'vitest';

describe('AI proposal branch isolation contract', () => {
  it('requires an explicit branch for non-master proposal reads', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').resolve(process.cwd(), 'src/document_ai/ai/aiCommandBoundary.ts'),
      'utf8',
    );
    expect(source).toContain('Branch scope is required for proposal listing');
    expect(source).toContain('ctx.principal.branchId');
    expect(source).toContain('AI_PROPOSAL_READ');
  });
});
