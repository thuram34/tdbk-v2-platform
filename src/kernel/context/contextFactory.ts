/**
 * TDBK V2 SECURITY CONTEXT FACTORY
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { SecurityContext, Principal } from '../types';
import { tokenVerifier } from '../identity/tokenVerifier';
import { tenantIsolation } from '../tenancy/tenantIsolation';
import { branchAuthority } from '../branch/branchAuthority';

export class SecurityContextFactory {
  /**
   * Constructs a validated SecurityContext for an incoming server request.
   */
  public async createSecurityContext(options: {
    authHeader?: string;
    targetTenantId?: string;
    targetBranchId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    correlationId?: string;
  }): Promise<SecurityContext> {
    const reqId = options.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const corrId = options.correlationId || reqId;

    let principal: Principal;
    if (options.authHeader) {
      principal = await tokenVerifier.verifyToken(options.authHeader, reqId);
    } else {
      // Unauthenticated Anonymous Principal
      principal = {
        id: 'ANONYMOUS_GUEST',
        isMaster: false,
        tenantId: null,
        branchId: null,
        roles: ['GUEST'],
        permissions: [],
        authTime: Math.floor(Date.now() / 1000),
        tokenSource: 'SESSION',
      };
    }

    const tenantCtx = options.targetTenantId
      ? tenantIsolation.assertTenantIsolation(principal, options.targetTenantId, 'CONTEXT_RESOLVE', reqId)
      : principal.tenantId
      ? tenantIsolation.resolveTenantContext(principal.tenantId)
      : null;

    const branchCtx = options.targetBranchId
      ? branchAuthority.assertBranchContext(principal, options.targetBranchId, 'CONTEXT_RESOLVE', reqId)
      : principal.branchId
      ? branchAuthority.resolveBranchContext(principal.branchId)
      : null;

    return {
      requestId: reqId,
      correlationId: corrId,
      timestamp: new Date().toISOString(),
      principal,
      tenantContext: tenantCtx,
      branchContext: branchCtx,
      ipAddress: options.ipAddress || '127.0.0.1',
      userAgent: options.userAgent || 'TDBK-Kernel-Agent',
    };
  }
}

export const securityContextFactory = new SecurityContextFactory();
