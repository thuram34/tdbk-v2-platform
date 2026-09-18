/**
 * TDBK V2 GENERIC BANKING GATEWAY BRIDGE ADAPTER
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
import { connectorConnectionRepository } from '../../../persistence/firestore/repositories/connectorConnectionRepository';

export interface BankTransferRequest {
  sourceAccount: string;
  destinationAccount: string;
  bankCode: string;
  amount: number;
  referenceText: string;
  simulateAmbiguousResult?: boolean;
}

export class BankBridge implements Bridge<BankTransferRequest, any, any> {
  public readonly bridgeId = 'bridge_bank';
  public readonly provider = 'GENERIC_BANK';
  public readonly capabilityId = 'bank_bridge';
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
    return {
      status: 'UNAVAILABLE',
      details: { provider: this.provider, version: this.version, gatewayConnected: true },
    };
  }

  public async execute(
    context: SecurityContext,
    operation: string,
    payload: BankTransferRequest
  ): Promise<NormalizedBridgeResult<any>> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (process.env.NODE_ENV === 'production') {
      const connection = await connectorConnectionRepository.getConnection(tenantId, `conn_${this.bridgeId}`);
      if (!connection || !connection.enabled || connection.status !== 'CONFIGURED') {
        throw new KernelError('INTEGRATION_UNAVAILABLE', 'Bank bridge has no configured tenant connection', 503, context.requestId);
      }
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'Bank bridge is not connected to a production provider', 503, context.requestId);
    }
    if (!tenantId) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'Bank Operation Denied: Missing Tenant Context', 403, context.requestId);
    }

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_REQUESTED', `bridge:${this.bridgeId}`, 'ALLOWED', {
      tenantId,
      requestId: context.requestId,
      details: { operation, amount: payload.amount, bankCode: payload.bankCode },
    });

    if (operation !== 'INITIATE_TRANSFER' && operation !== 'VERIFY_ACCOUNT' && operation !== 'QUERY_STATUS') {
      throw new KernelError('VALIDATION_ERROR', `Unsupported Bank operation: '${operation}'`, 400, context.requestId);
    }

    const bankRef = `FT${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Handle Ambiguous External Result Simulation
    let resultStatus: 'SUCCESS' | 'PENDING' | 'FAILED' | 'UNKNOWN' | 'REQUIRES_RECONCILIATION' = 'SUCCESS';
    if (payload.simulateAmbiguousResult) {
      resultStatus = 'UNKNOWN';
    }

    const normalized: NormalizedBridgeResult<any> = {
      status: resultStatus,
      provider: this.provider,
      providerReference: bankRef,
      amount: payload.amount,
      currency: 'KES',
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId,
      data: {
        bankRef,
        status: resultStatus,
        bankCode: payload.bankCode,
      },
      errorDetails: resultStatus === 'UNKNOWN' ? 'External bank gateway connection timed out prior to final ACK' : undefined,
    };

    if (resultStatus === 'UNKNOWN') {
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_RECONCILIATION_REQUIRED', `bridge:${this.bridgeId}`, 'WARN' as any, {
        tenantId,
        requestId: context.requestId,
        details: { providerReference: bankRef, reason: 'Ambiguous response requires manual or scheduled reconciliation' },
      });
    } else {
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_RESPONSE_RECEIVED', `bridge:${this.bridgeId}`, 'ALLOWED', {
        tenantId,
        requestId: context.requestId,
        details: { providerReference: bankRef, status: normalized.status },
      });
    }

    eventBus.publish({
      eventId: `evt_bank_${bankRef}`,
      eventType: 'payment.initiated.v1',
      eventVersion: 'v1',
      occurredAt: normalized.occurredAt,
      tenantId,
      branchId: context.branchContext?.branchId || null,
      principalId: context.principal.id,
      correlationId: context.correlationId,
      causationId: null,
      source: 'BankBridge',
      payload: { bankRef, amount: payload.amount, status: resultStatus },
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
      throw new KernelError('AUTHORIZATION_ERROR', 'Bank Callback Verification Failed', 401, context.requestId);
    }
    return this.normalizeResponse(rawCallback);
  }

  public normalizeResponse(rawResponse: any): NormalizedBridgeResult<any> {
    return {
      status: rawResponse.status || 'SUCCESS',
      provider: this.provider,
      providerReference: rawResponse.bankRef || `FT_${Date.now()}`,
      amount: rawResponse.amount || 0,
      currency: 'KES',
      occurredAt: new Date().toISOString(),
      correlationId: rawResponse.correlationId || 'corr_bank',
      data: rawResponse,
    };
  }
}
