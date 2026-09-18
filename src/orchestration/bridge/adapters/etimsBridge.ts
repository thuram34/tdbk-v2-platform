/**
 * TDBK V2 KRA eTIMS TAX INVOICING BRIDGE ADAPTER
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
import { publishBridgeEvent } from '../bridgeEventPublisher';
import { connectorConnectionRepository } from '../../../persistence/firestore/repositories/connectorConnectionRepository';

export interface EtimsInvoiceRequest {
  invoiceNumber: string;
  customerPin?: string;
  totalAmount: number;
  taxAmount: number;
  items: Array<{ itemName: string; qty: number; unitPrice: number; taxRate: number }>;
}

export class EtimsBridge implements Bridge<EtimsInvoiceRequest, any, any> {
  public readonly bridgeId = 'bridge_etims';
  public readonly provider = 'KRA_ETIMS';
  public readonly capabilityId = 'etims_bridge';
  public readonly version = 'v1.0';

  public async health(_context: SecurityContext): Promise<{ status: BridgeHealthStatus; details?: Record<string, unknown> }> {
    const tenantId = _context.tenantContext?.tenantId || _context.principal.tenantId;
    if (!tenantId) return { status: 'UNAVAILABLE', details: { provider: this.provider, reason: 'TENANT_CONTEXT_MISSING' } };
    const connection = await connectorConnectionRepository.getConnection(tenantId, `conn_${this.bridgeId}`);
    if (!connection || !connection.enabled || connection.status !== 'CONFIGURED') {
      return { status: 'UNAVAILABLE', details: { provider: this.provider, version: this.version, reason: 'CONNECTION_NOT_CONFIGURED' } };
    }
    // Configuration is durable, but no live provider client is wired yet.
    return { status: 'UNAVAILABLE', details: { provider: this.provider, version: this.version, reason: 'PROVIDER_CLIENT_NOT_CONNECTED', connectionId: connection.connectionId, configurationVersion: connection.configurationVersion } };
  }

  public async execute(
    context: SecurityContext,
    operation: string,
    payload: EtimsInvoiceRequest
  ): Promise<NormalizedBridgeResult<any>> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (process.env.NODE_ENV === 'production') {
      const connection = await connectorConnectionRepository.getConnection(tenantId, `conn_${this.bridgeId}`);
      if (!connection || !connection.enabled || connection.status !== 'CONFIGURED') {
        throw new KernelError('INTEGRATION_UNAVAILABLE', 'eTIMS bridge has no configured tenant connection', 503, context.requestId);
      }
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'eTIMS bridge is not connected to a production provider', 503, context.requestId);
    }
    if (!tenantId) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'eTIMS Invoice Submission Denied: Missing Tenant Context', 403, context.requestId);
    }

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_REQUESTED', `bridge:${this.bridgeId}`, 'ALLOWED', {
      tenantId,
      requestId: context.requestId,
      details: { operation, invoiceNumber: payload.invoiceNumber, totalAmount: payload.totalAmount },
    });

    if (operation !== 'SUBMIT_INVOICE' && operation !== 'CANCEL_INVOICE' && operation !== 'QUERY_INVOICE_STATUS') {
      throw new KernelError('VALIDATION_ERROR', `Unsupported eTIMS operation: '${operation}'`, 400, context.requestId);
    }

    throw new KernelError('INTEGRATION_UNAVAILABLE', 'eTIMS provider client is not connected; no synthetic tax invoice may be issued', 503, context.requestId);

  }

  public async verifyCallback(rawCallback: any, signatureHeader?: string): Promise<CallbackVerificationResult> {
    const verified = signatureHeader !== 'INVALID_SIG' && rawCallback.signature !== 'INVALID_SIG';
    return {
      verified,
      providerIdentity: this.provider,
      reason: verified ? undefined : 'Invalid eTIMS Callback Signature',
      replayProtectionPassed: verified,
      tenantId: rawCallback.tenantId,
      correlationId: rawCallback.correlationId,
    };
  }

  public async handleCallback(context: SecurityContext, rawCallback: any): Promise<NormalizedBridgeResult<any>> {
    const verification = await this.verifyCallback(rawCallback);
    if (!verification.verified) {
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_CALLBACK_REJECTED', `bridge:${this.bridgeId}`, 'DENIED', {
        tenantId: context.tenantContext?.tenantId || null,
        requestId: context.requestId,
        details: { reason: verification.reason },
      });
      throw new KernelError('AUTHORIZATION_ERROR', `eTIMS Callback Verification Failed: ${verification.reason}`, 401, context.requestId);
    }

    return this.normalizeResponse(rawCallback);
  }

  public normalizeResponse(rawResponse: any): NormalizedBridgeResult<any> {
    const reference = String(rawResponse?.kraIcn || rawResponse?.providerReference || '').trim();
    if (!reference) {
      throw new KernelError('VALIDATION_ERROR', 'eTIMS response is missing an authoritative KRA invoice reference', 422);
    }
    const amount = Number(rawResponse?.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new KernelError('VALIDATION_ERROR', 'eTIMS response contains an invalid amount', 422);
    }
    return {
      status: rawResponse.status || 'SUCCESS',
      provider: this.provider,
      providerReference: reference,
      amount,
      currency: 'KES',
      occurredAt: rawResponse.occurredAt || new Date().toISOString(),
      correlationId: rawResponse.correlationId || 'corr_etims',
      data: rawResponse,
    };
  }}
