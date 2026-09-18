/**
 * TDBK V2 BRANCH TOPOLOGY MANAGER
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Governs tenant-scoped branch lifecycle and ensures multi-branch isolation.
 */

import { DbkBranch } from '../types';
import { SecurityContext } from '../../kernel/types';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { BlueprintValidator } from '../../blueprint/validator';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { branchRepository } from '../../persistence/firestore/repositories/branchRepository';

export class BranchManagerService {
  private static instance: BranchManagerService;
  // Map of dbkId -> Map of branchId -> DbkBranch
  private branchStore: Map<string, Map<string, DbkBranch>> = new Map();

  private constructor() {}

  public static getInstance(): BranchManagerService {
    if (!BranchManagerService.instance) {
      BranchManagerService.instance = new BranchManagerService();
    }
    return BranchManagerService.instance;
  }

  public clearStoreForTesting(): void {
    this.branchStore.clear();
  }

  /**
   * Initializes or adds an HQ primary branch for a DBK.
   */
  public async createHeadquartersBranch(
    context: SecurityContext,
    dbkId: string,
    name: string = 'Headquarters',
    location?: DbkBranch['location']
  ): Promise<DbkBranch> {
    this.assertTenantAccess(context, dbkId, 'createHeadquartersBranch');

    const branchId = `${dbkId}_hq`;
    const existingDurable = await branchRepository.getBranch(dbkId, branchId);
    if (existingDurable) {
      if (existingDurable.dbkId !== dbkId || !existingDurable.isHeadquarters) {
        throw new KernelError('CONFLICT', `Branch '${branchId}' conflicts with existing durable branch`, 409, context.requestId);
      }
      let tenantBranches = this.branchStore.get(dbkId);
      if (!tenantBranches) {
        tenantBranches = new Map();
        this.branchStore.set(dbkId, tenantBranches);
      }
      tenantBranches.set(branchId, existingDurable);
      return existingDurable;
    }
    const branch: DbkBranch = {
      branchId,
      dbkId,
      name,
      type: 'HEADQUARTERS',
      status: 'ACTIVE',
      isHeadquarters: true,
      ...(location !== undefined ? { location } : {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let tenantBranches = this.branchStore.get(dbkId);
    if (!tenantBranches) {
      tenantBranches = new Map();
      this.branchStore.set(dbkId, tenantBranches);
    }
    tenantBranches.set(branchId, branch);
    await branchRepository.saveBranch(dbkId, branchId, branch);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      'DBK_BRANCH_CREATED',
      `branch:${branchId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        branchId,
        requestId: context.requestId,
        details: { type: 'HEADQUARTERS', name },
      }
    );

    return branch;
  }

  /**
   * Adds a secondary branch to a DBK topology with tenant-scoping.
   */
  public async createSecondaryBranch(
    context: SecurityContext,
    dbkId: string,
    branchData: {
      branchId: string;
      name: string;
      type: DbkBranch['type'];
      location?: DbkBranch['location'];
    }
  ): Promise<DbkBranch> {
    this.assertTenantAccess(context, dbkId, 'createSecondaryBranch');

    const existingDurable = await branchRepository.getBranch(dbkId, branchData.branchId);
    if (existingDurable) {
      if (existingDurable.dbkId !== dbkId || existingDurable.isHeadquarters) {
        throw new KernelError('CONFLICT', `Branch '${branchData.branchId}' conflicts with existing durable branch`, 409, context.requestId);
      }
      let tenantBranches = this.branchStore.get(dbkId);
      if (!tenantBranches) {
        tenantBranches = new Map();
        this.branchStore.set(dbkId, tenantBranches);
      }
      tenantBranches.set(branchData.branchId, existingDurable);
      return existingDurable;
    }

    let tenantBranches = this.branchStore.get(dbkId);
    if (!tenantBranches) {
      tenantBranches = new Map();
      this.branchStore.set(dbkId, tenantBranches);
    }

    if (tenantBranches.has(branchData.branchId)) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `Branch with ID '${branchData.branchId}' already exists for DBK '${dbkId}'`,
        400,
        context.requestId
      );
    }

    const branch: DbkBranch = {
      branchId: branchData.branchId,
      dbkId,
      name: branchData.name,
      type: branchData.type,
      status: 'ACTIVE',
      isHeadquarters: false,
      ...(branchData.location !== undefined ? { location: branchData.location } : {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tenantBranches.set(branch.branchId, branch);
    await branchRepository.saveBranch(dbkId, branch.branchId, branch);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      'DBK_BRANCH_CREATED',
      `branch:${branch.branchId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        branchId: branch.branchId,
        requestId: context.requestId,
        details: { type: branch.type, name: branch.name },
      }
    );

    return branch;
  }

  /**
   * Retrieves all branches for a DBK.
   */
  public getBranchesForDbk(context: SecurityContext, dbkId: string): DbkBranch[] {
    this.assertTenantAccess(context, dbkId, 'getBranchesForDbk');
    const tenantBranches = this.branchStore.get(dbkId);
    if (!tenantBranches) return [];
    return Array.from(tenantBranches.values());
  }

  /**
   * Retrieves a specific branch for a DBK.
   */
  public getBranch(context: SecurityContext, dbkId: string, branchId: string): DbkBranch | undefined {
    this.assertTenantAccess(context, dbkId, 'getBranch');
    const tenantBranches = this.branchStore.get(dbkId);
    return tenantBranches?.get(branchId);
  }

  /**
   * Authoritative Firestore read for production callers.
   * The synchronous cache methods above are retained for deterministic test isolation.
   */
  public async listPersistentBranches(context: SecurityContext, dbkId: string): Promise<DbkBranch[]> {
    this.assertTenantAccess(context, dbkId, 'listPersistentBranches');
    return await branchRepository.listBranches(dbkId);
  }

  public async getPersistentBranch(
    context: SecurityContext,
    dbkId: string,
    branchId: string
  ): Promise<DbkBranch | null> {
    this.assertTenantAccess(context, dbkId, 'getPersistentBranch');
    return await branchRepository.getBranch(dbkId, branchId);
  }

  /**
   * Asserts tenant boundary for branch operations.
   */
  private assertTenantAccess(context: SecurityContext, targetDbkId: string, action: string): void {
    if (!masterAuthority.isMasterAdmin(context.principal)) {
      BlueprintValidator.assertTenantAccess(context, targetDbkId, action);
    }
  }
}

export const branchManager = BranchManagerService.getInstance();
