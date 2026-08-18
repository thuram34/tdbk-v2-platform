/**
 * TDBK V2 KERNEL SAFE ERROR MODEL
 * Prevents cross-tenant information leaks and sensitive stack trace exposure.
 */

import { KernelErrorCode } from '../types';

export class KernelError extends Error {
  public readonly code: KernelErrorCode;
  public readonly statusCode: number;
  public readonly status: number;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(code: KernelErrorCode, message: string, statusCode: number = 400, requestId?: string) {
    // Sanitize message to prevent leaking database structure or secret strings
    super(KernelError.sanitizeMessage(message));
    this.name = 'KernelError';
    this.code = code;
    this.statusCode = statusCode;
    this.status = statusCode;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  private static sanitizeMessage(msg: any): string {
    if (!msg) return 'An error occurred';
    const str = typeof msg === 'string' ? msg : String(msg);
    // Remove database connection strings, passwords, secret keys
    return str
      .replace(/postgres:\/\/[^\s]+/gi, '[REDACTED_DB_URI]')
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED_TOKEN]')
      .replace(/(?:key|secret|password|auth|token)=["']?[^"'\s]+["']?/gi, '$1=[REDACTED]');
  }

  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        requestId: this.requestId || 'N/A',
      },
    };
  }
}

export class AuthenticationError extends KernelError {
  constructor(message = 'Authentication failed or missing credentials', requestId?: string) {
    super('AUTHENTICATION_ERROR', message, 401, requestId);
  }
}

export class AuthorizationError extends KernelError {
  constructor(message = 'Access denied: insufficient permissions', requestId?: string) {
    super('AUTHORIZATION_ERROR', message, 403, requestId);
  }
}

export class TenantIsolationError extends KernelError {
  constructor(message = 'Tenant boundary violation detected: access denied', requestId?: string) {
    super('TENANT_ISOLATION_ERROR', message, 403, requestId);
  }
}

export class ValidationError extends KernelError {
  constructor(message = 'Invalid request parameters or payload', requestId?: string) {
    super('VALIDATION_ERROR', message, 422, requestId);
  }
}

export class NotFoundError extends KernelError {
  constructor(message = 'Requested resource not found', requestId?: string) {
    super('NOT_FOUND', message, 404, requestId);
  }
}

export class ConflictError extends KernelError {
  constructor(message = 'Resource conflict detected', requestId?: string) {
    super('CONFLICT', message, 409, requestId);
  }
}

export class InternalKernelError extends KernelError {
  constructor(message = 'Internal kernel error', requestId?: string) {
    super('INTERNAL_ERROR', message, 500, requestId);
  }
}
