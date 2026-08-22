/**
 * TDBK V2 — AUTHORITATIVE TDBK IDENTITY SERVICE
 * Architectural Layer: LAYER 1 — KERNEL / IDENTITY
 * Governs role assignments, privilege boundaries, and owner promotions.
 */

import {
  TdbkIdentityRecord,
  TdbkIdentityClaims,
  ProvisionIdentityRequest,
  AssignRoleRequest,
  PromoteOwnerRequest,
  RevokeRoleRequest,
} from './types';
import { SecurityContext } from '../types';
import { masterAuthority } from '../master/masterAuthority';
import { auditLogger } from '../audit/auditLogger';
import { AuthorizationError, KernelError } from '../errors/kernelErrors';
import { firebaseIdentityManager } from './firebaseIdentityManager';
import { tdbkIdentityRepository } from '../../persistence/firestore/repositories/tdbkIdentityRepository';

export class TdbkIdentityService {
  private static instance: TdbkIdentityService;

  private constructor() {}

  public static getInstance(): TdbkIdentityService {
    if (!TdbkIdentityService.instance) {
      TdbkIdentityService.instance = new TdbkIdentityService();
    }
    return TdbkIdentityService.instance;
  }

  /**
   * Authoritatively provisions a new TDBK Identity with assigned roles & permissions.
   * Gated by Master or Business Owner authority.
   */
  public async provisionTdbkIdentity(
    context: SecurityContext,
    request: ProvisionIdentityRequest
  ): Promise<TdbkIdentityRecord> {
    const { principal, requestId } = context;

    // Privilege Escalation Guard: Only TDBK_MASTER_ADMIN can assign isMaster or TDBK_MASTER_ADMIN role
    const isRequestingMaster = request.isMaster || (request.roles && request.roles.includes('TDBK_MASTER_ADMIN'));
    if (isRequestingMaster && !masterAuthority.isMasterAdmin(principal)) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        principal.id,
        'IDENTITY_PROVISION_UNAUTHORIZED_MASTER_ESCALATION',
        `user:${request.uid}`,
        'DENIED',
        {
          tenantId: request.tenantId || null,
          requestId,
          details: { reason: 'Non-master actor attempted to provision TDBK_MASTER_ADMIN identity' },
        }
      );
      throw new AuthorizationError('Security Violation: Only TDBK MASTER ADMIN can grant master administrative authority', requestId);
    }

    // Privilege Escalation Guard: Only TDBK_MASTER_ADMIN can provision BUSINESS_OWNER role
    if (request.roles && request.roles.includes('BUSINESS_OWNER') && !masterAuthority.isMasterAdmin(principal)) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        principal.id,
        'IDENTITY_PROVISION_UNAUTHORIZED_OWNER_ESCALATION',
        `user:${request.uid}`,
        'DENIED',
        {
          tenantId: request.tenantId || null,
          requestId,
          details: { reason: 'Non-master actor attempted to provision BUSINESS_OWNER identity' },
        }
      );
      throw new AuthorizationError('Security Violation: Only TDBK MASTER ADMIN can provision BUSINESS_OWNER identity', requestId);
    }

    // Tenant Authority Assertion: Verify that the caller has authority over the requested tenant
    if (request.tenantId) {
      await masterAuthority.assertTenantAuthority(context, request.tenantId, 'PROVISION_TDBK_IDENTITY', requestId);
    } else if (!isRequestingMaster && !masterAuthority.isMasterAdmin(principal)) {
      throw new AuthorizationError('Security Violation: Global identity provisioning requires TDBK MASTER ADMIN authority', requestId);
    }

    const now = new Date().toISOString();
    const roles = request.roles || [];
    const permissions = request.permissions || [];

    // Default permissions based on roles if none provided
    if (roles.includes('BUSINESS_OWNER') && permissions.length === 0) {
      permissions.push('PORTFOLIO_READ', 'PORTFOLIO_WRITE', 'DBK_PROVISION', 'DBK_MANAGE', 'FINANCE_READ', 'REPORTS_VIEW');
    }

    const record: TdbkIdentityRecord = {
      uid: request.uid,
      email: request.email,
      displayName: request.displayName,
      roles,
      permissions,
      tenantId: request.tenantId ?? null,
      branchId: request.branchId ?? null,
      isMaster: Boolean(request.isMaster),
      disabled: false,
      createdAt: now,
      updatedAt: now,
      assignedBy: principal.id,
    };

    // 1. Sync claims to Firebase Auth
    const claims: TdbkIdentityClaims = {
      roles: record.roles,
      permissions: record.permissions,
      tenantId: record.tenantId,
      branchId: record.branchId,
      isMaster: record.isMaster,
      metadata: {
        displayName: record.displayName,
        email: record.email,
        assignedAt: now,
        assignedBy: principal.id,
      },
    };
    await firebaseIdentityManager.setTdbkClaims(request.uid, claims);

    // 2. Persist to Firestore
    await tdbkIdentityRepository.saveIdentity(request.uid, record);

    // 3. Audit Log
    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      principal.id,
      'TDBK_IDENTITY_PROVISIONED',
      `user:${request.uid}`,
      'ALLOWED',
      {
        tenantId: record.tenantId,
        branchId: record.branchId,
        requestId,
        details: {
          roles: record.roles,
          permissions: record.permissions,
          isMaster: record.isMaster,
        },
      }
    );

    return record;
  }

  /**
   * Promotes a Firebase user to BUSINESS_OWNER.
   * RESTRICTED: TDBK MASTER ADMIN ONLY.
   */
  public async promoteToBusinessOwner(
    context: SecurityContext,
    request: PromoteOwnerRequest
  ): Promise<TdbkIdentityRecord> {
    const { principal, requestId } = context;

    // STRICT: Only Master Admin can promote a user to Business Owner
    masterAuthority.assertMasterAuthority(principal, 'PROMOTE_BUSINESS_OWNER', requestId);

    const existing = await tdbkIdentityRepository.getIdentity(request.targetUid);
    const existingRoles = existing?.roles || [];
    const updatedRoles = Array.from(new Set([...existingRoles, 'BUSINESS_OWNER']));

    const existingPerms = existing?.permissions || [];
    const ownerPerms = ['PORTFOLIO_READ', 'PORTFOLIO_WRITE', 'DBK_PROVISION', 'DBK_MANAGE', 'FINANCE_READ', 'REPORTS_VIEW'];
    const updatedPerms = Array.from(new Set([...existingPerms, ...ownerPerms]));

    const now = new Date().toISOString();
    const record: TdbkIdentityRecord = {
      uid: request.targetUid,
      email: request.email || existing?.email,
      displayName: request.displayName || existing?.displayName,
      roles: updatedRoles,
      permissions: updatedPerms,
      tenantId: existing?.tenantId ?? null,
      branchId: existing?.branchId ?? null,
      isMaster: existing?.isMaster ?? false,
      disabled: false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      assignedBy: principal.id,
    };

    const claims: TdbkIdentityClaims = {
      roles: record.roles,
      permissions: record.permissions,
      tenantId: record.tenantId,
      branchId: record.branchId,
      isMaster: record.isMaster,
      metadata: {
        assignedAt: now,
        assignedBy: principal.id,
      },
    };

    await firebaseIdentityManager.setTdbkClaims(request.targetUid, claims);
    await tdbkIdentityRepository.saveIdentity(request.targetUid, record);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      principal.id,
      'PROMOTED_TO_BUSINESS_OWNER',
      `user:${request.targetUid}`,
      'ALLOWED',
      {
        requestId,
        details: { targetUid: request.targetUid, previousRoles: existingRoles, newRoles: updatedRoles },
      }
    );

    return record;
  }

  /**
   * Promotes a user to OWNER_OPERATOR for a specific tenant/DBK.
   * Gated by Master Admin or Business Owner of the tenant.
   */
  public async promoteToOwnerOperator(
    context: SecurityContext,
    targetUid: string,
    tenantId: string,
    email?: string
  ): Promise<TdbkIdentityRecord> {
    const { principal, requestId } = context;

    // Check authoritative tenant authority (Master or portfolio Business Owner)
    await masterAuthority.assertTenantAuthority(context, tenantId, 'PROMOTE_OWNER_OPERATOR', requestId);

    const existing = await tdbkIdentityRepository.getIdentity(targetUid);
    const existingRoles = existing?.roles || [];
    const updatedRoles = Array.from(new Set([...existingRoles, 'OWNER_OPERATOR']));

    const operatorPerms = ['TENANT_ADMIN', 'BRANCH_MANAGE', 'STAFF_MANAGE', 'FINANCE_OPERATE', 'REPORTS_VIEW'];
    const updatedPerms = Array.from(new Set([...(existing?.permissions || []), ...operatorPerms]));

    const now = new Date().toISOString();
    const record: TdbkIdentityRecord = {
      uid: targetUid,
      email: email || existing?.email,
      displayName: existing?.displayName,
      roles: updatedRoles,
      permissions: updatedPerms,
      tenantId,
      branchId: existing?.branchId ?? null,
      isMaster: false,
      disabled: false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      assignedBy: principal.id,
    };

    const claims: TdbkIdentityClaims = {
      roles: record.roles,
      permissions: record.permissions,
      tenantId: record.tenantId,
      branchId: record.branchId,
      isMaster: false,
      metadata: {
        assignedAt: now,
        assignedBy: principal.id,
      },
    };

    await firebaseIdentityManager.setTdbkClaims(targetUid, claims);
    await tdbkIdentityRepository.saveIdentity(targetUid, record);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      principal.id,
      'PROMOTED_TO_OWNER_OPERATOR',
      `user:${targetUid}`,
      'ALLOWED',
      {
        tenantId,
        requestId,
        details: { targetUid, tenantId, updatedRoles },
      }
    );

    return record;
  }

  /**
   * Grants TDBK_MASTER_ADMIN authority to a user.
   * RESTRICTED: TDBK MASTER ADMIN ONLY.
   */
  public async grantMasterAdmin(
    context: SecurityContext,
    targetUid: string,
    email?: string
  ): Promise<TdbkIdentityRecord> {
    const { principal, requestId } = context;
    masterAuthority.assertMasterAuthority(principal, 'GRANT_MASTER_ADMIN', requestId);

    const existing = await tdbkIdentityRepository.getIdentity(targetUid);
    const existingRoles = existing?.roles || [];
    const updatedRoles = Array.from(new Set([...existingRoles, 'TDBK_MASTER_ADMIN']));

    const now = new Date().toISOString();
    const record: TdbkIdentityRecord = {
      uid: targetUid,
      email: email || existing?.email,
      displayName: existing?.displayName,
      roles: updatedRoles,
      permissions: ['*'],
      tenantId: null,
      branchId: null,
      isMaster: true,
      disabled: false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      assignedBy: principal.id,
    };

    const claims: TdbkIdentityClaims = {
      roles: record.roles,
      permissions: record.permissions,
      tenantId: null,
      branchId: null,
      isMaster: true,
      metadata: {
        assignedAt: now,
        assignedBy: principal.id,
      },
    };

    await firebaseIdentityManager.setTdbkClaims(targetUid, claims);
    await tdbkIdentityRepository.saveIdentity(targetUid, record);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      principal.id,
      'GRANTED_TDBK_MASTER_ADMIN',
      `user:${targetUid}`,
      'ALLOWED',
      {
        requestId,
        details: { targetUid, grantedBy: principal.id },
      }
    );

    return record;
  }

  /**
   * Assigns a tenant-scoped role (BRANCH_MANAGER, STAFF, AUDITOR, etc.) to a user.
   */
  public async assignTenantRole(
    context: SecurityContext,
    request: AssignRoleRequest
  ): Promise<TdbkIdentityRecord> {
    const { principal, requestId } = context;

    // Privilege Escalation Guard: Cannot assign TDBK_MASTER_ADMIN or BUSINESS_OWNER through tenant role assignment
    if (request.role === 'TDBK_MASTER_ADMIN') {
      throw new AuthorizationError('Security Violation: TDBK_MASTER_ADMIN must be granted via master authority channel', requestId);
    }
    if (request.role === 'BUSINESS_OWNER' && !masterAuthority.isMasterAdmin(principal)) {
      throw new AuthorizationError('Security Violation: BUSINESS_OWNER must be granted by TDBK MASTER ADMIN', requestId);
    }

    // Check authority over target tenant
    await masterAuthority.assertTenantAuthority(context, request.tenantId, 'ASSIGN_TENANT_ROLE', requestId);

    const existing = await tdbkIdentityRepository.getIdentity(request.targetUid);

    // Cross-tenant user protection: if target is assigned to a different tenant, check caller's authority over that tenant as well
    if (existing?.tenantId && existing.tenantId !== request.tenantId && !masterAuthority.isMasterAdmin(principal)) {
      await masterAuthority.assertTenantAuthority(context, existing.tenantId, 'REASSIGN_TENANT_USER', requestId);
    }

    const existingRoles = existing?.roles || [];
    const updatedRoles = Array.from(new Set([...existingRoles, request.role]));

    const defaultPerms: Record<string, string[]> = {
      BRANCH_MANAGER: ['BRANCH_OPERATE', 'STAFF_VIEW', 'INVENTORY_MANAGE', 'ORDERS_PROCESS', 'REPORTS_VIEW'],
      STAFF: ['POS_OPERATE', 'ORDERS_CREATE', 'INVENTORY_VIEW'],
      AUDITOR: ['REPORTS_VIEW', 'AUDIT_VIEW', 'TRANSACTIONS_VIEW'],
      INTEGRATION_AGENT: ['API_INGRESS', 'WEBHOOK_PROCESS'],
    };

    const addedPerms = request.permissions || defaultPerms[request.role] || [];
    const updatedPerms = Array.from(new Set([...(existing?.permissions || []), ...addedPerms]));

    const now = new Date().toISOString();
    const record: TdbkIdentityRecord = {
      uid: request.targetUid,
      email: existing?.email,
      displayName: existing?.displayName,
      roles: updatedRoles,
      permissions: updatedPerms,
      tenantId: request.tenantId,
      branchId: request.branchId ?? existing?.branchId ?? null,
      isMaster: existing?.isMaster ?? false,
      disabled: false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      assignedBy: principal.id,
    };

    const claims: TdbkIdentityClaims = {
      roles: record.roles,
      permissions: record.permissions,
      tenantId: record.tenantId,
      branchId: record.branchId,
      isMaster: record.isMaster,
      metadata: {
        assignedAt: now,
        assignedBy: principal.id,
      },
    };

    await firebaseIdentityManager.setTdbkClaims(request.targetUid, claims);
    await tdbkIdentityRepository.saveIdentity(request.targetUid, record);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      principal.id,
      'TENANT_ROLE_ASSIGNED',
      `user:${request.targetUid}`,
      'ALLOWED',
      {
        tenantId: request.tenantId,
        branchId: request.branchId,
        requestId,
        details: { targetUid: request.targetUid, assignedRole: request.role },
      }
    );

    return record;
  }

  /**
   * Revokes a specific role or all TDBK roles from a user.
   */
  public async revokeRole(
    context: SecurityContext,
    request: RevokeRoleRequest
  ): Promise<TdbkIdentityRecord> {
    const { principal, requestId } = context;

    const existing = await tdbkIdentityRepository.getIdentity(request.targetUid);
    if (!existing) {
      throw new KernelError('NOT_FOUND', `Identity for UID '${request.targetUid}' not found`, 404, requestId);
    }

    // If target has master admin, only Master Admin can revoke it
    if (existing.isMaster || existing.roles.includes('TDBK_MASTER_ADMIN')) {
      masterAuthority.assertMasterAuthority(principal, 'REVOKE_MASTER_ADMIN', requestId);
    } else if (existing.roles.includes('BUSINESS_OWNER')) {
      masterAuthority.assertMasterAuthority(principal, 'REVOKE_BUSINESS_OWNER', requestId);
    } else if (existing.tenantId) {
      await masterAuthority.assertTenantAuthority(context, existing.tenantId, 'REVOKE_TENANT_ROLE', requestId);
    } else if (!masterAuthority.isMasterAdmin(principal)) {
      throw new AuthorizationError('Security Violation: Unauthorized role revocation attempt on global identity', requestId);
    }

    let updatedRoles = existing.roles;
    let isMaster = existing.isMaster;

    if (!request.role) {
      // Revoke all roles
      updatedRoles = [];
      isMaster = false;
      await firebaseIdentityManager.removeTdbkClaims(request.targetUid);
    } else {
      updatedRoles = existing.roles.filter((r) => r !== request.role);
      if (request.role === 'TDBK_MASTER_ADMIN') {
        isMaster = false;
      }
      const claims: TdbkIdentityClaims = {
        roles: updatedRoles,
        permissions: existing.permissions,
        tenantId: existing.tenantId,
        branchId: existing.branchId,
        isMaster,
      };
      await firebaseIdentityManager.setTdbkClaims(request.targetUid, claims);
    }

    const now = new Date().toISOString();
    const updatedRecord: TdbkIdentityRecord = {
      ...existing,
      roles: updatedRoles,
      isMaster,
      updatedAt: now,
      assignedBy: principal.id,
    };

    await tdbkIdentityRepository.saveIdentity(request.targetUid, updatedRecord);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      principal.id,
      'ROLE_REVOKED',
      `user:${request.targetUid}`,
      'ALLOWED',
      {
        tenantId: existing.tenantId,
        requestId,
        details: { targetUid: request.targetUid, revokedRole: request.role || 'ALL' },
      }
    );

    return updatedRecord;
  }

  /**
   * Retrieves identity record for UID.
   */
  public async getIdentity(context: SecurityContext, uid: string): Promise<TdbkIdentityRecord | null> {
    const { principal, requestId } = context;

    // Users can read their own identity without restriction
    if (principal.id === uid) {
      return await tdbkIdentityRepository.getIdentity(uid);
    }

    // TDBK_MASTER_ADMIN can read any identity
    if (masterAuthority.isMasterAdmin(principal)) {
      return await tdbkIdentityRepository.getIdentity(uid);
    }

    const target = await tdbkIdentityRepository.getIdentity(uid);
    if (!target) {
      return null;
    }

    // If target has a tenant, verify tenant authority
    if (target.tenantId) {
      await masterAuthority.assertTenantAuthority(context, target.tenantId, 'GET_IDENTITY', requestId);
      return target;
    }

    // If target has no tenant and caller is not Master Admin, access is denied
    throw new AuthorizationError('Security Violation: Insufficient permissions to view identity profile', requestId);
  }

  /**
   * Lists identities, optionally filtered by tenant.
   */
  public async listIdentities(context: SecurityContext, tenantId?: string): Promise<TdbkIdentityRecord[]> {
    const { principal, requestId } = context;

    if (tenantId) {
      await masterAuthority.assertTenantAuthority(context, tenantId, 'LIST_IDENTITIES', requestId);
      return await tdbkIdentityRepository.listIdentities(tenantId);
    }

    // Global identity listing without tenantId filter requires Master Admin
    masterAuthority.assertMasterAuthority(principal, 'LIST_ALL_IDENTITIES', requestId);
    return await tdbkIdentityRepository.listIdentities();
  }
}

export const tdbkIdentityService = TdbkIdentityService.getInstance();
