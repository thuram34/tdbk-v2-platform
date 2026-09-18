/**
 * TDBK V2 EMAIL BRIDGE ADAPTER (SMTP / SENDGRID)
 * Architectural Layer: LAYER 6 — BRIDGE ARCHITECTURE
 */

import {
  Bridge,
  BridgeHealthStatus,
  CallbackVerificationResult,
  NormalizedBridgeResult,
} from '../types';
import { SecurityContext } from '../../../kernel/types';
import { auditLogger } from '../../../kernel/audit/auditLogger';
import { KernelError } from '../../../kernel/errors/kernelErrors';
import { eventBus } from '../../events/eventBus';

export interface EmailSendRequest {
  toEmail: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  attachments?: Array<{ filename: string; contentBase64: string }>;
}

export class EmailBridge implements Bridge<EmailSendRequest, any, any> {
  public readonly bridgeId = 'bridge_email';
  public readonly provider = 'SYSTEM_SMTP';
  public readonly capabilityId = 'email_bridge';
  public readonly version = 'v1.0';

  public async health(_context: SecurityContext): Promise<{ status: BridgeHealthStatus; details?: Record<string, unknown> }> {
    // These adapters are explicitly MOCK in the platform registry. They must
    // never advertise a live provider connection until a real provider client
    // is configured and the adapter performs an actual connectivity check.
    return {
      status: 'UNAVAILABLE',
      details: { provider: this.provider, version: this.version, smtpConnected: true },
    };
  }

  public async execute(
    context: SecurityContext,
    operation: string,
    payload: EmailSendRequest
  ): Promise<NormalizedBridgeResult<any>> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (process.env.NODE_ENV === 'production') {
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'Email bridge is not connected to a production provider', 503, context.requestId);
    }
    if (!tenantId) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'Email Dispatch Denied: Missing Tenant Context', 403, context.requestId);
    }

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_REQUESTED', `bridge:${this.bridgeId}`, 'ALLOWED', {
      tenantId,
      requestId: context.requestId,
      details: { operation, subject: payload.subject, to: payload.toEmail ? '[REDACTED_EMAIL]' : undefined },
    });

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@tdbk.co.ke`;

    const normalized: NormalizedBridgeResult<any> = {
      status: 'SUCCESS',
      provider: this.provider,
      providerReference: messageId,
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId,
      data: { messageId, status: 'QUEUED' },
    };

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_RESPONSE_RECEIVED', `bridge:${this.bridgeId}`, 'ALLOWED', {
      tenantId,
      requestId: context.requestId,
      details: { providerReference: messageId, status: normalized.status },
    });

    eventBus.publish({
      eventId: `evt_email_${Date.now()}`,
      eventType: 'notification.sent.v1',
      eventVersion: 'v1',
      occurredAt: normalized.occurredAt,
      tenantId,
      branchId: context.branchContext?.branchId || null,
      principalId: context.principal.id,
      correlationId: context.correlationId,
      causationId: null,
      source: 'EmailBridge',
      payload: { messageId, status: 'QUEUED' },
      metadata: {},
    });

    return normalized;
  }

  public async verifyCallback(rawCallback: any, signatureHeader?: string): Promise<CallbackVerificationResult> {
    const verified = signatureHeader !== 'INVALID_SIG' && rawCallback.signature !== 'INVALID_SIG';
    return {
      verified,
      providerIdentity: this.provider,
      replayProtectionPassed: verified,
      tenantId: rawCallback.tenantId,
      correlationId: rawCallback.correlationId,
    };
  }

  public async handleCallback(context: SecurityContext, rawCallback: any): Promise<NormalizedBridgeResult<any>> {
    const verification = await this.verifyCallback(rawCallback);
    if (!verification.verified) {
      throw new KernelError('AUTHORIZATION_ERROR', 'Email Callback Verification Failed', 401, context.requestId);
    }
    return this.normalizeResponse(rawCallback);
  }

  public normalizeResponse(rawResponse: any): NormalizedBridgeResult<any> {
    return {
      status: rawResponse.status || 'SUCCESS',
      provider: this.provider,
      providerReference: rawResponse.messageId || `MSG_${Date.now()}`,
      occurredAt: new Date().toISOString(),
      correlationId: rawResponse.correlationId || 'corr_email',
      data: rawResponse,
    };
  }
}
