/**
 * TDBK V2 KERNEL AUDIT & SECURITY EVENT ENGINE
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { AuditEvent, SecurityEventType, SecurityContext } from '../types';

class AuditLoggerService {
  private auditLogBuffer: AuditEvent[] = [];
  private readonly maxBufferSize = 1000;

  /**
   * Records an immutable security or system audit event.
   */
  public logEvent(
    eventType: SecurityEventType,
    principalId: string,
    action: string,
    resource: string,
    result: 'ALLOWED' | 'DENIED' | 'ERROR',
    options: {
      tenantId?: string | null;
      branchId?: string | null;
      requestId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
    } = {}
  ): AuditEvent {
    const event: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      eventType,
      timestamp: new Date().toISOString(),
      requestId: options.requestId || 'sys_internal',
      principalId: principalId || 'ANONYMOUS',
      tenantId: options.tenantId ?? null,
      branchId: options.branchId ?? null,
      action,
      resource,
      result,
      details: this.sanitizeDetails(options.details || {}),
      ipAddress: options.ipAddress || '127.0.0.1',
    };

    // Buffer the event
    this.auditLogBuffer.unshift(event);
    if (this.auditLogBuffer.length > this.maxBufferSize) {
      this.auditLogBuffer.pop();
    }

    // Output structured JSON log to stdout/stderr
    const logLevel = result === 'DENIED' || result === 'ERROR' ? 'WARN' : 'INFO';
    console.log(`[AUDIT_${logLevel}] [${event.eventType}] ${event.principalId} -> ${event.action} on ${event.resource} [${event.result}] (Tenant: ${event.tenantId || 'NONE'})`);

    return event;
  }

  /**
   * Retrieves recorded audit events filtered by tenant or event type.
   */
  public logAuditEvent(
    ctx: SecurityContext,
    options: {
      action: string;
      targetResource: string;
      outcome: 'ALLOWED' | 'DENIED' | 'ERROR';
      details?: Record<string, unknown>;
    }
  ): AuditEvent {
    const eventType: SecurityEventType =
      options.outcome === 'DENIED'
        ? 'AUTHORIZATION_DENIED'
        : options.action.startsWith('AI_') || options.action.startsWith('DOCUMENT_')
        ? 'SECURITY_CONFIGURATION_CHANGE'
        : 'AUTHORIZATION_ALLOWED';

    return this.logEvent(
      eventType,
      ctx.principal.id,
      options.action,
      options.targetResource,
      options.outcome,
      {
        tenantId: ctx.principal.tenantId,
        branchId: ctx.principal.branchId,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        details: options.details,
      }
    );
  }

  public logSecurityEvent(
    ctx: SecurityContext,
    options: {
      action: string;
      targetResource: string;
      outcome: 'ALLOWED' | 'DENIED' | 'ERROR';
      details?: Record<string, unknown>;
    }
  ): AuditEvent {
    return this.logAuditEvent(ctx, options);
  }

  public queryAuditLogs(
    ctx: SecurityContext,
    filter?: { tenantId?: string; action?: string; limit?: number }
  ): AuditEvent[] {
    let events = this.getEvents({ tenantId: filter?.tenantId, limit: filter?.limit || 100 });
    if (filter?.action) {
      events = events.filter((e) => e.action === filter.action);
    }
    return events;
  }

  public getEvents(filter?: { tenantId?: string; eventType?: SecurityEventType; limit?: number }): AuditEvent[] {
    let events = [...this.auditLogBuffer];
    if (filter?.tenantId) {
      events = events.filter((e) => e.tenantId === filter.tenantId);
    }
    if (filter?.eventType) {
      events = events.filter((e) => e.eventType === filter.eventType);
    }
    return events.slice(0, filter?.limit || 100);
  }

  /**
   * Convenience helper to retrieve audit events recorded for a specific tenant.
   */
  public getEventsForTenant(tenantId: string): AuditEvent[] {
    return this.getEvents({ tenantId, limit: 1000 });
  }

  /**
   * Sanitizes audit event details to ensure no secrets or passwords are stored.
   */
  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitivePatterns = ['password', 'secret', 'token', 'apikey', 'privatekey', 'creditcard', 'passkey', 'auth', 'bearer', 'cvv', 'card'];
    for (const [key, val] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();
      if (sensitivePatterns.some((pattern) => lowerKey.includes(pattern))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizeDetails(val as Record<string, unknown>);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  public clearBufferForTesting(): void {
    this.auditLogBuffer = [];
  }
}

export const auditLogger = new AuditLoggerService();
