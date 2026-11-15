import { beforeEach, describe, expect, it } from 'vitest';
import type { SecurityContext } from '../../../kernel/types';
import { firestoreClient } from '../../../persistence/firestore/firestoreClient';
import { digitalAssetRegistryService } from '../digitalAssetRegistryService';

const tenantId = 'tenant_asset_test';

function makeContext(targetTenantId = tenantId): SecurityContext {
  return {
    requestId: 'req_asset_test',
    correlationId: 'corr_asset_test',
    timestamp: new Date().toISOString(),
    principal: {
      id: 'test-master',
      isMaster: true,
      tenantId: targetTenantId,
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      authTime: Math.floor(Date.now() / 1000),
      tokenSource: 'SERVICE_KEY',
    },
    tenantContext: {
      tenantId: targetTenantId,
      name: 'Asset Test Tenant',
      blueprintId: 'TEST',
      status: 'ACTIVE',
    },
    branchContext: null,
  };
}

describe('DigitalAssetRegistryService', () => {
  beforeEach(() => firestoreClient.clearAllForTesting());

  it('registers an asset and records the initial ownership event atomically', async () => {
    const result = await digitalAssetRegistryService.registerAsset(makeContext(), tenantId, {
      assetId: 'software-core-001',
      assetClass: 'SOFTWARE',
      name: 'TDBK Core Engine',
      ownerId: tenantId,
      ownerType: 'TENANT',
      ownershipBasis: 'INTERNAL_RECORD',
      evidenceReferences: ['repo:thuram34/tdbk-v2-platform'],
    });

    expect(result.idempotent).toBe(false);
    expect(result.asset.ownershipEvidenceStatus).toBe('EVIDENCE_RECORDED');
    expect(await digitalAssetRegistryService.getAsset(makeContext(), tenantId, 'software-core-001')).toEqual(result.asset);
  });

  it('makes repeated registration idempotent', async () => {
    const input = {
      assetId: 'domain-tdbk-001',
      assetClass: 'DOMAIN' as const,
      name: 'TDBK Domain',
      ownerId: tenantId,
      ownerType: 'TENANT' as const,
      ownershipBasis: 'INTERNAL_RECORD' as const,
    };
    await digitalAssetRegistryService.registerAsset(makeContext(), tenantId, input);
    const repeated = await digitalAssetRegistryService.registerAsset(makeContext(), tenantId, input);
    expect(repeated.idempotent).toBe(true);
  });

  it('records ownership changes with an optimistic owner check', async () => {
    await digitalAssetRegistryService.registerAsset(makeContext(), tenantId, {
      assetId: 'content-asset-001',
      assetClass: 'CONTENT',
      name: 'TDBK Brand Content',
      ownerId: tenantId,
      ownerType: 'TENANT',
      ownershipBasis: 'ASSIGNMENT',
    });

    const updated = await digitalAssetRegistryService.recordOwnershipChange(makeContext(), tenantId, 'content-asset-001', {
      eventId: 'ownership-transfer-001',
      expectedCurrentOwnerId: tenantId,
      newOwnerId: 'partner-company-001',
      newOwnerType: 'ORGANIZATION',
      basis: 'ASSIGNMENT',
      evidenceReferences: ['contract:assignment-001'],
    });
    expect(updated.currentOwnerId).toBe('partner-company-001');
    await expect(digitalAssetRegistryService.recordOwnershipChange(makeContext(), tenantId, 'content-asset-001', {
      eventId: 'ownership-transfer-002',
      expectedCurrentOwnerId: tenantId,
      newOwnerId: 'another-owner-001',
      newOwnerType: 'ORGANIZATION',
      basis: 'ASSIGNMENT',
    })).rejects.toThrow(/ownership changed/i);
  });

  it('stores valuations as estimates and does not overwrite the valuation history', async () => {
    await digitalAssetRegistryService.registerAsset(makeContext(), tenantId, {
      assetId: 'equipment-asset-001',
      assetClass: 'EQUIPMENT',
      name: 'Network Equipment',
      ownerId: tenantId,
      ownerType: 'TENANT',
      ownershipBasis: 'INTERNAL_RECORD',
    });
    const updated = await digitalAssetRegistryService.recordValuation(makeContext(), tenantId, 'equipment-asset-001', {
      valuationId: 'valuation-001',
      amountMinor: 12500000,
      currency: 'KES',
      method: 'COST',
      effectiveAt: new Date().toISOString(),
    });
    expect(updated.latestValuation?.amountMinor).toBe(12500000);
    expect(updated.latestValuation?.currency).toBe('KES');
  });

  it('rejects cross-tenant access even for a caller with a mismatched request target', async () => {
    await expect(digitalAssetRegistryService.listAssets(makeContext('tenant_other'), tenantId)).rejects.toThrow(/tenant context mismatch/i);
  });
});
