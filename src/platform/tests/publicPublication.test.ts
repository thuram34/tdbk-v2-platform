import { describe, expect, it, beforeEach } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { dbkRegistryRepository } from '../../persistence/firestore/repositories/dbkRegistryRepository';
import { publicPublicationService } from '../public/publicPublicationService';
import { TokenVerifier } from '../../kernel/identity/tokenVerifier';
import { securityContextFactory } from '../../kernel/context/contextFactory';
import { branchRepository } from '../../persistence/firestore/repositories/branchRepository';

describe('DBK public publication authority', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  async function contextFor(dbkId: string) {
    const token = TokenVerifier.mintTestToken({
      uid: 'owner_public_test',
      tenantId: dbkId,
      branchId: `${dbkId}_hq`,
      roles: ['OWNER_OPERATOR'],
      permissions: ['TENANT_ADMIN'],
      isMaster: false,
    });
    return securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${token}`,
      targetTenantId: dbkId,
      targetBranchId: `${dbkId}_hq`,
    });
  }

  it('publishes only an active DBK and exposes a public-safe projection', async () => {
    const dbkId = 'dbk_public_001';
    await dbkRegistryRepository.saveDbk(dbkId, {
      dbkId,
      legalName: 'Public Test Academy Limited',
      displayName: 'Public Test Academy',
      sector: 'EDUCATION',
      blueprintId: 'school_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'FOUNDATION',
      status: 'ACTIVE',
      masterOwner: 'owner_public_test',
      createdBy: 'owner_public_test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configurationVersion: 1,
      workspaceVersion: 1,
      branchTopology: [{
        branchId: `${dbkId}_hq`,
        dbkId,
        name: 'Mombasa Campus',
        type: 'HEADQUARTERS',
        status: 'ACTIVE',
        location: { county: 'Mombasa', town: 'Mombasa' },
        isHeadquarters: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      lifecycleHistory: [],
      metadata: { privateSecret: 'must-not-leak' },
      provisioningStage: 'ACTIVATION_VERIFIED',
    });

    await branchRepository.saveBranch(dbkId, `${dbkId}_hq`, { branchId: `${dbkId}_hq`, dbkId, name: 'Mombasa Campus', type: 'HEADQUARTERS', status: 'ACTIVE', isHeadquarters: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    const ctx = await contextFor(dbkId);
    const publication = await publicPublicationService.setPublication(ctx, dbkId, 'PUBLISHED');
    expect(publication.status).toBe('PUBLISHED');

    const publicProjection = await publicPublicationService.getPublishedOrganization(dbkId);
    expect(publicProjection?.displayName).toBe('Public Test Academy');
    expect(publicProjection).not.toHaveProperty('legalName');
    expect(publicProjection).not.toHaveProperty('masterOwner');
    expect(publicProjection).not.toHaveProperty('metadata');
  });

  it('does not publish suspended DBKs', async () => {
    const dbkId = 'dbk_public_002';
    await dbkRegistryRepository.saveDbk(dbkId, {
      dbkId,
      legalName: 'Suspended Business Limited',
      displayName: 'Suspended Business',
      sector: 'RETAIL',
      blueprintId: 'retail_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'FOUNDATION',
      status: 'SUSPENDED',
      masterOwner: 'owner_public_test',
      createdBy: 'owner_public_test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configurationVersion: 1,
      workspaceVersion: 1,
      branchTopology: [],
      lifecycleHistory: [],
      metadata: {},
    });

    await branchRepository.saveBranch(dbkId, `${dbkId}_hq`, { branchId: `${dbkId}_hq`, dbkId, name: 'Mombasa Campus', type: 'HEADQUARTERS', status: 'ACTIVE', isHeadquarters: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    const ctx = await contextFor(dbkId);
    await expect(publicPublicationService.setPublication(ctx, dbkId, 'PUBLISHED')).rejects.toThrow();
  });

  it('keeps unpublished organizations invisible', async () => {
    const dbkId = 'dbk_public_003';
    await dbkRegistryRepository.saveDbk(dbkId, {
      dbkId,
      legalName: 'Private Business Limited',
      displayName: 'Private Business',
      sector: 'RETAIL',
      blueprintId: 'retail_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'FOUNDATION',
      status: 'ACTIVE',
      masterOwner: 'owner_public_test',
      createdBy: 'owner_public_test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configurationVersion: 1,
      workspaceVersion: 1,
      branchTopology: [],
      lifecycleHistory: [],
      metadata: {},
    });

    expect(await publicPublicationService.getPublishedOrganization(dbkId)).toBeNull();
  });
});
