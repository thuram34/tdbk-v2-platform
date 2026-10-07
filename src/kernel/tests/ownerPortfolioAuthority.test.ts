import { describe, expect, it, vi, afterEach } from 'vitest';
import { masterAuthority } from '../master/masterAuthority';
import { rbacEngine } from '../authorization/rbacEngine';
import { branchAuthority } from '../branch/branchAuthority';
import { branchRepository } from '../../persistence/firestore/repositories/branchRepository';

const owner = {
  id: 'owner-001',
  email: 'owner@example.com',
  tenantId: null,
  branchId: null,
  roles: ['BUSINESS_OWNER'],
  permissions: ['PORTFOLIO_READ', 'DBK_PROVISION', 'DBK_MANAGE', 'execute:sales'],
  isMaster: false,
  authTime: Date.now(),
  tokenSource: 'JWT' as const,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Business Owner portfolio authority consistency', () => {
  it('allows owned DBK tenant authorization even when owner principal has no tenantId', async () => {
    vi.spyOn(masterAuthority, 'verifyPortfolioOwnership').mockResolvedValue(true);

    await expect(
      masterAuthority.assertTenantAuthority(owner, 'dbk_owned_001', 'RESOLVE_WORKSPACE', 'req_owner_1'),
    ).resolves.toBeUndefined();

    const result = await rbacEngine.authorizeAsync(owner, 'read', 'workspace', {
      tenantId: 'dbk_owned_001',
      requiredPermission: 'PORTFOLIO_READ',
      requestId: 'req_owner_2',
    });

    expect(result.allowed).toBe(true);
  });

  it('allows branch access inside an owned DBK and preserves branch scope', async () => {
    vi.spyOn(masterAuthority, 'verifyPortfolioOwnership').mockResolvedValue(true);
    vi.spyOn(branchRepository, 'getBranch').mockResolvedValue({
      branchId: 'branch_main',
      dbkId: 'dbk_owned_001',
      name: 'Main',
      isHeadquarters: true,
      status: 'ACTIVE',
    } as any);

    const branch = await branchAuthority.assertPersistentBranchContext(
      owner,
      'dbk_owned_001',
      'branch_main',
      'SWITCH_BRANCH',
      'req_owner_3',
    );

    expect(branch.branchId).toBe('branch_main');
  });

  it('rejects a DBK outside the owner portfolio', async () => {
    vi.spyOn(masterAuthority, 'verifyPortfolioOwnership').mockResolvedValue(false);

    await expect(
      masterAuthority.assertTenantAuthority(owner, 'dbk_foreign_001', 'RESOLVE_WORKSPACE', 'req_owner_4'),
    ).rejects.toThrow(/does not own tenant/i);

    const result = await rbacEngine.authorizeAsync(owner, 'read', 'workspace', {
      tenantId: 'dbk_foreign_001',
      requiredPermission: 'PORTFOLIO_READ',
      requestId: 'req_owner_5',
    });

    expect(result.allowed).toBe(false);
  });
});
