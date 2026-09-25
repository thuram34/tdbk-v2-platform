import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Firestore branch authorization contract', () => {
  it('requires explicit branch claims for non-admin branch access', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

    expect(rules).toContain("return isMasterAdmin() ||");
    expect(rules).toContain("request.auth.token.role == 'TENANT_ADMIN'");
    expect(rules).toContain("('branchId' in request.auth.token)");
    expect(rules).toContain('request.auth.token.branchId != null');
    expect(rules).toContain('request.auth.token.branchId == branchId');

    // Regression guard: the old fail-open conditions must never return.
    expect(rules).not.toContain("!('branchId' in request.auth.token)");
    expect(rules).not.toContain('request.auth.token.branchId == null ||');
  });
});
