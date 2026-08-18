/**
 * TDBK V2 BRANCH AUTHORITY PRIMITIVE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { Principal, BranchContext } from '../types';
import { AuthorizationError } from '../errors/kernelErrors';
import { auditLogger } from '../audit/auditLogger';
import { masterAuthority } from '../master/masterAuthority';

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
