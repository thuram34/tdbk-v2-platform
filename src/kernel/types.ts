/**
 * TDBK V2 KERNEL PRIMITIVES & TYPE DEFINITIONS
 * Architectural Layer: LAYER 1 — KERNEL
 */

export interface Principal {
  id: string;
  email?: string;
  isMaster: boolean;
  tenantId: string | null;
  branchId: string | null;
  roles: string[];
  permissions: string[];
  authTime: number;
  tokenSource: 'JWT' | 'SESSION' | 'SERVICE_KEY';
}

export interface TenantContext {
  tenantId: string;
  name: string;
  blueprintId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING';
}

export interface BranchContext {
  branchId: string;
  name: string;
  isHeadquarters: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface SecurityContext {
  requestId: string;
  correlationId: string;
  timestamp: string;
  principal: Principal;
  tenantContext: TenantContext | null;
  branchContext: BranchContext | null;
  ipAddress?: string;
  userAgent?: string;
}

export type SecurityEventType =
  | 'AUTHENTICATION_SUCCESS'
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHORIZATION_ALLOWED'
  | 'AUTHORIZATION_DENIED'
  | 'MASTER_ACTION'
  | 'TENANT_ISOLATION_VIOLATION'
  | 'PERMISSION_CHANGE'
  | 'SECURITY_CONFIGURATION_CHANGE'
  | 'WORKFLOW_EXECUTION'
  | 'BRIDGE_EXECUTION'
  | 'SYSTEM_ERROR';

export interface AuditEvent {
  id: string;
  eventType: SecurityEventType;
  timestamp: string;
  requestId: string;
  principalId: string;
  tenantId: string | null;
  branchId: string | null;
  action: string;
  resource: string;
  result: 'ALLOWED' | 'DENIED' | 'ERROR';
  details: Record<string, unknown>;
  ipAddress?: string;
}

export type KernelErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'TENANT_ISOLATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OPTIMISTIC_LOCK_ERROR'
  | 'INTEGRATION_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface AuthorizationResult {
  allowed: boolean;
  reason: string;
  ruleEvaluated: string;
  evaluatedAt: string;
}

export interface HealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  timestamp: string;
  version: string;
  environment: string;
  components: {
    kernel: boolean;
    tenancy: boolean;
    auth: boolean;
    audit: boolean;
    firestore?: boolean;
    eventBus?: boolean;
    bridgeAdapters?: boolean;
  };
}
