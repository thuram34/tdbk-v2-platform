/**
 * TDBK V2 MASTER AUTHORITY PRIMITIVE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { Principal, SecurityContext } from '../types';
import { AuthorizationError } from '../errors/kernelErrors';
import { auditLogger } from '../audit/auditLogger';
import { dbkRegistryRepository } from '../../persistence/firestore/repositories/dbkRegistryRepository';

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
   * Checks if a Principal possesses the BUSINESS_OWNER role.
   * NOTE: Role capability alone does NOT authorize access to an arbitrary tenant.
   */
  public isBusinessOwner(principal?: Principal | null): boolean {
    if (!principal) return false;
    const roles = Array.isArray(principal.roles) ? principal.roles : [];
    return roles.includes('BUSINESS_OWNER');
  }

  /**
   * Checks if a Principal possesses the OWNER_OPERATOR role.
   */
  public isOwnerOperator(principal?: Principal | null): boolean {
    if (!principal) return false;
    const roles = Array.isArray(principal.roles) ? principal.roles : [];
    return roles.includes('OWNER_OPERATOR');
  }

  /**
   * Checks if a Principal possesses general Owner/Portfolio authority for initial provisioning or portfolio UI.
   * For tenant-bound operations, assertTenantAuthority MUST be called instead.
   */
  public isOwnerPortfolio(principal?: Principal | null): boolean {
    if (!principal) return false;
    const isMaster = principal.isMaster === true || String(principal.isMaster) === 'true';
    const roles = Array.isArray(principal.roles) ? principal.roles : [];
    return roles.includes('BUSINESS_OWNER') || roles.includes('OWNER_OPERATOR') || roles.includes('TDBK_MASTER_ADMIN') || isMaster;
  }

  /**
   * Asserts that a Business Owner owns a specific tenant in their portfolio.
   * Authoritatively checks the DBK Registry in Firestore.
   */
  public async verifyPortfolioOwnership(ownerId: string, tenantId: string): Promise<boolean> {
    try {
      const dbk = await dbkRegistryRepository.getDbk(tenantId);
      if (!dbk) return false;
      return dbk.masterOwner === ownerId || dbk.createdBy === ownerId;
    } catch {
      return false;
    }
  }

  /**
   * Universal Tenant-Scoped Authority Assertion Primitive.
   * Enforces:
   * - TDBK_MASTER_ADMIN: Allowed globally across all tenants.
   * - BUSINESS_OWNER: Allowed ONLY when the requested tenant belongs to that owner's portfolio (checked via DBK Registry).
   * - OWNER_OPERATOR: Allowed ONLY when principal.tenantId === requested tenantId.
   * - BRANCH_MANAGER / STAFF / AUDITOR / etc.: Allowed ONLY when principal.tenantId === requested tenantId.
   * - Unauthenticated / Insufficient role: DENIED.
   */
  public async assertTenantAuthority(
    contextOrPrincipal: SecurityContext | Principal,
    tenantId: string,
    action: string,
    requestId?: string
  ): Promise<void> {
    const principal = 'principal' in contextOrPrincipal ? contextOrPrincipal.principal : contextOrPrincipal;
    const effectiveRequestId = ('requestId' in contextOrPrincipal ? contextOrPrincipal.requestId : requestId) || undefined;

    if (!principal) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        'ANONYMOUS',
        action,
        `tenant:${tenantId}`,
        'DENIED',
        {
          tenantId,
          requestId: effectiveRequestId,
          details: { reason: 'Unauthenticated access attempt to tenant resource' },
        }
      );
      throw new AuthorizationError(`Security Violation: Unauthenticated access attempt during '${action}'`, effectiveRequestId);
    }

    // 1. TDBK_MASTER_ADMIN has global authority
    if (this.isMasterAdmin(principal)) {
      auditLogger.logEvent(
        'AUTHORIZATION_ALLOWED',
        principal.id,
        action,
        `tenant:${tenantId}`,
        'ALLOWED',
        {
          tenantId,
          requestId: effectiveRequestId,
          details: { rule: 'TDBK_MASTER_ADMIN_GLOBAL_AUTHORITY' },
        }
      );
      return;
    }

    // 2. BUSINESS_OWNER: Portfolio check against DBK Registry
    if (this.isBusinessOwner(principal)) {
      const isOwned = (await this.verifyPortfolioOwnership(principal.id, tenantId)) || (principal.tenantId === tenantId);
      if (isOwned) {
        auditLogger.logEvent(
          'AUTHORIZATION_ALLOWED',
          principal.id,
          action,
          `tenant:${tenantId}`,
          'ALLOWED',
          {
            tenantId,
            requestId: effectiveRequestId,
            details: { rule: 'BUSINESS_OWNER_PORTFOLIO_MATCH', ownerId: principal.id },
          }
        );
        return;
      }

      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        principal.id,
        action,
        `tenant:${tenantId}`,
        'DENIED',
        {
          tenantId,
          requestId: effectiveRequestId,
          details: {
            reason: `Business Owner '${principal.id}' does not own tenant '${tenantId}' in their portfolio`,
            rule: 'BUSINESS_OWNER_CROSS_TENANT_VIOLATION',
          },
        }
      );
      throw new AuthorizationError(
        `Security Violation: Business Owner '${principal.id}' does not own tenant '${tenantId}' in their portfolio`,
        effectiveRequestId
      );
    }

    // 3. OWNER_OPERATOR: Must match assigned tenantId
    if (this.isOwnerOperator(principal)) {
      if (principal.tenantId && principal.tenantId === tenantId) {
        auditLogger.logEvent(
          'AUTHORIZATION_ALLOWED',
          principal.id,
          action,
          `tenant:${tenantId}`,
          'ALLOWED',
          {
            tenantId,
            requestId: effectiveRequestId,
            details: { rule: 'OWNER_OPERATOR_TENANT_MATCH' },
          }
        );
        return;
      }

      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        principal.id,
        action,
        `tenant:${tenantId}`,
        'DENIED',
        {
          tenantId,
          requestId: effectiveRequestId,
          details: {
            reason: `Owner Operator '${principal.id}' bound to tenant '${principal.tenantId || 'NONE'}' cannot access tenant '${tenantId}'`,
            rule: 'OWNER_OPERATOR_CROSS_TENANT_VIOLATION',
          },
        }
      );
      throw new AuthorizationError(
        `Security Violation: Owner Operator '${principal.id}' bound to tenant '${principal.tenantId || 'NONE'}' cannot access tenant '${tenantId}'`,
        effectiveRequestId
      );
    }

    // 4. Other tenant roles: BRANCH_MANAGER, STAFF, AUDITOR, etc.
    const roles = Array.isArray(principal.roles) ? principal.roles : [];
    if (roles.length > 0 && principal.tenantId && principal.tenantId === tenantId) {
      auditLogger.logEvent(
        'AUTHORIZATION_ALLOWED',
        principal.id,
        action,
        `tenant:${tenantId}`,
        'ALLOWED',
        {
          tenantId,
          requestId: effectiveRequestId,
          details: { rule: 'TENANT_MEMBER_MATCH', roles: principal.roles },
        }
      );
      return;
    }

    // 5. Cross-tenant or unassigned
    const reason = principal.tenantId
      ? `Cross-tenant violation: Principal from tenant '${principal.tenantId}' cannot access tenant '${tenantId}'`
      : `Insufficient authority for tenant '${tenantId}'`;

    auditLogger.logEvent(
      'AUTHORIZATION_DENIED',
      principal.id,
      action,
      `tenant:${tenantId}`,
      'DENIED',
      {
        tenantId,
        requestId: effectiveRequestId,
        details: { reason, userTenantId: principal.tenantId, userRoles: principal.roles },
      }
    );
    throw new AuthorizationError(`Security Violation: ${reason}`, effectiveRequestId);
  }

  /**
   * Helper to check tenant authorization without throwing.
   */
  public async isTenantAuthorized(
    contextOrPrincipal: SecurityContext | Principal,
    tenantId: string,
    action: string = 'CHECK_TENANT_AUTHORITY'
  ): Promise<boolean> {
    try {
      await this.assertTenantAuthority(contextOrPrincipal, tenantId, action);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Asserts Owner Portfolio or TDBK MASTER authority for DBK provisioning and management.
   */
  public assertOwnerOrMasterAuthority(principal: Principal, action: string, requestId?: string): void {
    // Portfolio authority is deliberately restricted to TDBK MASTER and
    // BUSINESS_OWNER. OWNER_OPERATOR is tenant-bound and must never gain
    // cross-DBK provisioning/portfolio authority from this helper.
    const authorized = !!principal && (
      this.isMasterAdmin(principal) ||
      this.isBusinessOwner(principal)
    );

    if (!authorized) {
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
