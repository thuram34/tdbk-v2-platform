/**
 * TDBK V2 RBAC / ABAC / PBAC AUTHORIZATION ENGINE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import {
  Principal,
  TenantContext,
  BranchContext,
  AuthorizationResult,
} from '../types';
import { AuthorizationError } from '../errors/kernelErrors';
import { auditLogger } from '../audit/auditLogger';
import { masterAuthority } from '../master/masterAuthority';
import { tenantIsolation } from '../tenancy/tenantIsolation';
import { branchAuthority } from '../branch/branchAuthority';
import { spaceMembershipRepository } from '../../persistence/firestore/repositories/spaceMembershipRepository';

export class RBACEngineService {
  /**
   * Universal server-side authorization primitive.
   * Evaluates Principal claims, Tenant context, Branch context, and permission policies.
   */
  public authorize(
    principal: Principal,
    action: string,
    resource: string,
    options: {
      tenantId?: string | null;
      branchId?: string | null;
      requiredPermission?: string;
      requiredRole?: string;
      requestId?: string;
    } = {}
  ): AuthorizationResult {
    const { tenantId, branchId, requiredPermission, requiredRole, requestId } = options;
    const evaluatedAt = new Date().toISOString();

    // 1. Master authority check
    if (masterAuthority.isMasterAdmin(principal)) {
      auditLogger.logEvent('AUTHORIZATION_ALLOWED', principal.id, action, resource, 'ALLOWED', {
        tenantId,
        branchId,
        requestId,
        details: { rule: 'MASTER_ADMIN_BYPASS' },
      });
      return {
        allowed: true,
        reason: 'Authorized via TDBK MASTER administrative override',
        ruleEvaluated: 'MASTER_ADMIN_OVERRIDE',
        evaluatedAt,
      };
    }

    // 2. Synchronous tenant isolation check.
    // Portfolio ownership is a durable async decision and is handled by
    // authorizeAsync(). The synchronous primitive remains strict.
    let validatedTenantContext: TenantContext | null = null;
    if (tenantId) {
      try {
        validatedTenantContext = tenantIsolation.assertTenantIsolation(
          principal,
          tenantId,
          action,
          requestId
        );
      } catch (err) {
        if (err instanceof Error) {
          return {
            allowed: false,
            reason: err.message,
            ruleEvaluated: 'TENANT_ISOLATION_RULE',
            evaluatedAt,
          };
        }
      }
    }

    // 3. Branch context check (if branch-scoped)
    let validatedBranchContext: BranchContext | null = null;
    if (branchId) {
      try {
        validatedBranchContext = branchAuthority.assertBranchContext(
          principal,
          branchId,
          action,
          requestId
        );
      } catch (err) {
        if (err instanceof Error) {
          return {
            allowed: false,
            reason: err.message,
            ruleEvaluated: 'BRANCH_ISOLATION_RULE',
            evaluatedAt,
          };
        }
      }
    }

    // 4. Role check
    if (requiredRole && !principal.roles.includes(requiredRole)) {
      const reason = `Role requirement missing: required role '${requiredRole}' not found in principal roles [${principal.roles.join(', ')}]`;
      auditLogger.logEvent('AUTHORIZATION_DENIED', principal.id, action, resource, 'DENIED', {
        tenantId,
        branchId,
        requestId,
        details: { reason, requiredRole, userRoles: principal.roles },
      });
      return {
        allowed: false,
        reason,
        ruleEvaluated: 'ROLE_REQUIREMENT_RULE',
        evaluatedAt,
      };
    }

    // 5. Permission check
    if (requiredPermission && !principal.permissions.includes(requiredPermission) && !principal.permissions.includes('*')) {
      const reason = `Permission requirement missing: required permission '${requiredPermission}' not granted to principal`;
      auditLogger.logEvent('AUTHORIZATION_DENIED', principal.id, action, resource, 'DENIED', {
        tenantId,
        branchId,
        requestId,
        details: { reason, requiredPermission, userPermissions: principal.permissions },
      });
      return {
        allowed: false,
        reason,
        ruleEvaluated: 'PERMISSION_REQUIREMENT_RULE',
        evaluatedAt,
      };
    }

    // Authorized
    auditLogger.logEvent('AUTHORIZATION_ALLOWED', principal.id, action, resource, 'ALLOWED', {
      tenantId: validatedTenantContext?.tenantId ?? tenantId,
      branchId: validatedBranchContext?.branchId ?? branchId,
      requestId,
      details: { action, resource, requiredRole, requiredPermission },
    });

    return {
      allowed: true,
      reason: 'Authorization policy evaluation succeeded',
      ruleEvaluated: 'POLICY_EVALUATION_SUCCESS',
      evaluatedAt,
    };
  }

  /** Authoritative async authorization path for production request handling. */
  public async authorizeAsync(
    principal: Principal,
    action: string,
    resource: string,
    options: {
      tenantId?: string | null;
      branchId?: string | null;
      requiredPermission?: string;
      requiredRole?: string;
      requestId?: string;
    } = {}
  ): Promise<AuthorizationResult> {
    const { tenantId, branchId, requiredPermission, requiredRole, requestId } = options;
    const evaluatedAt = new Date().toISOString();

    if (masterAuthority.isMasterAdmin(principal)) {
      return { allowed: true, reason: 'Authorized via TDBK MASTER administrative override', ruleEvaluated: 'MASTER_ADMIN_OVERRIDE', evaluatedAt };
    }

    try {
      if (tenantId) await masterAuthority.assertTenantAuthority(principal, tenantId, action, requestId);
      if (branchId) {
        await branchAuthority.assertPersistentBranchContext(
          principal,
          tenantId || principal.tenantId || '',
          branchId,
          action,
          requestId
        );
      }
    } catch (err) {
      return {
        allowed: false,
        reason: err instanceof Error ? err.message : 'Authorization denied',
        ruleEvaluated: branchId ? 'BRANCH_ISOLATION_RULE' : 'TENANT_ISOLATION_RULE',
        evaluatedAt,
      };
    }

    const effectiveAuthority = tenantId
      ? await this.getEffectiveMembershipAuthority(principal, tenantId, branchId)
      : { roles: principal.roles, permissions: principal.permissions, membershipIds: [] };

    if (tenantId && !masterAuthority.isMasterAdmin(principal) && !masterAuthority.isOwnerPortfolio(principal) && !principal.isMaster && effectiveAuthority.membershipIds.length === 0) {
      return { allowed: false, reason: 'No active DBK membership exists for this principal in the requested context', ruleEvaluated: 'MEMBERSHIP_AUTHORITY_RULE', evaluatedAt };
    }

    if (requiredRole && !effectiveAuthority.roles.includes(requiredRole)) {
      return { allowed: false, reason: `Role requirement missing: required role '${requiredRole}' not granted in the active DBK membership context`, ruleEvaluated: 'ROLE_REQUIREMENT_RULE', evaluatedAt };
    }
    if (requiredPermission && !effectiveAuthority.permissions.includes(requiredPermission) && !effectiveAuthority.permissions.includes('*')) {
      return { allowed: false, reason: `Permission requirement missing: required permission '${requiredPermission}' not granted in the active DBK membership context`, ruleEvaluated: 'PERMISSION_REQUIREMENT_RULE', evaluatedAt };
    }

    return { allowed: true, reason: 'Authorization policy evaluation succeeded', ruleEvaluated: 'POLICY_EVALUATION_SUCCESS', evaluatedAt };
  }

  public hasPermission(principal?: Principal | null, permission?: string): boolean {
    if (!principal) return false;
    if (masterAuthority.isMasterAdmin(principal) || principal.isMaster) return true;
    if (principal.permissions?.includes('*')) return true;
    return permission ? (principal.permissions?.includes(permission) || false) : false;
  }

  /**
   * Resolves the effective DBK/branch membership authority for an actor.
   * Membership is the authoritative runtime role boundary; Firebase claims
   * remain the identity/bootstrap layer and may be broader than the active DBK role.
   */
  public async getEffectiveMembershipAuthority(
    principal: Principal,
    tenantId: string,
    branchId?: string | null,
  ): Promise<{ roles: string[]; permissions: string[]; membershipIds: string[] }> {
    if (masterAuthority.isMasterAdmin(principal) || principal.isMaster) {
      return { roles: ['TDBK_MASTER_ADMIN'], permissions: ['*'], membershipIds: [] };
    }

    const memberships = await spaceMembershipRepository.listMemberships(tenantId, principal.id);
    const activeTenant = memberships.filter((membership) => membership.status === 'ACTIVE');
    const activeBranch = branchId
      ? activeTenant.filter((membership) => membership.spaceId === branchId)
      : activeTenant;

    // Owner/operator and tenant-admin authority is tenant-wide. Other roles remain
    // branch-scoped unless they have an explicit membership in the requested branch.
    const tenantWide = activeTenant.filter((membership) =>
      ['OWNER_OPERATOR', 'TENANT_ADMIN', 'BUSINESS_OWNER'].includes(membership.role),
    );
    const active = branchId && activeBranch.length === 0 ? tenantWide : activeBranch;

    if (branchId && active.length === 0) {
      return { roles: [], permissions: [], membershipIds: [] };
    }

    const roles = Array.from(new Set(active.map((membership) => membership.role)));
    const permissions = Array.from(
      new Set(active.flatMap((membership) => membership.permissions || [])),
    );

    return {
      roles,
      permissions,
      membershipIds: active.map((membership) => membership.membershipId),
    };
  }

  public async hasPermissionForContext(
    principal: Principal,
    permission: string,
    tenantId: string,
    branchId?: string | null,
  ): Promise<boolean> {
    if (masterAuthority.isMasterAdmin(principal) || principal.isMaster || principal.permissions?.includes('*')) return true;
    const authority = await this.getEffectiveMembershipAuthority(principal, tenantId, branchId);
    return authority.permissions.includes('*') || authority.permissions.includes(permission);
  }

  public async hasAnyRoleForContext(
    principal: Principal,
    roles: string[],
    tenantId: string,
    branchId?: string | null,
  ): Promise<boolean> {
    if (masterAuthority.isMasterAdmin(principal) || principal.isMaster) return true;
    if (roles.length === 0) return true;
    const authority = await this.getEffectiveMembershipAuthority(principal, tenantId, branchId);
    return roles.some((role) => authority.roles.includes(role));
  }

  /**
   * Asserts authorization, throwing AuthorizationError if denied.
   */
  public assertAuthorization(
    principal: Principal,
    action: string,
    resource: string,
    options: {
      tenantId?: string | null;
      branchId?: string | null;
      requiredPermission?: string;
      requiredRole?: string;
      requestId?: string;
    } = {}
  ): void {
    const result = this.authorize(principal, action, resource, options);
    if (!result.allowed) {
      throw new AuthorizationError(result.reason, options.requestId);
    }
  }
}

export const rbacEngine = new RBACEngineService();
