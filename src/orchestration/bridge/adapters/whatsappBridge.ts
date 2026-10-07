/**
 * TDBK V2 META WHATSAPP CLOUD API BRIDGE ADAPTER
 * Architectural Layer: LAYER 6 — BRIDGE ARCHITECTURE
 *
 * Meta WhatsApp Business Platform / Cloud API transport.
 * Provider authentication and webhook authenticity are handled here;
 * tenant routing remains authoritative in TDBK context/connection state.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Bridge,
  BridgeHealthStatus,
  CallbackVerificationResult,
  NormalizedBridgeResult,
} from '../types';
import { SecurityContext } from '../../../kernel/types';
import { auditLogger } from '../../../kernel/audit/auditLogger';
import { KernelError } from '../../../kernel/errors/kernelErrors';
import { publishBridgeEvent } from '../bridgeEventPublisher';
import { connectorConnectionRepository } from '../../../persistence/firestore/repositories/connectorConnectionRepository';
import { resolveConnectorSecret } from '../connectorSecretResolver';
import { claimExternalOperation, completeExternalOperation, failExternalOperation } from '../externalOperationGuard';

export interface WhatsappMessageRequest {
  recipientPhone: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: Record<string, string>;
  messageText?: string;
  previewUrl?: boolean;
  /** Stable caller-controlled identity for a mutating outbound operation. */
  idempotencyKey?: string;
}

export interface WhatsappWebhook {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: any;
    }>;
  }>;
  rawBody?: string;
  headers?: Record<string, string | undefined>;
  tenantId?: string;
  correlationId?: string;
  signature?: string;
}

type WhatsappConnection = {
  connectionId: string;
  enabled: boolean;
  status: string;
  parameters: Record<string, string>;
  secretRefs: Record<string, { name: string; provider: 'GCP_SECRET_MANAGER' | 'CLOUD_RUN_ENV' }>;
  configurationVersion?: number;
};

export class WhatsappBridge implements Bridge<WhatsappMessageRequest, any, WhatsappWebhook> {
  public readonly bridgeId = 'bridge_whatsapp';
  public readonly provider = 'META_WHATSAPP';
  public readonly capabilityId = 'whatsapp_automation';
  public readonly version = 'v2.0';
  public readonly sideEffectCapabilities = { providerIdempotency: false, providerReconciliation: false };

  private parameter(connection: WhatsappConnection, ...names: string[]): string | undefined {
    for (const name of names) {
      const value = connection.parameters[name] || connection.parameters[name.toLowerCase()];
      if (value) return value;
    }
    return undefined;
  }

  private async secret(connection: WhatsappConnection, ...names: string[]): Promise<string | undefined> {
    for (const name of names) {
      const ref = connection.secretRefs[name] || connection.secretRefs[name.toLowerCase()];
      if (ref) return resolveConnectorSecret(ref);
    }
    return undefined;
  }

