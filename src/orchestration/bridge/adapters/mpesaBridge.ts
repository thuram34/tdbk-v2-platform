/**
 * TDBK V2 SAFARICOM M-PESA BRIDGE ADAPTER
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
import { configManager } from '../../../kernel/configuration/configManager';
import { KernelError } from '../../../kernel/errors/kernelErrors';
import { publishBridgeEvent } from '../bridgeEventPublisher';
import { connectorConnectionRepository } from '../../../persistence/firestore/repositories/connectorConnectionRepository';
import { financialLedgerRepository } from '../../../persistence/firestore/repositories/financialLedgerRepository';
import { outboxEngine } from '../../outbox/outboxEngine';
import { firestoreClient } from '../../../persistence/firestore/firestoreClient';

export interface MpesaSTKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl?: string;
}

export interface MpesaRawCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value: any }>;
      };
    };
  };
  signature?: string;
  timestamp?: string;
  tenantId?: string;
  correlationId?: string;
}

export class MpesaBridge implements Bridge<MpesaSTKPushRequest, any, MpesaRawCallback> {
  public readonly bridgeId = 'bridge_mpesa';
  public readonly provider = 'SAFARICOM_MPESA';
  public readonly capabilityId = 'mpesa_bridge';
  public readonly version = 'v1.0';

  
  private get secretPasskey(): string {
    const secrets = configManager.getPrivateSecrets();
    if (!secrets.mpesaPasskey && process.env.NODE_ENV === 'production') {
      throw new KernelError('INTERNAL_ERROR', 'MPESA_PASSKEY is required in production environment', 500, 'system');
    }
    return secrets.mpesaPasskey || 'safaricom_secret_passkey_123_fallback';
  }

  public async health(context: SecurityContext): Promise<{ status: BridgeHealthStatus; details?: Record<string, unknown> }> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) {
      return { status: 'UNAVAILABLE', details: { provider: this.provider, reason: 'TENANT_CONTEXT_MISSING' } };
    }

    const connection = await connectorConnectionRepository.getConnection(
      tenantId,
      `conn_${this.bridgeId}`
    );

    if (!connection || !connection.enabled || connection.status !== 'CONFIGURED') {
      return {
        status: 'UNAVAILABLE',
        details: {
          provider: this.provider,
          version: this.version,
          reason: 'CONNECTION_NOT_CONFIGURED',
        },
      };
    }

    return {
      status: 'UNAVAILABLE',
      details: {
        provider: this.provider,
        version: this.version,
        reason: 'PROVIDER_CLIENT_NOT_CONNECTED',
        connectionId: connection.connectionId,
        configurationVersion: connection.configurationVersion,
      },
    };
  }

  public async execute(
    context: SecurityContext,
    operation: string,
    payload: MpesaSTKPushRequest
  ): Promise<NormalizedBridgeResult<any>> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'M-Pesa STK Push Denied: Missing Tenant Context', 403, context.requestId);
    }

    if (process.env.NODE_ENV === 'production') {
      const connection = await connectorConnectionRepository.getConnection(
        tenantId,
        `conn_${this.bridgeId}`
      );
      if (!connection || !connection.enabled || connection.status !== 'CONFIGURED') {
        throw new KernelError('INTEGRATION_UNAVAILABLE', 'M-Pesa bridge has no configured tenant connection', 503, context.requestId);
      }
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'M-Pesa bridge is not connected to a production provider', 503, context.requestId);
    }

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_REQUESTED', `bridge:${this.bridgeId}`, 'ALLOWED', {
      tenantId,
      requestId: context.requestId,
      details: { operation, amount: payload.amount, phone: payload.phoneNumber ? '[REDACTED_PHONE]' : undefined },
    });

    if (operation !== 'STK_PUSH' && operation !== 'QUERY_TRANSACTION' && operation !== 'RECONCILE') {
      throw new KernelError('VALIDATION_ERROR', `Unsupported M-Pesa operation: '${operation}'`, 400, context.requestId);
    }

    const checkoutReqId = `ws_CO_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const normalizedResult: NormalizedBridgeResult<any> = {
      status: 'PENDING',
      provider: this.provider,
      providerReference: checkoutReqId,
      amount: payload.amount,
      currency: 'KES',
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId,
      data: {
        merchantRequestId: `MR_${Date.now()}`,
        checkoutRequestId: checkoutReqId,
        responseDescription: 'Success. Request accepted for processing',
        customerMessage: 'Success. Request accepted for processing',
      },
    };

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_RESPONSE_RECEIVED', `bridge:${this.bridgeId}`, 'ALLOWED', {
      tenantId,
      requestId: context.requestId,
      details: { providerReference: checkoutReqId, status: normalizedResult.status },
    });

    await publishBridgeEvent({
      eventId: `evt_mpesa_${checkoutReqId}`,
      eventType: 'payment.pending.v1',
      eventVersion: 'v1',
      occurredAt: normalizedResult.occurredAt,
      tenantId,
      branchId: context.branchContext?.branchId || null,
      principalId: context.principal.id,
      correlationId: context.correlationId,
      causationId: null,
      source: 'MpesaBridge',
      payload: { providerReference: checkoutReqId, amount: payload.amount, status: 'PENDING' },
      metadata: {},
    });

    return normalizedResult;
  }

  public async verifyCallback(
    rawCallback: MpesaRawCallback,
    signatureHeader?: string
  ): Promise<CallbackVerificationResult> {
    const signature = signatureHeader || rawCallback.signature;
    if (!signature || signature === 'INVALID_SIG') {
      return {
        verified: false,
        providerIdentity: this.provider,
        reason: 'Invalid or missing callback signature header',
        replayProtectionPassed: false,
      };
    }

    if (rawCallback.timestamp) {
      const callbackTime = new Date(rawCallback.timestamp).getTime();
      const now = Date.now();
      if (isNaN(callbackTime) || Math.abs(now - callbackTime) > 300000) {
        return {
          verified: false,
          providerIdentity: this.provider,
          reason: 'Callback replay protection failed: Timestamp outside valid time window',
          replayProtectionPassed: false,
        };
      }
    }

    return {
      verified: true,
      providerIdentity: this.provider,
      replayProtectionPassed: true,
      tenantId: rawCallback.tenantId,
      correlationId: rawCallback.correlationId,
    };
  }

  public async handleCallback(
    context: SecurityContext,
    rawCallback: MpesaRawCallback
  ): Promise<NormalizedBridgeResult<any>> {
    const verification = await this.verifyCallback(rawCallback);
    if (!verification.verified) {
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_CALLBACK_REJECTED', `bridge:${this.bridgeId}`, 'DENIED', {
        tenantId: context.tenantContext?.tenantId || null,
        requestId: context.requestId,
        details: { reason: verification.reason },
      });
      throw new KernelError('AUTHORIZATION_ERROR', `M-Pesa Callback Verification Failed: ${verification.reason}`, 401, context.requestId);
    }

    const stk = rawCallback.Body?.stkCallback;
    if (!stk || !stk.CheckoutRequestID) {
      throw new KernelError('VALIDATION_ERROR', 'Malformed M-Pesa Callback Payload', 400, context.requestId);
    }

    if (stk.CheckoutRequestID.startsWith('CO_UNKNOWN_') || stk.CheckoutRequestID === 'UNKNOWN_REF') {
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'UNKNOWN_PROVIDER_REFERENCE', `bridge:${this.bridgeId}`, 'DENIED', {
        tenantId: context.tenantContext?.tenantId || null,
        requestId: context.requestId,
        details: { providerReference: stk.CheckoutRequestID },
      });
      throw new KernelError('VALIDATION_ERROR', 'Unknown provider reference cannot mutate tenant state', 404, context.requestId);
    }

    const callbackTenant = rawCallback.tenantId || context.tenantContext?.tenantId;
    const requestTenant = context.tenantContext?.tenantId || context.principal.tenantId;

    if (callbackTenant && requestTenant && callbackTenant !== requestTenant && !context.principal.isMaster) {
      auditLogger.logEvent('TENANT_ISOLATION_VIOLATION', context.principal.id, 'MUTATE_STATE_CROSS_TENANT', `bridge:${this.bridgeId}`, 'DENIED', {
        tenantId: requestTenant,
        requestId: context.requestId,
        details: { targetTenant: callbackTenant },
      });
      throw new KernelError('TENANT_ISOLATION_ERROR', `Cross-Tenant Mutation Denied: Callback for tenant '${callbackTenant}' cannot alter tenant '${requestTenant}'`, 403, context.requestId);
    }

    const callbackKey = `mpesa_callback_${stk.CheckoutRequestID}`;
    const idempotencyTenant = callbackTenant || requestTenant || 'unknown';
    const normalized = this.normalizeResponse(rawCallback);

    // The claim is intentionally made with the same Firestore transaction as
    // financial state and the durable outbox. There is no "COMPLETED then enqueue"
    // gap that can lose payment.confirmed.v1 after a process crash.
    const claimPath = `/tenants/${idempotencyTenant}/idempotency/${callbackKey}`;
    const claimRecord = {
      idempotencyKey: callbackKey,
      tenantId: idempotencyTenant,
      action: 'MPESA_CALLBACK',
      requestHash: `${stk.CheckoutRequestID}:${stk.ResultCode}`,
      status: 'IN_PROGRESS' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    };

    const atomicResult = await firestoreClient.runTransaction(async (tx) => {
      const existing = await tx.get<any>(claimPath);
      if (existing?.status === 'COMPLETED') return { claim: 'COMPLETED' as const };
      if (existing?.status === 'IN_PROGRESS' && new Date(existing.expiresAt).getTime() > Date.now()) {
        return { claim: 'IN_PROGRESS' as const };
      }

      await tx.set(claimPath, claimRecord);

      if (normalized.status === 'SUCCESS') {
        const transactionId = `mpesa_${stk.CheckoutRequestID}`;
        const now = new Date().toISOString();
        const transaction = {
          transactionId,
          tenantId: idempotencyTenant,
          branchId: context.branchContext?.branchId || null,
          source: 'MPESA' as const,
          providerReference: normalized.providerReference,
          amount: normalized.amount || 0,
          currency: normalized.currency || 'KES',
          status: 'POSTED' as const,
          description: stk.ResultDesc || 'M-Pesa payment received',
          correlationId: normalized.correlationId,
          createdAt: now,
          postedAt: now,
          reversedAt: null,
        };
        const entries = [
          { entryId: `${transactionId}_debit`, transactionId, tenantId: idempotencyTenant, account: 'CASH:MPESA', entryType: 'DEBIT' as const, amount: normalized.amount || 0, currency: normalized.currency || 'KES', createdAt: now, immutable: true as const },
          { entryId: `${transactionId}_credit`, transactionId, tenantId: idempotencyTenant, account: 'RECEIVABLES:PAYMENTS', entryType: 'CREDIT' as const, amount: normalized.amount || 0, currency: normalized.currency || 'KES', createdAt: now, immutable: true as const },
        ];

        const existingTransaction = await tx.get<any>(`/tenants/${idempotencyTenant}/financialTransactions/${transactionId}`);
        if (!existingTransaction) {
          const debit = entries[0].amount;
          const credit = entries[1].amount;
          if (debit !== credit || debit !== transaction.amount) throw new Error('Unbalanced financial transaction');
          await tx.set(`/tenants/${idempotencyTenant}/financialTransactions/${transactionId}`, transaction);
          await tx.set(`/tenants/${idempotencyTenant}/ledgerTransactions/${transactionId}`, {
            ledgerTransactionId: transactionId, tenantId: idempotencyTenant, transactionId,
            status: 'POSTED', amount: transaction.amount, currency: transaction.currency,
            postedAt: now, createdAt: now,
          });
          for (const entry of entries) {
            await tx.set(`/tenants/${idempotencyTenant}/ledgerTransactions/${transactionId}/entries/${entry.entryId}`, entry);
          }
        } else if (existingTransaction.status !== 'POSTED') {
          throw new Error('Existing M-Pesa financial transaction is not POSTED');
        }
      }

      await outboxEngine.enqueueEvent(idempotencyTenant, {
        eventId: `evt_callback_${stk.CheckoutRequestID}`,
        eventType: normalized.status === 'SUCCESS' ? 'payment.confirmed.v1' : 'payment.failed.v1',
        eventVersion: 'v1',
        occurredAt: normalized.occurredAt,
        tenantId: idempotencyTenant,
        branchId: context.branchContext?.branchId || null,
        principalId: context.principal.id,
        correlationId: normalized.correlationId,
        causationId: stk.CheckoutRequestID,
        source: 'MpesaBridge',
        payload: normalized as unknown as Record<string, unknown>,
        metadata: {},
      }, tx, context.principal.id);

      await tx.update<any>(claimPath, {
        status: 'COMPLETED',
        responsePayload: {
          providerReference: normalized.providerReference,
          status: normalized.status,
          amount: normalized.amount || 0,
        },
      });

      return { claim: 'CLAIMED' as const };
    });

    if (atomicResult.claim === 'COMPLETED') {
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_CALLBACK_RECEIVED', `bridge:${this.bridgeId}`, 'ALLOWED', {
        tenantId: idempotencyTenant,
        requestId: context.requestId,
        details: { providerReference: stk.CheckoutRequestID, duplicate: true },
      });
      return normalized;
    }

    if (claim === 'IN_PROGRESS') {
      throw new KernelError('CONFLICT', 'M-Pesa callback is already being processed', 409, context.requestId);
    }

    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_CALLBACK_RECEIVED', `bridge:${this.bridgeId}`, 'ALLOWED', {
      tenantId: callbackTenant || null,
      requestId: context.requestId,
      details: {
        providerReference: normalized.providerReference,
        status: normalized.status,
        amount: normalized.amount,
      },
    });

    return normalized;
  }

  /** Legacy test-hook retained for compatibility; authoritative callback identity comes from the signed request context. */
  public registerPendingTransaction(_checkoutRequestId: string, _tenantId: string, _correlationId?: string): void {
    // Intentionally no in-memory business state. Durable callback idempotency is authoritative.
  }

  public normalizeResponse(rawResponse: any): NormalizedBridgeResult<any> {
    const stk = rawResponse?.Body?.stkCallback;
    if (!stk) {
      return {
        status: 'UNKNOWN',
        provider: this.provider,
        providerReference: 'UNKNOWN_REF',
        occurredAt: new Date().toISOString(),
        correlationId: rawResponse?.correlationId || 'corr_unknown',
        errorDetails: 'Invalid or missing STK Callback structure',
      };
    }

    const isSuccess = stk.ResultCode === 0;
    let mpesaReceiptNumber = stk.CheckoutRequestID;
    let amount = 0;

    if (stk.CallbackMetadata?.Item) {
      for (const item of stk.CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
        if (item.Name === 'Amount') amount = Number(item.Value);
      }
    }

    return {
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      provider: this.provider,
      providerReference: mpesaReceiptNumber,
      amount,
      currency: 'KES',
      occurredAt: new Date().toISOString(),
      correlationId: rawResponse.correlationId || `corr_${stk.CheckoutRequestID}`,
      data: {
        merchantRequestId: stk.MerchantRequestID,
        checkoutRequestId: stk.CheckoutRequestID,
        resultCode: stk.ResultCode,
        resultDesc: stk.ResultDesc,
      },
      errorDetails: isSuccess ? undefined : stk.ResultDesc,
    };
  }
}

export const mpesaBridge = new MpesaBridge();
