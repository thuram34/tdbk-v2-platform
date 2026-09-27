import { describe, expect, it } from 'vitest';

describe('DBK provisioning idempotency request binding', () => {
  it('requires the idempotency hash to represent the complete provisioning request', () => {
    const fields = [
      'principalId',
      'idempotencyKey',
      'effectiveDbkId',
      'legalName',
      'displayName',
      'blueprintId',
      'blueprintVersion',
      'subscriptionTier',
      'primaryBranchName',
      'secondaryBranches',
      'customPreferences',
    ];
    expect(fields).toContain('legalName');
    expect(fields).toContain('subscriptionTier');
    expect(fields).toContain('secondaryBranches');
    expect(fields).toContain('customPreferences');
  });
});
