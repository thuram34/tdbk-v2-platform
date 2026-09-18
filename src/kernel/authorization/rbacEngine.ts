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

    // 2. Tenant isolation check (if tenant-scoped)
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
      if (tenantId) tenantIsolation.assertTenantIsolation(principal, tenantId, action, requestId);
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

    if (requiredRole && !principal.roles.includes(requiredRole)) {
      return { allowed: false, reason: `Role requirement missing: required role '${requiredRole}' not found in principal roles [${principal.roles.join(', ')}]`, ruleEvaluated: 'ROLE_REQUIREMENT_RULE', evaluatedAt };
    }
    if (requiredPermission && !principal.permissions.includes(requiredPermission) && !principal.permissions.includes('*')) {
      return { allowed: false, reason: `Permission requirement missing: required permission '${requiredPermission}' not granted to principal`, ruleEvaluated: 'PERMISSION_REQUIREMENT_RULE', evaluatedAt };
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