  private async connection(tenantId: string): Promise<WhatsappConnection> {
    if (!tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'WhatsApp operation denied: missing tenant context', 403);
    const connection = await connectorConnectionRepository.getConnection(tenantId, `conn_${this.bridgeId}`) as WhatsappConnection | null;
    if (!connection || !connection.enabled || connection.status !== 'CONFIGURED') {
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'WhatsApp bridge has no configured tenant connection', 503);
    }
    return connection;
  }

  private async graphRequest(connection: WhatsappConnection, path: string, method: string, body?: unknown): Promise<any> {
    const version = this.parameter(connection, 'WHATSAPP_GRAPH_VERSION', 'graphVersion') || 'v26.0';
    const token = await this.secret(connection, 'WHATSAPP_ACCESS_TOKEN', 'accessToken');
    if (!token) throw new KernelError('INTEGRATION_UNAVAILABLE', 'WhatsApp access token is not configured', 503);

    const response = await fetch(`https://graph.facebook.com/${version}/${path.replace(/^\//, '')}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      throw new Error(`Meta WhatsApp API ${method} /${path} failed (${response.status}): ${data?.error?.message || 'provider error'}`);
    }
    return data;
  }

  private normalizePhone(phone: string): string {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) throw new KernelError('VALIDATION_ERROR', 'WhatsApp recipient phone is required', 400);
    if (digits.startsWith('00')) return digits.substring(2);
    if (digits.startsWith('0')) return `254${digits.substring(1)}`;
    if (digits.startsWith('+')) return digits.substring(1);
    return digits;
  }

  public async health(context: SecurityContext): Promise<{ status: BridgeHealthStatus; details?: Record<string, unknown> }> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    try {
      const connection = await this.connection(tenantId);
      const phoneNumberId = this.parameter(connection, 'WHATSAPP_PHONE_NUMBER_ID', 'phoneNumberId');
      const wabaId = this.parameter(connection, 'WHATSAPP_WABA_ID', 'wabaId');
      if (!phoneNumberId || !wabaId) {
        return { status: 'UNAVAILABLE', details: { provider: this.provider, reason: 'WHATSAPP_CONFIGURATION_INCOMPLETE' } };
      }
      const data = await this.graphRequest(connection, phoneNumberId, 'GET');
      return {
        status: 'HEALTHY',
        details: {
          provider: this.provider,
          connectionId: connection.connectionId,
          phoneNumberId,
          wabaId,
          verifiedName: data?.verified_name,
          displayPhoneNumber: data?.display_phone_number,
          qualityRating: data?.quality_rating,
        },
      };
    } catch (error: any) {
      return { status: 'UNAVAILABLE', details: { provider: this.provider, reason: error?.message || 'PROVIDER_UNAVAILABLE' } };
    }
  }

  public async execute(context: SecurityContext, operation: string, payload: WhatsappMessageRequest): Promise<NormalizedBridgeResult<any>> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'WhatsApp operation denied: missing tenant context', 403, context.requestId);
    const isTestRuntime = process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || process.env.TDBK_PERSISTENCE_DRIVER === 'test_memory');
    if (isTestRuntime) {
      return { status: 'SUCCESS', provider: this.provider, providerReference: `wamid.test_${context.requestId}`, occurredAt: new Date().toISOString(), correlationId: context.correlationId || context.requestId, data: { testRuntime: true, operation } };
    }
    const connection = await this.connection(tenantId);
    if (!['SEND_TEMPLATE', 'SEND_TEXT', 'VERIFY_DELIVERY', 'SUBSCRIBE_WABA'].includes(operation)) {
      throw new KernelError('VALIDATION_ERROR', `Unsupported WhatsApp operation: '${operation}'`, 400, context.requestId);
    }

    const phoneNumberId = this.parameter(connection, 'WHATSAPP_PHONE_NUMBER_ID', 'phoneNumberId');
    const wabaId = this.parameter(connection, 'WHATSAPP_WABA_ID', 'wabaId');
    if (!phoneNumberId && operation !== 'SUBSCRIBE_WABA') throw new KernelError('INTEGRATION_UNAVAILABLE', 'WhatsApp phone number ID is not configured', 503, context.requestId);

    let externalOperationKey: string | null = null;
    let externalClaim: Awaited<ReturnType<typeof claimExternalOperation>> | null = null;
    if (process.env.NODE_ENV === 'production' && operation !== 'VERIFY_DELIVERY') {
      const stableIdentity = operation === 'SUBSCRIBE_WABA'
        ? (wabaId ? 'waba:' + wabaId : undefined)
        : payload.idempotencyKey;
      if (!stableIdentity) {
        throw new KernelError('VALIDATION_ERROR', "WhatsApp operation '" + operation + "' requires a stable idempotencyKey.", 400, context.requestId);
      }
      externalOperationKey = 'whatsapp:' + operation + ':' + stableIdentity;
      externalClaim = await claimExternalOperation(
        tenantId,
        externalOperationKey,
        'WHATSAPP_' + operation,
        { operation, payload: operation === 'SUBSCRIBE_WABA' ? { wabaId } : payload },
      );
      if (externalClaim.state === 'COMPLETED') return externalClaim.response as unknown as NormalizedBridgeResult<any>;
      if (externalClaim.state === 'IN_PROGRESS') {
        return {
          status: 'REQUIRES_RECONCILIATION',
          provider: this.provider,
          providerReference: externalOperationKey,
          occurredAt: new Date().toISOString(),
          correlationId: context.correlationId || context.requestId,
          data: { reason: 'An earlier WhatsApp provider call is unresolved; blind replay is blocked.' },
        };
      }
    }

    if (operation === 'SUBSCRIBE_WABA') {
      if (!wabaId) throw new KernelError('INTEGRATION_UNAVAILABLE', 'WhatsApp WABA ID is not configured', 503, context.requestId);
      const providerResponse = await this.graphRequest(connection, wabaId + '/subscribed_apps', 'POST');
      const result: NormalizedBridgeResult<any> = {
        status: providerResponse?.success === true || providerResponse?.success === 'true' ? 'SUCCESS' : 'FAILED',
        provider: this.provider,
        providerReference: wabaId,
        occurredAt: new Date().toISOString(),
        correlationId: context.correlationId || context.requestId,
        data: providerResponse,
      };
      if (externalOperationKey && externalClaim?.state === 'CLAIMED') {
        await completeExternalOperation(tenantId, externalOperationKey, result as unknown as Record<string, unknown>);
      }
      return result;
    }
    const recipient = this.normalizePhone(payload.recipientPhone);

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_REQUESTED', `bridge:${this.bridgeId}`, 'ALLOWED', {
      tenantId, requestId: context.requestId,
      details: { operation, phone: '[REDACTED_PHONE]', template: payload.templateName },
    });

    if (operation === 'VERIFY_DELIVERY') {
      if (!payload.templateName) throw new KernelError('VALIDATION_ERROR', 'VERIFY_DELIVERY requires a provider message ID in templateName', 400, context.requestId);
      const data = await this.graphRequest(connection, payload.templateName, 'GET');
      return {
        status: data?.status === 'failed' ? 'FAILED' : 'SUCCESS',
        provider: this.provider,
        providerReference: payload.templateName,
        occurredAt: new Date().toISOString(),
        correlationId: context.correlationId || context.requestId,
        data,
      };
    }

    let body: Record<string, unknown>;
    if (operation === 'SEND_TEMPLATE') {
      if (!payload.templateName) throw new KernelError('VALIDATION_ERROR', 'SEND_TEMPLATE requires templateName', 400, context.requestId);
      const parameters = Object.values(payload.templateParams || {}).map((text) => ({ type: 'text', text }));
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: payload.templateName,
          language: { code: payload.templateLanguage || this.parameter(connection, 'WHATSAPP_TEMPLATE_LANGUAGE', 'templateLanguage') || 'en_US' },
          ...(parameters.length ? { components: [{ type: 'body', parameters }] } : {}),
        },
      };
    } else {
      if (!payload.messageText) throw new KernelError('VALIDATION_ERROR', 'SEND_TEXT requires messageText', 400, context.requestId);
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { preview_url: payload.previewUrl ?? false, body: payload.messageText },
      };
    }

    const providerResponse = await this.graphRequest(connection, phoneNumberId + '/messages', 'POST', body);
    const wamid = String(providerResponse?.messages?.[0]?.id || '');
    if (!wamid) throw new KernelError('INTEGRATION_UNAVAILABLE', 'Meta accepted no message ID; response is not actionable', 502, context.requestId);

    const occurredAt = new Date().toISOString();
    await publishBridgeEvent({
      eventId: 'evt_wa_' + wamid,
      eventType: 'notification.sent.v1',
      eventVersion: 'v1',
      occurredAt,
      tenantId,
      branchId: context.branchContext?.branchId || null,
      principalId: context.principal.id,
      correlationId: context.correlationId || context.requestId,
      causationId: context.requestId,
      source: 'WhatsappBridge',
      payload: { wamid, status: 'ACCEPTED' },
      metadata: {},
    });

    const result: NormalizedBridgeResult<any> = {
      status: 'SUCCESS',
      provider: this.provider,
      providerReference: wamid,
      occurredAt,
      correlationId: context.correlationId || context.requestId,
      data: { ...providerResponse, messagingProduct: 'whatsapp' },
    };
    if (externalOperationKey && externalClaim?.state === 'CLAIMED') {
      await completeExternalOperation(tenantId, externalOperationKey, result as unknown as Record<string, unknown>);
    }
    return result;
  }

  /**
   * Meta's one-time webhook verification handshake.
   * This is intentionally separate from POST webhook HMAC verification.
   */
  public verifyWebhookChallenge(mode: string | undefined, verifyToken: string | undefined, challenge: string | undefined, configuredToken: string): string {
    if (mode !== 'subscribe' || !verifyToken || verifyToken !== configuredToken || !challenge) {
      throw new KernelError('AUTHORIZATION_ERROR', 'WhatsApp Meta webhook verification failed', 403);
    }
    return challenge;
  }

  public async verifyCallback(rawCallback: WhatsappWebhook, signatureHeader?: string): Promise<CallbackVerificationResult> {
    const signature = signatureHeader || rawCallback.headers?.['x-hub-signature-256'] || rawCallback.headers?.['X-Hub-Signature-256'];
    const rawBody = rawCallback.rawBody;
    if (!signature || !rawBody) {
      return { verified: false, providerIdentity: this.provider, reason: 'Missing Meta webhook signature or raw body', replayProtectionPassed: false };
    }

    // The provider app secret is tenant-scoped and cannot be resolved safely from an
    // untrusted webhook payload. The authoritative cryptographic verification therefore
    // happens in handleCallback() after the trusted tenant connection is selected.
    // Never report an unverified callback as authenticated at this interface boundary.
    return {
      verified: false,
      providerIdentity: this.provider,
      reason: 'Tenant-scoped Meta HMAC verification requires trusted connection context',
      replayProtectionPassed: false,
      tenantId: rawCallback.tenantId,
      correlationId: rawCallback.correlationId,
    };
  }

  public verifyMetaSignature(rawBody: string, signatureHeader: string, appSecret: string): boolean {
    const supplied = String(signatureHeader || '').replace(/^sha256=/, '');
    if (!/^[0-9a-f]{64}$/i.test(supplied)) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
  }

  public async handleCallback(context: SecurityContext, rawCallback: WhatsappWebhook): Promise<NormalizedBridgeResult<any>> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    const connection = await this.connection(tenantId);
    const appSecret = await this.secret(connection, 'WHATSAPP_APP_SECRET', 'appSecret');
    if (!appSecret) throw new KernelError('INTEGRATION_UNAVAILABLE', 'WhatsApp app secret is not configured', 503, context.requestId);

    const signature = rawCallback.headers?.['x-hub-signature-256'] || rawCallback.headers?.['X-Hub-Signature-256'] || rawCallback.signature;
    if (!rawCallback.rawBody || !signature || !this.verifyMetaSignature(rawCallback.rawBody, signature, appSecret)) {
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_CALLBACK_REJECTED', `bridge:${this.bridgeId}`, 'DENIED', {
        tenantId, requestId: context.requestId, details: { reason: 'META_HMAC_SIGNATURE_INVALID' },
      });
      throw new KernelError('AUTHORIZATION_ERROR', 'WhatsApp Meta webhook signature verification failed', 401, context.requestId);
    }

    const value = rawCallback.entry?.[0]?.changes?.[0]?.value;
    if (!value) throw new KernelError('VALIDATION_ERROR', 'Malformed WhatsApp Meta webhook payload', 400, context.requestId);
    const configuredPhoneId = this.parameter(connection, 'WHATSAPP_PHONE_NUMBER_ID', 'phoneNumberId');
    if (value.metadata?.phone_number_id && value.metadata.phone_number_id !== configuredPhoneId) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'WhatsApp webhook phone number does not belong to this tenant connection', 403, context.requestId);
    }

    const message = value.messages?.[0];
    const status = value.statuses?.[0];
    const occurredAt = new Date(Number((message || status)?.timestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString();

    if (status) {
      const providerReference = String(status.id || '');
      if (!providerReference) throw new KernelError('VALIDATION_ERROR', 'WhatsApp status event has no message ID', 400, context.requestId);
      return {
        status: status.status === 'failed' ? 'FAILED' : 'SUCCESS',
        provider: this.provider,
        providerReference,
        occurredAt,
        correlationId: context.correlationId || context.requestId,
        data: { eventType: 'MESSAGE_STATUS', status: status.status, recipientId: status.recipient_id, errors: status.errors || [] },
      };
    }

    if (!message) {
      return {
        status: 'SUCCESS',
        provider: this.provider,
        providerReference: `webhook_${Date.now()}`,
        occurredAt,
        correlationId: context.correlationId || context.requestId,
        data: { eventType: 'NON_MESSAGE_EVENT', value },
      };
    }

    const providerReference = String(message.id || '');
    if (!providerReference) throw new KernelError('VALIDATION_ERROR', 'WhatsApp message event has no message ID', 400, context.requestId);

    const inboundKey = 'whatsapp:webhook:' + providerReference;
    const inboundClaim = await claimExternalOperation(
      tenantId,
      inboundKey,
      'WHATSAPP_INBOUND_WEBHOOK',
      rawCallback.rawBody,
    );
    if (inboundClaim.state === 'COMPLETED' || inboundClaim.state === 'IN_PROGRESS') {
      return {
        status: 'SUCCESS',
        provider: this.provider,
        providerReference,
        occurredAt,
        correlationId: context.correlationId || context.requestId,
        data: { eventType: 'MESSAGE_RECEIVED_DUPLICATE_SUPPRESSED' },
      };
    }

    try {
      await publishBridgeEvent({
        eventId: 'evt_wa_in_' + providerReference,
        eventType: 'notification.received.v1',
        eventVersion: 'v1',
        occurredAt,
        tenantId,
        branchId: context.branchContext?.branchId || null,
        principalId: context.principal.id,
        correlationId: context.correlationId || context.requestId,
        causationId: providerReference,
        source: 'WhatsappBridge',
        payload: {
          wamid: providerReference,
          from: message.from,
          type: message.type,
          text: message.text?.body || null,
          message,
          contacts: value.contacts || [],
        },
        metadata: { phoneNumberId: value.metadata?.phone_number_id, displayPhoneNumber: value.metadata?.display_phone_number },
      });
      await completeExternalOperation(tenantId, inboundKey, {
        status: 'SUCCESS',
        provider: this.provider,
        providerReference,
        occurredAt,
        correlationId: context.correlationId || context.requestId,
      });
    } catch (error) {
      await failExternalOperation(tenantId, inboundKey, error instanceof Error ? error.message : 'Inbound webhook publication failed').catch(() => undefined);
      throw error;
    }
    return {
      status: 'SUCCESS',
      provider: this.provider,
      providerReference,
      occurredAt,
      correlationId: context.correlationId || context.requestId,
      data: {
        eventType: 'MESSAGE_RECEIVED',
        from: message.from,
        type: message.type,
        message,
        contacts: value.contacts || [],
      },
    };
  }

  public normalizeResponse(rawResponse: any): NormalizedBridgeResult<any> {
    const providerReference = String(rawResponse?.messages?.[0]?.id || rawResponse?.wamid || rawResponse?.statuses?.[0]?.id || '').trim();
    if (!providerReference) throw new KernelError('VALIDATION_ERROR', 'WhatsApp response is missing an authoritative message ID', 422);
    return {
      status: rawResponse?.statuses?.[0]?.status === 'failed' ? 'FAILED' : 'SUCCESS',
      provider: this.provider,
      providerReference,
      occurredAt: rawResponse?.occurredAt || new Date().toISOString(),
      correlationId: rawResponse?.correlationId || 'corr_whatsapp',
      data: rawResponse,
    };
  }
}

export const whatsappBridge = new WhatsappBridge();
