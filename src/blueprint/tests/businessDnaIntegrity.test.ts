import { describe, expect, it } from 'vitest';
import { BlueprintValidator } from '../validator';
import { SecurityContext } from '../../kernel/types';
import { BusinessDNA } from '../types';

const validDna = (): BusinessDNA => ({
  dbkId: 'business_a',
  identity: {
    dbkId: 'business_a',
    businessName: 'Example Business',
    businessType: 'RETAIL',
    blueprintId: 'retail_v1',
    blueprintVersion: '1.0.0',
    industry: 'RETAIL',
    country: 'KE',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    operationalStatus: 'ACTIVE',
  },
  scale: 'SMALL',
  branchTopology: {
    type: 'SINGLE_BRANCH',
    branches: [{
      branchId: 'business_a_hq',
      name: 'Headquarters',
      isHeadquarters: true,
      code: 'HQ-01',
      status: 'ACTIVE',
    }],
  },
  operationalPreferences: {},
  enabledCapabilityIds: ['barcode_pos'],
  growthStage: 'GROWTH',
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
});

const context = (principal: Record<string, unknown>) =>
  ({ principal, requestId: 'dna-boundary-test' }) as unknown as SecurityContext;

describe('Business DNA integrity and synchronous access boundaries', () => {
  it('rejects a nested identity that points to a different business', () => {
    const dna = validDna();
    dna.identity.dbkId = 'business_b';
    const result = BlueprintValidator.validateBusinessDna(dna);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Business DNA dbkId must match BusinessIdentity dbkId');
  });

  it('rejects duplicate branch identifiers', () => {
    const dna = validDna();
    dna.branchTopology = {
      type: 'MULTI_BRANCH',
      branches: [
        ...dna.branchTopology.branches,
        { ...dna.branchTopology.branches[0], name: 'Second branch' },
      ],
    };
    const result = BlueprintValidator.validateBusinessDna(dna);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Branch topology must not contain duplicate branchId values');
  });

  it('rejects inconsistent single-branch topology', () => {
    const dna = validDna();
    dna.branchTopology.type = 'SINGLE_BRANCH';
    dna.branchTopology.branches.push({
      branchId: 'business_a_branch_2',
      name: 'Second branch',
      isHeadquarters: false,
      code: 'BR-02',
      status: 'ACTIVE',
    });
    const result = BlueprintValidator.validateBusinessDna(dna);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('SINGLE_BRANCH topology must contain exactly one branch');
  });

  it('rejects duplicate enabled capability identifiers', () => {
    const dna = validDna();
    dna.enabledCapabilityIds = ['barcode_pos', 'barcode_pos'];
    const result = BlueprintValidator.validateBusinessDna(dna);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Business DNA must not contain duplicate enabled capability IDs');
  });

  it('does not treat the BUSINESS_OWNER role alone as proof of portfolio ownership in synchronous cache access', () => {
    expect(() => BlueprintValidator.assertTenantAccess(
      context({ id: 'owner_1', isMaster: false, tenantId: null, roles: ['BUSINESS_OWNER'] }),
      'business_b',
      'read Business DNA',
    )).toThrow(/Tenant Isolation Violation/);
  });

  it('allows a tenant-bound principal to access only its exact tenant in synchronous cache access', () => {
    expect(() => BlueprintValidator.assertTenantAccess(
      context({ id: 'staff_1', isMaster: false, tenantId: 'business_a', roles: ['STAFF'] }),
      'business_a',
      'read Business DNA',
    )).not.toThrow();

    expect(() => BlueprintValidator.assertTenantAccess(
      context({ id: 'staff_1', isMaster: false, tenantId: 'business_a', roles: ['STAFF'] }),
      'business_b',
      'read Business DNA',
    )).toThrow(/Tenant Isolation Violation/);
  });

  it('allows only an explicitly master-identified TDBK master in the synchronous bypass', () => {
    expect(() => BlueprintValidator.assertTenantAccess(
      context({ id: 'master_1', isMaster: true, tenantId: null, roles: ['TDBK_MASTER_ADMIN'] }),
      'business_a',
      'read Business DNA',
    )).not.toThrow();

    expect(() => BlueprintValidator.assertTenantAccess(
      context({ id: 'untrusted_1', isMaster: true, tenantId: null, roles: [] }),
      'business_a',
      'read Business DNA',
    )).toThrow(/Tenant Isolation Violation/);
  });
});
