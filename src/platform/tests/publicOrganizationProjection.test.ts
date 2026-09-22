import { describe, expect, it } from 'vitest';
import {
  evaluatePublicOrganizationEligibility,
  projectPublicOrganization,
} from '../public/publicOrganizationProjection';
import { DbkIdentity } from '../types';

const baseDbk: DbkIdentity = {
  dbkId: 'dbk_public_001',
  legalName: 'Private Legal Entity Name',
  displayName: 'Public Organization',
  sector: 'SCHOOL',
  blueprintId: 'school',
  blueprintVersion: '1.0.0',
  subscriptionTier: 'PRO',
  status: 'ACTIVE',
  masterOwner: 'owner-private',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-22T00:00:00.000Z',
  createdBy: 'creator-private',
  configurationVersion: 7,
  workspaceVersion: 12,
  branchTopology: [
    {
      branchId: 'branch-hq',
      dbkId: 'dbk_public_001',
      name: 'Main Campus',
      type: 'HEADQUARTERS',
      status: 'ACTIVE',
      location: {
        county: 'Mombasa',
        town: 'Nyali',
        address: 'Private address',
      },
      isHeadquarters: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-22T00:00:00.000Z',
    },
    {
      branchId: 'branch-archived',
      dbkId: 'dbk_public_001',
      name: 'Old Campus',
      type: 'CAMPUS',
      status: 'ARCHIVED',
      isHeadquarters: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
    },
  ],
  lifecycleHistory: [],
  metadata: {
    privateFlag: true,
  },
};

describe('Public Organization Projection', () => {
  it('projects only public-safe DBK identity and active branches', () => {
    const projection = projectPublicOrganization(baseDbk);

    expect(projection).toEqual({
      dbkId: 'dbk_public_001',
      displayName: 'Public Organization',
      sector: 'SCHOOL',
      branches: [
        {
          branchId: 'branch-hq',
          name: 'Main Campus',
          type: 'HEADQUARTERS',
          location: {
            county: 'Mombasa',
            town: 'Nyali',
            address: 'Private address',
          },
          isHeadquarters: true,
        },
      ],
      stateVersion: {
        configurationVersion: 7,
        updatedAt: '2026-09-22T00:00:00.000Z',
      },
      eligibility: 'ELIGIBLE',
    });

    expect(projection).not.toHaveProperty('legalName');
    expect(projection).not.toHaveProperty('subscriptionTier');
    expect(projection).not.toHaveProperty('masterOwner');
    expect(projection).not.toHaveProperty('metadata');
    expect(projection).not.toHaveProperty('lifecycleHistory');
  });

  it('derives eligibility from existing DBK lifecycle state without creating publication state', () => {
    expect(evaluatePublicOrganizationEligibility('ACTIVE')).toBe('ELIGIBLE');
    expect(evaluatePublicOrganizationEligibility('SUSPENDED')).toBe('SUSPENDED');
    expect(evaluatePublicOrganizationEligibility('PROVISIONING')).toBe('INELIGIBLE');
    expect(evaluatePublicOrganizationEligibility('PROVISIONING_FAILED')).toBe('INELIGIBLE');
    expect(evaluatePublicOrganizationEligibility('ARCHIVED')).toBe('INELIGIBLE');
  });

  it('does not expose disabled or archived branches', () => {
    const projection = projectPublicOrganization({
      ...baseDbk,
      branchTopology: baseDbk.branchTopology.map((branch) =>
        branch.branchId === 'branch-hq' ? { ...branch, status: 'INACTIVE' as const } : branch,
      ),
    });

    expect(projection.branches).toEqual([]);
  });
});
