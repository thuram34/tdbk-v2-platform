import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Firestore branch authorization contract', () => {
  it('uses the canonical roles-array claim written by FirebaseIdentityManager', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    const identityManager = readFileSync(
      resolve(process.cwd(), 'src/kernel/identity/firebaseIdentityManager.ts'),
      'utf8',
    );

    // FirebaseIdentityManager writes roles as a top-level array claim.
    expect(identityManager).toContain('roles: tdbkClaims.roles || []');
    expect(rules).toContain('function hasTenantAdminRole()');
    expect(rules).toContain("('roles' in request.auth.token)");
    expect(rules).toContain('request.auth.token.roles is list');
    expect(rules).toContain("request.auth.token.roles.hasAny(['TENANT_ADMIN'])");

    // Every tenant-admin branch/audit rule must use the shared claim helper.
    expect(rules).toContain('allow write: if isTenantMember(tenantId) && hasTenantAdminRole();');
    expect(rules).toContain('allow get, list: if isTenantMember(tenantId) && hasTenantAdminRole();');
    expect(rules).not.toContain("request.auth.token.role == 'TENANT_ADMIN'");
  });

  it('requires explicit branch claims for non-admin branch access', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

    expect(rules).toContain('return isMasterAdmin() ||');
    expect(rules).toContain('hasTenantAdminRole() ||');
    expect(rules).toContain("('branchId' in request.auth.token)");
    expect(rules).toContain('request.auth.token.branchId != null');
    expect(rules).toContain('request.auth.token.branchId == branchId');

    // Regression guard: the old fail-open conditions must never return.
    expect(rules).not.toContain("!('branchId' in request.auth.token)");
    expect(rules).not.toContain('request.auth.token.branchId == null ||');
  });
});
