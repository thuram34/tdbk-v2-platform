/**
 * TDBK V2 MASTER AUTHORITY PRIMITIVE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { Principal } from '../types';
import { AuthorizationError } from '../errors/kernelErrors';
import { auditLogger } from '../audit/auditLogger';

export class MasterAuthorityService {
  /**
   * Checks if a Principal possesses TDBK MASTER platform-level administrative authority.
   */
  public isMasterAdmin(principal?: Principal | null): boolean {
    if (!principal) return false;
    const isMaster = principal.isMaster === true || String(principal.isMaster) === 'true';
    const roles = Array.isArray(principal.roles) ? principal.roles : [];
    return isMaster && roles.includes('TDBK_MASTER_ADMIN');
  }

  /**
   * Checks if a Principal possesses Business Owner / Portfolio authority.
   */
  public isOwnerPortfolio(principal?: Principal | null): boolean {
    if (!principal) return false;
    const isMaster = principal.isMaster === true || String(principal.isMaster) === 'true';
    const roles = Array.isArray(principal.roles) ? principal.roles : [];
    return roles.includes('BUSINESS_OWNER') || roles.includes('OWNER_OPERATOR') || roles.includes('TDBK_MASTER_ADMIN') || isMaster;
  }

  /**
   * Asserts Owner Portfolio or TDBK MASTER authority for DBK provisioning and management.
   */
  public assertOwnerOrMasterAuthority(principal: Principal, action: string, requestId?: string): void {
    if (!principal || (!this.isMasterAdmin(principal) && !this.isOwnerPortfolio(principal))) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        principal.id,
        action,
        'owner:portfolio',
        'DENIED',
        {
          tenantId: principal.tenantId,
          requestId,
          details: { reason: 'Unauthorized attempt to provision or manage DBK portfolio without owner or master authority' },
        }
      );

      throw new AuthorizationError(
        `Security Violation: Action '${action}' requires TDBK MASTER platform authority or authorized Business Owner portfolio`,
        requestId
      );
    }

    auditLogger.logEvent(
      'AUTHORIZATION_ALLOWED',
      principal.id,
      action,
      'owner:portfolio',
      'ALLOWED',
      {
        requestId,
        details: { description: 'Owner portfolio authority invoked successfully' },
      }
    );
  }

  /**
   * Asserts TDBK MASTER authority for platform-level management tasks.
   * Throws AuthorizationError if principal is a DBK tenant user attempting a Master action.
   */
  public assertMasterAuthority(principal: Principal, action: string, requestId?: string): void {
    if (!this.isMasterAdmin(principal)) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        principal.id,
        action,
        'master:platform',
        'DENIED',
        {
          tenantId: principal.tenantId,
          requestId,
          details: { reason: 'Unauthorized attempt to invoke TDBK MASTER authority by tenant user' },
        }
      );

      throw new AuthorizationError(
        `Security Violation: Action '${action}' requires TDBK MASTER platform authority`,
        requestId
      );
    }

    auditLogger.logEvent(
      'MASTER_ACTION',
      principal.id,
      action,
      'master:platform',
      'ALLOWED',
      {
        requestId,
        details: { description: 'TDBK MASTER authority invoked successfully' },
      }
    );
  }
}

export const masterAuthority = new MasterAuthorityService();
