/**
 * TDBK V2 PLATFORM DEMO SEEDER
 * Initializes rich, realistic Kenyan enterprise DBKs across multiple sectors.
 */

import { SecurityContext, Principal } from '../kernel/types';
import { provisioningService } from './provisioning/provisioningService';
import { dbkRegistry } from './dbkRegistry';
import { branchManager } from './branch/branchManager';
import { entityEngine } from '../experience/entity/entityEngine';

const masterPrincipal: Principal = {
  id: 'usr_master_super',
  tenantId: 'master',
  roles: ['TDBK_MASTER_ADMIN'],
  permissions: ['*'],
  isMaster: true,
  authTime: Date.now(),
  tokenSource: 'JWT',
  branchId: null,
};

const masterCtx: SecurityContext = {
  principal: masterPrincipal,
  requestId: 'req_seeder_master',
  timestamp: new Date().toISOString(),
  tenantContext: null,
  branchContext: null,
  correlationId: 'corr_seeder_master',
};

export async function seedDemoDbks(force: boolean = false): Promise<void> {
  // Explicit environment guard: Seeding is permitted in development/test or when explicitly flagged
  const isDevOrExplicit = process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DBKS === 'true' || process.env.ENABLE_DEMO_SEEDER === 'true';
  if (!isDevOrExplicit && !force) {
    return; // Production safeguard: Never silently populate production clusters with demo fixtures
  }

  const existing = dbkRegistry.listAllDbks(masterCtx);
  if (existing.length >= 4) {
    return; // Already seeded
  }

  // 1. Education DBK
  if (!dbkRegistry.hasDbk('tenant_school_01')) {
    await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'tenant_school_01',
      legalName: 'Premier Academy Nairobi Ltd',
      displayName: 'Premier Academy Nairobi',
      blueprintId: 'school_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Kilimani Campus (HQ)',
    });

    branchManager.createSecondaryBranch(masterCtx, 'tenant_school_01', {
      branchId: 'tenant_school_01_westlands',
      name: 'Westlands Junior Campus',
      type: 'CAMPUS',
      location: { town: 'Nairobi', county: 'Nairobi', address: 'Westlands Road' },
    });
  }

  // 2. Hardware DBK
  if (!dbkRegistry.hasDbk('tenant_hardware_01')) {
    await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'tenant_hardware_01',
      legalName: 'Apex Building Materials & Timber Ltd',
      displayName: 'Apex Hardware & Timber Yard',
      blueprintId: 'hardware_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Industrial Area Central Yard (HQ)',
    });

    branchManager.createSecondaryBranch(masterCtx, 'tenant_hardware_01', {
      branchId: 'tenant_hardware_01_mombasa_rd',
      name: 'Mombasa Road Depot',
      type: 'WAREHOUSE',
      location: { town: 'Nairobi', county: 'Nairobi', address: 'Mombasa Road' },
    });
  }

  // 3. Logistics DBK
  if (!dbkRegistry.hasDbk('tenant_logistics_01')) {
    await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'tenant_logistics_01',
      legalName: 'Rift Hauliers & Freight Ltd',
      displayName: 'Rift Express Freight',
      blueprintId: 'logistics_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Mombasa Port Terminal (HQ)',
    });

    branchManager.createSecondaryBranch(masterCtx, 'tenant_logistics_01', {
      branchId: 'tenant_logistics_01_eldoret',
      name: 'Eldoret Transshipment Hub',
      type: 'WAREHOUSE',
      location: { town: 'Eldoret', county: 'Uasin Gishu', address: 'Uganda Road' },
    });
  }

  // 4. Healthcare DBK
  if (!dbkRegistry.hasDbk('tenant_healthcare_01')) {
    await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'tenant_healthcare_01',
      legalName: 'St. Jude Family Care Hospital Ltd',
      displayName: 'St. Jude Medicare Center',
      blueprintId: 'clinic_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'PRO',
      primaryBranchName: 'Upper Hill Main Clinic (HQ)',
    });
  }

  // 5. Retail Supermarket DBK
  if (!dbkRegistry.hasDbk('tenant_retail_01')) {
    await provisioningService.provisionDbk(masterCtx, {
      dbkId: 'tenant_retail_01',
      legalName: 'Boma Fresh Supermarkets Ltd',
      displayName: 'Boma Fresh Express Supermarket',
      blueprintId: 'retail_v1',
      blueprintVersion: '1.0.0',
      subscriptionTier: 'GROWTH',
      primaryBranchName: 'Valley Arcade Store (HQ)',
    });
  }
}
