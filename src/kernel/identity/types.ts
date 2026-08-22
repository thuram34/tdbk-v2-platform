/**
 * TDBK V2 — AUTHORITATIVE IDENTITY & CLAIMS TYPES
 * Architectural Layer: LAYER 1 — KERNEL
 */

export type TdbkRole =
  | 'TDBK_MASTER_ADMIN'
  | 'BUSINESS_OWNER'
  | 'OWNER_OPERATOR'
  | 'BRANCH_MANAGER'
  | 'STAFF'
  | 'AUDITOR'
  | 'INTEGRATION_AGENT'
  | 'ANONYMOUS_GUEST';

export interface TdbkIdentityClaims {
  roles: string[];
  permissions: string[];
  tenantId: string | null;
  branchId: string | null;
  isMaster: boolean;
  metadata?: {
    displayName?: string;
    email?: string;
    assignedAt?: string;
    assignedBy?: string;
    [key: string]: any;
  };
}

export interface TdbkIdentityRecord {
  uid: string;
  email?: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
  tenantId: string | null;
  branchId: string | null;
  isMaster: boolean;
  disabled?: boolean;
  customClaims?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  assignedBy?: string;
  metadata?: Record<string, any>;
}

export interface ProvisionIdentityRequest {
  uid: string;
  email?: string;
  displayName?: string;
  roles?: string[];
  permissions?: string[];
  tenantId?: string | null;
  branchId?: string | null;
  isMaster?: boolean;
}

export interface AssignRoleRequest {
  targetUid: string;
  tenantId: string;
  role: string;
  branchId?: string | null;
  permissions?: string[];
}

export interface PromoteOwnerRequest {
  targetUid: string;
  email?: string;
  displayName?: string;
}

export interface RevokeRoleRequest {
  targetUid: string;
  role?: string;
  tenantId?: string;
}
