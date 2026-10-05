/**
 * TDBK V2 BRANCH AUTHORITY PRIMITIVE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { Principal, BranchContext } from '../types';
import { AuthorizationError } from '../errors/kernelErrors';
import { auditLogger } from '../audit/auditLogger';
import { masterAuthority } from '../master/masterAuthority';
import { branchRepository } from '../../persistence/firestore/repositories/branchRepository';

export class BranchAuthorityService {
  /**
   * Asserts branch context authorization for a requested branch ID.
   * If user has tenant-wide scope (branchId == null), access to any branch within tenant is granted.
   * If user has specific branch scope (branchId == 'branch_headquarters'), access to other branches is DENIED.
   */
  public assertBranchContext(
    principal: Principal,
    requestedBranchId: string,
    action: string,
    requestId?: string
  ): BranchContext {
    if (!requestedBranchId) {
      throw new AuthorizationError('Target branchId required for branch operation', requestId);
    }

    // TDBK Master bypass
    if (masterAuthority.isMasterAdmin(principal)) {
      return this.resolveBranchContext(requestedBranchId);
    }

    // Tenant-wide roles (no branch restriction on principal)
    if (principal.branchId === null || principal.branchId === undefined) {
      return this.resolveBranchContext(requestedBranchId);
    }

    // Check branch match
    if (principal.branchId !== requestedBranchId) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        principal.id,
        action,
        `branch:${requestedBranchId}`,
        'DENIED',
        {
          tenantId: principal.tenantId,
          branchId: principal.branchId,
          requestId,
          details: {
            principalBranch: principal.branchId,
            targetBranch: requestedBranchId,
            reason: 'User constrained to specific branch attempting access to another branch',
          },
        }
      );

      throw new AuthorizationError(
        `Branch authorization failed: User constrained to branch '${principal.branchId}' cannot access target branch '${requestedBranchId}'`,
        requestId
      );
    }

    return this.resolveBranchContext(requestedBranchId);
  }

  /**
   * Authoritative production branch authorization. Validates both the
   * principal's branch scope and the branch's durable DBK ownership.
   */
  public async assertPersistentBranchContext(
    principal: Principal,
    tenantId: string,
    requestedBranchId: string,
    action: string,
    requestId?: string
  ): Promise<BranchContext> {
    if (!requestedBranchId) {
      throw new AuthorizationError('Target branchId required for branch operation', requestId);
    }

    // Tenant scope is authoritative here. Business Owners can operate across
    // the DBKs they own, while tenant-bound roles remain restricted to their
    // assigned tenant through MasterAuthority's shared policy.
    await masterAuthority.assertTenantAuthority(principal, tenantId, action, requestId);

    if (!masterAuthority.isMasterAdmin(principal) && principal.branchId != null && principal.branchId !== requestedBranchId) {
      throw new AuthorizationError(
        `Branch authorization failed: User constrained to branch '${principal.branchId}' cannot access target branch '${requestedBranchId}'`,
        requestId
      );
    }

    const branch = await branchRepository.getBranch(tenantId, requestedBranchId);
    if (!branch || branch.dbkId !== tenantId || branch.status !== 'ACTIVE') {
      auditLogger.logEvent('AUTHORIZATION_DENIED', principal.id, action, `branch:${requestedBranchId}`, 'DENIED', {
        tenantId,
        branchId: requestedBranchId,
        requestId,
        details: { reason: 'Durable branch not found, tenant mismatch, or inactive' },
      });
      throw new AuthorizationError(
        `Branch authorization failed: branch '${requestedBranchId}' is not an active branch of tenant '${tenantId}'`,
        requestId
      );
    }

    return {
      branchId: branch.branchId,
      name: branch.name,
      isHeadquarters: branch.isHeadquarters,
      status: branch.status,
    };
  }

  public resolveBranchContext(branchId: string): BranchContext {
    return {
      branchId,
      name: `Branch (${branchId})`,
      isHeadquarters: branchId.includes('hq') || branchId.includes('headquarters') || branchId === 'main',
      status: 'ACTIVE',
    };
  }
}

export const branchAuthority = new BranchAuthorityService();
