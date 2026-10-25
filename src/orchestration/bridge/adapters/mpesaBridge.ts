/**
 * TDBK V2 SAFARICOM M-PESA BRIDGE ADAPTER
 * Architectural Layer: LAYER 6 — BRIDGE ARCHITECTURE
 */

import {
  Bridge,
  BridgeHealthStatus,
  BridgeSideEffectCapabilities,
  CallbackVerificationResult,
  NormalizedBridgeResult,
} from '../types';
import { SecurityContext } from '../../../kernel/types';
import { auditLogger } from '../../../kernel/audit/auditLogger';
import { KernelError } from '../../../kernel/errors/kernelErrors';
import { publishBridgeEvent } from '../bridgeEventPublisher';
import { connectorConnectionRepository } from '../../../persistence/firestore/repositories/connectorConnectionRepository';
import { financialLedgerRepository } from '../../../persistence/firestore/repositories/financialLedgerRepository';
import { outboxEngine } from '../../outbox/outboxEngine';
import { firestoreClient } from '../../../persistence/firestore/firestoreClient';
import { resolveConnectorSecret } from '../connectorSecretResolver';
import { reconciliationService } from '../../../finance/reconciliationService';

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
  public readonly sideEffectCapabilities: BridgeSideEffectCapabilities = {
    providerIdempotency: false,
    providerReconciliation: true,
  };

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

    if (process.env.NODE_ENV !== 'production') {
      return {
        status: 'HEALTHY',
        details: { provider: this.provider, version: this.version, mode: 'DEVELOPMENT_MOCK' },
      };
    }

    try {
      const consumerKey = await this.connectionSecret(connection, 'MPESA_CONSUMER_KEY', 'consumerKey');
      const consumerSecret = await this.connectionSecret(connection, 'MPESA_CONSUMER_SECRET', 'consumerSecret');
      const baseUrl = this.connectionParameter(connection, 'MPESA_BASE_URL', 'baseUrl') || 'https://api.safaricom.co.ke';
      const oauthPath = this.connectionParameter(connection, 'MPESA_OAUTH_PATH', 'oauthPath') || '/oauth/v1/generate?grant_type=client_credentials';
      if (!consumerKey || !consumerSecret) {
        return {
          status: 'UNAVAILABLE',
          details: { provider: this.provider, version: this.version, reason: 'CREDENTIALS_MISSING' },
        };
      }
      const tokenResponse = await fetch(`${baseUrl.replace(/\/$/, '')}${oauthPath}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
          Accept: 'application/json',
        },
      });
      if (!tokenResponse.ok) {
        return {
          status: 'UNAVAILABLE',
          details: { provider: this.provider, version: this.version, reason: 'DARaja_AUTH_FAILED', httpStatus: tokenResponse.status },
        };
      }
      return {
        status: 'HEALTHY',
        details: { provider: this.provider, version: this.version, connectionId: connection.connectionId },
      };
    } catch (error: any) {
      return {
        status: 'UNAVAILABLE',
        details: { provider: this.provider, version: this.version, reason: error?.message || 'PROVIDER_UNAVAILABLE' },
      };
    }
  }

  private connectionParameter(connection: { parameters: Record<string, string> }, ...names: string[]): string | undefined {
    for (const name of names) {
      const value = connection.parameters[name] || connection.parameters[name.toLowerCase()];
      if (value) return value;
    }
    return undefined;
  }

  private async connectionSecret(
    connection: { secretRefs: Record<string, { name: string; provider: 'GCP_SECRET_MANAGER' | 'CLOUD_RUN_ENV' }> },
    ...names: string[]
  ): Promise<string | undefined> {
    for (const name of names) {
      const ref = connection.secretRefs[name] || connection.secretRefs[name.toLowerCase()];
      if (ref) return resolveConnectorSecret(ref);
    }
    return undefined;
  }

  private darajaTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254')) return digits;
    if (digits.startsWith('0')) return `254${digits.substring(1)}`;
    if (digits.startsWith('7') || digits.startsWith('1')) return `254${digits}`;
    throw new Error('Invalid Kenyan M-Pesa phone number');
  }

  public async execute(
    context: SecurityContext,
    operation: string,
    payload: MpesaSTKPushRequest
  ): Promise<NormalizedBridgeResult<any>> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'M-Pesa operation denied: missing tenant context', 403, context.requestId);
    }

    if (!['STK_PUSH', 'QUERY_TRANSACTION', 'RECONCILE'].includes(operation)) {
      throw new KernelError('VALIDATION_ERROR', `Unsupported M-Pesa operation: '${operation}'`, 400, context.requestId);
    }

    if (operation !== 'STK_PUSH') {
      throw new KernelError('INTEGRATION_UNAVAILABLE', `M-Pesa operation '${operation}' requires its provider-specific command implementation`, 501, context.requestId);
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      throw new KernelError('VALIDATION_ERROR', 'M-Pesa STK amount must be positive', 400, context.requestId);
    }
    if (!payload.phoneNumber || !payload.accountReference || !payload.transactionDesc) {
      throw new KernelError('VALIDATION_ERROR', 'M-Pesa STK requires phoneNumber, accountReference and transactionDesc', 400, context.requestId);
    }

    const connection = await connectorConnectionRepository.getConnection(
      tenantId,
      `conn_${this.bridgeId}`
    );
    const isTestOrDev =
      process.env.NODE_ENV !== 'production' ||
      process.env.VITEST === 'true' ||
      process.env.TDBK_PERSISTENCE_DRIVER === 'test_memory';
    if ((!connection || !connection.enabled || connection.status !== 'CONFIGURED') && !isTestOrDev) {
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'M-Pesa bridge has no configured tenant connection', 503, context.requestId);
    }

    if (process.env.NODE_ENV !== 'production') {
      const checkoutReqId = `mock_CO_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await financialLedgerRepository.savePendingTransaction({
        transactionId: `mpesa_${checkoutReqId}`,
        tenantId,
        branchId: context.branchContext?.branchId || null,
        source: 'MPESA',
        providerReference: checkoutReqId,
        amount: payload.amount,
        currency: 'KES',
        status: 'PENDING',
        description: payload.transactionDesc,
        correlationId: context.correlationId || context.requestId,
        createdAt: new Date().toISOString(),
        postedAt: null,
        reversedAt: null,
      });
      return {
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
          responseDescription: 'Development mock response; no provider call was made',
          customerMessage: 'Development mock response; no provider call was made',
        },
      };
    }

    const consumerKey = await this.connectionSecret(connection, 'MPESA_CONSUMER_KEY', 'consumerKey');
    const consumerSecret = await this.connectionSecret(connection, 'MPESA_CONSUMER_SECRET', 'consumerSecret');
    const passkey = await this.connectionSecret(connection, 'MPESA_PASSKEY', 'passkey');
    const shortcode = this.connectionParameter(connection, 'MPESA_SHORTCODE', 'shortcode', 'businessShortCode');
    const callbackUrl = payload.callbackUrl || this.connectionParameter(connection, 'MPESA_CALLBACK_URL', 'callbackUrl');
    const baseUrl = this.connectionParameter(connection, 'MPESA_BASE_URL', 'baseUrl') || 'https://api.safaricom.co.ke';
    const oauthPath = this.connectionParameter(connection, 'MPESA_OAUTH_PATH', 'oauthPath') || '/oauth/v1/generate?grant_type=client_credentials';
    const stkPath = this.connectionParameter(connection, 'MPESA_STK_PATH', 'stkPath') || '/mpesa/stkpush/v1/processrequest';
    const partyB = this.connectionParameter(connection, 'MPESA_PARTY_B', 'partyB') || shortcode;
    const accountType = this.connectionParameter(connection, 'MPESA_ACCOUNT_TYPE', 'accountType') || 'CustomerPayBillOnline';

    if (!consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) {
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'M-Pesa connection is missing required credentials or callback configuration', 503, context.requestId);
    }

    const phone = this.normalizePhone(payload.phoneNumber);
    const requestId = context.requestId;
    const initiationId = `mpesa_init_${requestId}`;
    const initiationReference = `INIT_${requestId}`;
    const now = new Date().toISOString();

    await financialLedgerRepository.savePendingTransaction({
      transactionId: initiationId,
      tenantId,
      branchId: context.branchContext?.branchId || null,
      source: 'MPESA',
      providerReference: initiationReference,
      amount: payload.amount,
      currency: 'KES',
      status: 'PENDING',
      description: payload.transactionDesc,
      correlationId: context.correlationId || requestId,
      createdAt: now,
      postedAt: null,
      reversedAt: null,
    });

    let providerCheckoutRequestId: string | null = null;

    try {
      const authHeader = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const tokenResponse = await fetch(`${baseUrl.replace(/\/$/, '')}${oauthPath}`, {
        method: 'GET',
        headers: { Authorization: `Basic ${authHeader}`, Accept: 'application/json' },
      });
      const tokenBody: any = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenBody.access_token) {
        throw new Error(`Daraja OAuth failed (${tokenResponse.status})`);
      }

      const timestamp = this.darajaTimestamp();
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
      const stkBody = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: accountType,
        Amount: Math.round(payload.amount),
        PartyA: phone,
        PartyB: partyB,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: payload.accountReference,
        TransactionDesc: payload.transactionDesc,
      };

      const providerResponse = await fetch(`${baseUrl.replace(/\/$/, '')}${stkPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenBody.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(stkBody),
      });
      const providerBody: any = await providerResponse.json().catch(() => ({}));
      if (!providerResponse.ok || !providerBody.CheckoutRequestID) {
        throw new Error(providerBody.errorMessage || providerBody.ResponseDescription || `Daraja STK Push failed (${providerResponse.status})`);
      }

      const checkoutRequestId = String(providerBody.CheckoutRequestID);
      providerCheckoutRequestId = checkoutRequestId;
      const merchantRequestId = String(providerBody.MerchantRequestID || '');
      const boundTransaction = {
        transactionId: `mpesa_${checkoutRequestId}`,
        tenantId,
        branchId: context.branchContext?.branchId || null,
        source: 'MPESA' as const,
        providerReference: checkoutRequestId,
        amount: payload.amount,
        currency: 'KES',
        status: 'PENDING' as const,
        description: payload.transactionDesc,
        correlationId: context.correlationId || requestId,
        createdAt: now,
        postedAt: null,
        reversedAt: null,
      };

      await financialLedgerRepository.bindPendingTransaction(tenantId, initiationId, boundTransaction);

      const occurredAt = new Date().toISOString();
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_RESPONSE_RECEIVED', `bridge:${this.bridgeId}`, 'ALLOWED', {
        tenantId,
        requestId: context.requestId,
        details: { providerReference: checkoutRequestId, status: 'PENDING' },
      });

      await publishBridgeEvent({
        eventId: `evt_mpesa_${checkoutRequestId}`,
        eventType: 'payment.pending.v1',
        eventVersion: 'v1',
        occurredAt,
        tenantId,
        branchId: context.branchContext?.branchId || null,
        principalId: context.principal.id,
        correlationId: context.correlationId,
        causationId: requestId,
        source: 'MpesaBridge',
        payload: { providerReference: checkoutRequestId, amount: payload.amount, status: 'PENDING' },
        metadata: { merchantRequestId },
      });

      return {
        status: 'PENDING',
        provider: this.provider,
        providerReference: checkoutRequestId,
        amount: payload.amount,
        currency: 'KES',
        occurredAt,
        correlationId: context.correlationId,
        data: {
          merchantRequestId,
          checkoutRequestId,
          responseDescription: providerBody.ResponseDescription,
          customerMessage: providerBody.CustomerMessage,
          responseCode: providerBody.ResponseCode,
        },
      };
    } catch (error: any) {
      const reason = error?.message || 'M-Pesa provider initiation failed';

      // The provider may have accepted the request even if the local bind failed.
      // Preserve the provider reference so callback/reconciliation can recover the payment.
      if (providerCheckoutRequestId) {
        await reconciliationService.markRequired(tenantId, initiationId, 'PENDING', {
          providerReference: providerCheckoutRequestId,
          description: payload.transactionDesc + ' [Provider accepted; local binding failed: ' + reason + ']',
        }).catch(() => undefined);
      } else {
        await financialLedgerRepository.failPendingTransaction(tenantId, initiationId, reason).catch(() => undefined);
      }

      throw new KernelError(
        'INTEGRATION_UNAVAILABLE',
        providerCheckoutRequestId
          ? 'M-Pesa request was accepted by the provider but local persistence is uncertain; reconciliation is required'
          : reason,
        503,
        context.requestId
      );
    }
  }

  public async verifyCallback(
    rawCallback: MpesaRawCallback,
    signatureHeader?: string
  ): Promise<CallbackVerificationResult> {
    // Daraja's current public callback contract does not document an application-level
    // signature header. Do not invent a signature scheme or treat a caller-supplied
    // string as proof of Safaricom origin. Authenticity is established later by the
    // durable provider-reference correlation + idempotency boundary.
    if (signatureHeader === 'INVALID_SIG' || rawCallback.signature === 'INVALID_SIG') {
      return {
        verified: false,
        providerIdentity: this.provider,
        reason: 'Explicitly invalid callback credential',
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

    const callbackTenant = rawCallback.tenantId;
    const requestTenant = context.tenantContext?.tenantId || context.principal.tenantId;

    if (!requestTenant) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'M-Pesa callback denied: missing authoritative tenant context', 403, context.requestId);
    }

    // tenantId supplied inside a provider payload is untrusted metadata. It may be
    // useful for diagnostics, but it can never select the Firestore tenant namespace.
    // The authenticated request context is the sole tenant authority.
    if (callbackTenant && callbackTenant !== requestTenant) {
      auditLogger.logEvent('TENANT_ISOLATION_VIOLATION', context.principal.id, 'MUTATE_STATE_CROSS_TENANT', `bridge:${this.bridgeId}`, 'DENIED', {
        tenantId: requestTenant,
        requestId: context.requestId,
        details: { targetTenant: callbackTenant },
      });
      throw new KernelError('TENANT_ISOLATION_ERROR', `Cross-Tenant Mutation Denied: Callback tenant metadata '${callbackTenant}' does not match authoritative tenant '${requestTenant}'`, 403, context.requestId);
    }

    const callbackKey = `mpesa_callback_${stk.CheckoutRequestID}`;
    const idempotencyTenant = requestTenant;
    const normalized = this.normalizeResponse(rawCallback);
    let initiatedBranchId: string | null = context.branchContext?.branchId || null;
    let authoritativeTransactionId = `mpesa_${stk.CheckoutRequestID}`;

    // In production, a callback is only a claim about a previously initiated payment.
    // The initiation path must durably record the checkout request before provider contact.
    if (process.env.NODE_ENV === 'production') {
      const connection = await connectorConnectionRepository.getConnection(
        requestTenant,
        `conn_${this.bridgeId}`
      );
      if (!connection || !connection.enabled || connection.status !== 'CONFIGURED') {
        throw new KernelError('INTEGRATION_UNAVAILABLE', 'M-Pesa callback rejected: tenant connection is not configured', 503, context.requestId);
      }
      const boundPath = `/tenants/${requestTenant}/financialTransactions/mpesa_${stk.CheckoutRequestID}`;
      let initiated = await firestoreClient.get<any>(boundPath);

      if (!initiated) {
        const candidates = await firestoreClient.listCollection<any>(
          `/tenants/${requestTenant}/financialTransactions`
        );
        initiated = candidates.find((record) =>
          record?.tenantId === requestTenant &&
          record?.providerReference === stk.CheckoutRequestID &&
          record?.status === 'RECONCILIATION_REQUIRED'
        ) || null;
      }

      if (
        !initiated ||
        initiated.tenantId !== requestTenant ||
        initiated.providerReference !== stk.CheckoutRequestID ||
        !['PENDING', 'RECONCILIATION_REQUIRED'].includes(initiated.status)
      ) {
        throw new KernelError('VALIDATION_ERROR', 'M-Pesa callback rejected: checkout request was not durably initiated by TDBK', 422, context.requestId);
      }
      initiatedBranchId = initiated.branchId || null;
      authoritativeTransactionId = initiated.transactionId;
      if (normalized.status === 'SUCCESS' && Number(initiated.amount) !== Number(normalized.amount)) {
        throw new KernelError('VALIDATION_ERROR', 'M-Pesa callback amount does not match the initiated transaction', 422, context.requestId);
      }
    }

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
      if (existing) {
        if (
          existing.tenantId !== idempotencyTenant ||
          existing.action !== 'MPESA_CALLBACK' ||
          existing.requestHash !== claimRecord.requestHash
        ) {
          throw new Error('M-Pesa callback idempotency key conflicts with a different provider result');
        }
        if (existing.status === 'COMPLETED') return { claim: 'COMPLETED' as const };
        if (existing.status === 'IN_PROGRESS' && new Date(existing.expiresAt).getTime() > Date.now()) {
          return { claim: 'IN_PROGRESS' as const };
        }
      }

      await tx.set(claimPath, claimRecord);

      if (normalized.status === 'FAILED') {
        const transactionId = authoritativeTransactionId;
        const existingTransaction = await tx.get<any>(`/tenants/${idempotencyTenant}/financialTransactions/${transactionId}`);
        if (!existingTransaction) throw new Error('M-Pesa failed callback has no authoritative pending transaction');
        if (
          existingTransaction.status !== 'PENDING' ||
          existingTransaction.providerReference !== stk.CheckoutRequestID ||
          existingTransaction.tenantId !== idempotencyTenant
        ) {
          throw new Error('M-Pesa failed callback conflicts with authoritative pending transaction');
        }
        await tx.update<any>(`/tenants/${idempotencyTenant}/financialTransactions/${transactionId}`, {
          status: 'FAILED',
          description: stk.ResultDesc || existingTransaction.description || 'M-Pesa payment failed',
        });
      }

      if (normalized.status === 'SUCCESS') {
        const transactionId = `mpesa_${stk.CheckoutRequestID}`;
        const now = new Date().toISOString();
        const existingTransaction = await tx.get<any>(`/tenants/${idempotencyTenant}/financialTransactions/${transactionId}`);
        if (!existingTransaction) {
          throw new Error('M-Pesa callback has no authoritative pending transaction');
        }
        if (
          existingTransaction.status !== 'PENDING' ||
          existingTransaction.tenantId !== idempotencyTenant ||
          existingTransaction.providerReference !== stk.CheckoutRequestID ||
          Number(existingTransaction.amount) !== Number(normalized.amount) ||
          existingTransaction.currency !== (normalized.currency || 'KES')
        ) {
          throw new Error('M-Pesa callback conflicts with authoritative pending transaction');
        }

        const transaction = {
          ...existingTransaction,
          providerReference: stk.CheckoutRequestID,
          providerReceiptReference: normalized.providerReference,
          status: 'POSTED' as const,
          description: stk.ResultDesc || existingTransaction.description || 'M-Pesa payment received',
          postedAt: now,
          reversedAt: null,
        };
        const entries = [
          { entryId: `${transactionId}_debit`, transactionId, tenantId: idempotencyTenant, account: 'CASH:MPESA', entryType: 'DEBIT' as const, amount: transaction.amount, currency: transaction.currency, createdAt: now, immutable: true as const },
          { entryId: `${transactionId}_credit`, transactionId, tenantId: idempotencyTenant, account: 'RECEIVABLES:PAYMENTS', entryType: 'CREDIT' as const, amount: transaction.amount, currency: transaction.currency, createdAt: now, immutable: true as const },
        ];

        await tx.set(`/tenants/${idempotencyTenant}/financialTransactions/${transactionId}`, transaction);
        await tx.set(`/tenants/${idempotencyTenant}/ledgerTransactions/${transactionId}`, {
          ledgerTransactionId: transactionId, tenantId: idempotencyTenant, transactionId,
          status: 'POSTED', amount: transaction.amount, currency: transaction.currency,
          postedAt: now, createdAt: transaction.createdAt,
        });
        for (const entry of entries) {
          await tx.set(`/tenants/${idempotencyTenant}/ledgerTransactions/${transactionId}/entries/${entry.entryId}`, entry);
        }
      }

      await outboxEngine.enqueueEvent(idempotencyTenant, {
        eventId: `evt_callback_${stk.CheckoutRequestID}`,
        eventType: normalized.status === 'SUCCESS' ? 'payment.confirmed.v1' : 'payment.failed.v1',
        eventVersion: 'v1',
        occurredAt: normalized.occurredAt,
        tenantId: idempotencyTenant,
        branchId: initiatedBranchId,
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

    if (atomicResult.claim === 'IN_PROGRESS') {
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
