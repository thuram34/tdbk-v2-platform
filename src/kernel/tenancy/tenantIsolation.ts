/**
 * TDBK V2 TENANT ISOLATION ENGINE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { Principal, TenantContext } from '../types';
import { TenantIsolationError } from '../errors/kernelErrors';
import { auditLogger } from '../audit/auditLogger';
import { masterAuthority } from '../master/masterAuthority';

export class TenantIsolationService {
  /**
   * Asserts strict tenant isolation for a requested tenant resource.
   * Ensures DBK-A user cannot access DBK-B resources under any circumstances.
   * Master admin is permitted cross-tenant access for supervisory duties.
   */
  public assertTenantIsolation(
    principal?: Principal | null,
    requestedTenantId?: string,
    action: string = 'TENANT_BOUNDARY_VALIDATION',
    requestId?: string
  ): TenantContext {
    if (!requestedTenantId) {
      throw new TenantIsolationError('Missing target tenantId in operation request', requestId);
    }

    // TDBK MASTER bypass check
    if (principal && masterAuthority.isMasterAdmin(principal)) {
      return this.resolveTenantContext(requestedTenantId);
    }

    // Verify tenant match
    if (!principal || !principal.tenantId || principal.tenantId !== requestedTenantId) {
      auditLogger.logEvent(
        'TENANT_ISOLATION_VIOLATION',
        principal?.id || 'ANONYMOUS',
        action,
        `tenant:${requestedTenantId}`,
        'DENIED',
        {
          tenantId: principal?.tenantId || 'NONE',
          requestId,
          details: {
            principalTenant: principal?.tenantId || 'NONE',
            targetTenant: requestedTenantId,
            reason: 'Cross-tenant access attempt rejected by Kernel isolation barrier',
          },
        }
      );

      throw new TenantIsolationError(
        `Cross-tenant access denied. Principal tenant '${principal?.tenantId || 'NONE'}' cannot access target tenant '${requestedTenantId}'`,
        requestId
      );
    }

    return this.resolveTenantContext(requestedTenantId);
  }

  /**
   * Detects forged tenantId parameters in request payloads or URL parameters.
   * Compares client-provided untrusted string against principal's verified token claim.
   */
  public validateTenantBoundary(
    principal: Principal,
    untrustedTenantId?: string,
    requestId?: string
  ): void {
    if (!untrustedTenantId) return;

    if (!masterAuthority.isMasterAdmin(principal) && principal.tenantId !== untrustedTenantId) {
      auditLogger.logEvent(
        'TENANT_ISOLATION_VIOLATION',
        principal.id,
        'TENANT_BOUNDARY_VALIDATION',
        `tenant:${untrustedTenantId}`,
        'DENIED',
        {
          tenantId: principal.tenantId,
          requestId,
          details: {
            untrustedTenantId,
            tokenTenantId: principal.tenantId,
            reason: 'Forged tenantId parameter detected in request payload',
          },
        }
      );

      throw new TenantIsolationError('Forged tenant identity detected in request parameter', requestId);
    }
  }

  /**
   * Resolves TenantContext for an authorized tenant ID.
   */
  public resolveTenantContext(tenantId: string): TenantContext {
    // In Phase 0, resolves structured tenant context primitive
    return {
      tenantId,
      name: `DBK Tenant (${tenantId})`,
      blueprintId: 'blueprint_standard',
      status: 'ACTIVE',
    };
  }
}

export const tenantIsolation = new TenantIsolationService();
