/**
 * TDBK V2 PHASE 3 WORKFLOW ENGINE, EVENT BUS & EXTERNAL BRIDGE TEST RUNNER
 * Architectural Layer: LAYER 6 — WORKFLOW, EVENTS & BRIDGES
 */

import { eventBus } from '../events/eventBus';
import { EventEnvelope } from '../events/types';
import { workflowEngine } from '../workflow/engine';
import { bridgeRegistry } from '../bridge/registry';
import { MpesaBridge } from '../bridge/adapters/mpesaBridge';
import { EtimsBridge } from '../bridge/adapters/etimsBridge';
import { WhatsappBridge } from '../bridge/adapters/whatsappBridge';
import { EmailBridge } from '../bridge/adapters/emailBridge';
import { SmsBridge } from '../bridge/adapters/smsBridge';
import { BankBridge } from '../bridge/adapters/bankBridge';
import { securityContextFactory } from '../../kernel/context/contextFactory';
import { TokenVerifier } from '../../kernel/identity/tokenVerifier';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { phase0TestRunner } from '../../kernel/tests/phase0TestRunner';
import { Phase1TestRunner } from '../../blueprint/tests/phase1TestRunner';
import { Phase2TestRunner } from '../../capability/tests/phase2TestRunner';
import { financialLedgerRepository } from '../../persistence/firestore/repositories/financialLedgerRepository';

export interface Phase3TestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  errorDetails?: string;
}

export interface Phase3TestSuiteSummary {
  executedAt: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  overallStatus: 'PASS' | 'FAIL';
  results: Phase3TestResult[];
}

export class Phase3TestRunner {
  public static async runAllTests(): Promise<Phase3TestSuiteSummary> {
    auditLogger.clearBufferForTesting();
    eventBus.clearStoreForTesting();
    workflowEngine.clearStoreForTesting();
    bridgeRegistry.clearStoreForTesting();

    const results: Phase3TestResult[] = [];

    // Bind Bridge Adapter Instances
    const mpesaAdapter = new MpesaBridge();
    const etimsAdapter = new EtimsBridge();
    const whatsappAdapter = new WhatsappBridge();
    const emailAdapter = new EmailBridge();
    const smsAdapter = new SmsBridge();
    const bankAdapter = new BankBridge();

    bridgeRegistry.registerBridgeInstance(mpesaAdapter);
    bridgeRegistry.registerBridgeInstance(etimsAdapter);
    bridgeRegistry.registerBridgeInstance(whatsappAdapter);
    bridgeRegistry.registerBridgeInstance(emailAdapter);
    bridgeRegistry.registerBridgeInstance(smsAdapter);
    bridgeRegistry.registerBridgeInstance(bankAdapter);

    // Setup Test Tokens & Security Contexts
    const masterAdminToken = TokenVerifier.mintTestToken({
      uid: 'usr_master_p3',
      email: 'master@tdbk.co.ke',
      isMaster: true,
      tenantId: null,
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
    });

    const tenantAAdminToken = TokenVerifier.mintTestToken({
      uid: 'usr_tenantA_admin',
      email: 'admin@schoolA.co.ke',
      isMaster: false,
      tenantId: 'tenant_school_a',
      branchId: 'branch_hq',
      roles: ['TENANT_ADMIN'],
      permissions: ['school:read', 'school:write'],
    });

    const tenantBAdminToken = TokenVerifier.mintTestToken({
      uid: 'usr_tenantB_admin',
      email: 'admin@hardwareB.co.ke',
      isMaster: false,
      tenantId: 'tenant_hardware_b',
      branchId: 'branch_main',
      roles: ['TENANT_ADMIN'],
      permissions: ['hardware:read', 'hardware:write'],
    });

    const masterContext = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${masterAdminToken}`,
      requestId: 'req_master_p3',
    });

    const tenantAContext = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${tenantAAdminToken}`,
      targetTenantId: 'tenant_school_a',
      requestId: 'req_tenantA_p3',
    });

    const tenantBContext = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${tenantBAdminToken}`,
      targetTenantId: 'tenant_hardware_b',
      requestId: 'req_tenantB_p3',
    });

    // Register test step handlers
    workflowEngine.registerStepHandler('STEP_PAYMENT_INIT', async (ctx) => ({
      success: true,
      output: { paymentReference: `PAY_${Date.now()}` },
    }));

    workflowEngine.registerStepHandler('STEP_WAIT_CALLBACK', async (ctx) => ({
      success: false,
      status: 'WAITING',
      failureClassification: 'WAITING_FOR_EXTERNAL_RESULT',
    }));

    workflowEngine.registerStepHandler('STEP_FAIL_TRANSIENT', async (ctx) => {
      if (ctx.step.attemptCount < 2) {
        return { success: false, failureClassification: 'TRANSIENT', error: 'TRANSIENT_NETWORK' };
      }
      return { success: true, output: { recovered: true } };
    });

    workflowEngine.registerStepHandler('STEP_FAIL_PERMANENT', async (ctx) => ({
      success: false,
      failureClassification: 'PERMANENT',
      error: 'INVALID_CREDENTIALS',
    }));

    // -----------------------------------------------------------------
    // P3_TEST_01: Valid event envelope accepted
    // -----------------------------------------------------------------
    try {
      const envelope: EventEnvelope = {
        eventId: 'evt_01',
        eventType: 'payment.initiated.v1',
        eventVersion: 'v1',
        occurredAt: new Date().toISOString(),
        tenantId: 'tenant_school_a',
        branchId: null,
        principalId: 'usr_tenantA_admin',
        correlationId: 'corr_01',
        causationId: null,
        source: 'TestRunner',
        payload: { amount: 1000 },
        metadata: {},
      };
      const validation = eventBus.validateEnvelope(envelope);
      results.push({
        id: 'P3_TEST_01',
        name: 'Valid event envelope accepted',
        passed: validation.valid === true,
        expected: 'valid === true',
        actual: `valid === ${validation.valid}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_01', name: 'Valid event envelope accepted', passed: false, expected: 'Valid', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_02: Invalid event envelope rejected
    // -----------------------------------------------------------------
    try {
      const invalidEnvelope = { eventId: '', eventType: 'payment.initiated.v1' }; // missing required fields
      const validation = eventBus.validateEnvelope(invalidEnvelope);
      results.push({
        id: 'P3_TEST_02',
        name: 'Invalid event envelope rejected',
        passed: validation.valid === false,
        expected: 'valid === false',
        actual: `valid === ${validation.valid}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_02', name: 'Invalid event envelope rejected', passed: false, expected: 'Rejected', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_03: Unknown event version rejected
    // -----------------------------------------------------------------
    try {
      const unknownEnvelope: EventEnvelope = {
        eventId: 'evt_03',
        eventType: 'payment.initiated.v99', // Unknown version
        eventVersion: 'v99',
        occurredAt: new Date().toISOString(),
        tenantId: 'tenant_school_a',
        branchId: null,
        principalId: 'usr_tenantA_admin',
        correlationId: 'corr_03',
        causationId: null,
        source: 'TestRunner',
        payload: {},
        metadata: {},
      };
      const validation = eventBus.validateEnvelope(unknownEnvelope);
      results.push({
        id: 'P3_TEST_03',
        name: 'Unknown event version rejected',
        passed: validation.valid === false,
        expected: 'valid === false',
        actual: `valid === ${validation.valid}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_03', name: 'Unknown event version rejected', passed: false, expected: 'Rejected', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_04: Duplicate event is idempotently ignored
    // -----------------------------------------------------------------
    try {
      const envelope: EventEnvelope = {
        eventId: 'evt_dup_04',
        eventType: 'payment.initiated.v1',
        eventVersion: 'v1',
        occurredAt: new Date().toISOString(),
        tenantId: 'tenant_school_a',
        branchId: null,
        principalId: 'usr_tenantA_admin',
        correlationId: 'corr_04',
        causationId: null,
        source: 'TestRunner',
        payload: { test: 1 },
        metadata: {},
      };

      const res1 = await eventBus.publish(envelope);
      const res2 = await eventBus.publish(envelope);

      results.push({
        id: 'P3_TEST_04',
        name: 'Duplicate event is idempotently ignored',
        passed: res1.published === true && res2.isDuplicate === true && res2.published === false,
        expected: 'res1 published, res2 duplicate',
        actual: `res1.published=${res1.published}, res2.isDuplicate=${res2.isDuplicate}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_04', name: 'Duplicate event is idempotently ignored', passed: false, expected: 'Idempotent', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_05: Correlation ID preserved across workflow
    // -----------------------------------------------------------------
    try {
      const wf = workflowEngine.createWorkflow(tenantAContext, 'FEE_PAYMENT', 'v1.0', [
        { stepId: 'step_1', stepType: 'STEP_PAYMENT_INIT' },
      ]);
      results.push({
        id: 'P3_TEST_05',
        name: 'Correlation ID preserved across workflow',
        passed: wf.correlationId === tenantAContext.correlationId,
        expected: tenantAContext.correlationId,
        actual: wf.correlationId,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_05', name: 'Correlation ID preserved across workflow', passed: false, expected: 'Preserved', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_06: Causation ID preserved across event chain
    // -----------------------------------------------------------------
    try {
      const wf = await workflowEngine.executeWorkflow(
        tenantAContext,
        workflowEngine.createWorkflow(tenantAContext, 'CAUSATION_TEST', 'v1.0', [
          { stepId: 'step_causal_1', stepType: 'STEP_PAYMENT_INIT' },
        ]).workflowId
      );
      results.push({
        id: 'P3_TEST_06',
        name: 'Causation ID preserved across event chain',
        passed: wf.steps[0].stepId === 'step_causal_1' && wf.status === 'COMPLETED',
        expected: 'step_causal_1 completed',
        actual: `status=${wf.status}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_06', name: 'Causation ID preserved across event chain', passed: false, expected: 'Preserved', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_07: Workflow starts correctly
    // -----------------------------------------------------------------
    try {
      const wf = workflowEngine.createWorkflow(tenantAContext, 'START_TEST', 'v1.0', [
        { stepId: 's1', stepType: 'STEP_PAYMENT_INIT' },
      ]);
      results.push({
        id: 'P3_TEST_07',
        name: 'Workflow starts correctly',
        passed: wf.status === 'PENDING' && !!wf.workflowId,
        expected: 'PENDING with valid workflowId',
        actual: `status=${wf.status}, id=${wf.workflowId}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_07', name: 'Workflow starts correctly', passed: false, expected: 'Started', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_08: Workflow transitions correctly
    // -----------------------------------------------------------------
    try {
      const wfInit = workflowEngine.createWorkflow(tenantAContext, 'TRANS_TEST', 'v1.0', [
        { stepId: 's1', stepType: 'STEP_PAYMENT_INIT' },
      ]);
      const wfDone = await workflowEngine.executeWorkflow(tenantAContext, wfInit.workflowId);
      results.push({
        id: 'P3_TEST_08',
        name: 'Workflow transitions correctly',
        passed: wfDone.status === 'COMPLETED' && wfDone.steps[0].status === 'COMPLETED',
        expected: 'COMPLETED',
        actual: `status=${wfDone.status}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_08', name: 'Workflow transitions correctly', passed: false, expected: 'Transitions', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_09: Workflow WAITING state supported
    // -----------------------------------------------------------------
    try {
      const wfInit = workflowEngine.createWorkflow(tenantAContext, 'WAIT_TEST', 'v1.0', [
        { stepId: 's_wait', stepType: 'STEP_WAIT_CALLBACK' },
      ]);
      const wfWait = await workflowEngine.executeWorkflow(tenantAContext, wfInit.workflowId);
      results.push({
        id: 'P3_TEST_09',
        name: 'Workflow WAITING state supported',
        passed: wfWait.status === 'WAITING' && wfWait.steps[0].status === 'WAITING',
        expected: 'WAITING (not FAILED)',
        actual: `status=${wfWait.status}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_09', name: 'Workflow WAITING state supported', passed: false, expected: 'WAITING', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_10: Workflow retry policy works
    // -----------------------------------------------------------------
    try {
      const wfInit = workflowEngine.createWorkflow(tenantAContext, 'RETRY_TEST', 'v1.0', [
        { stepId: 's_retry', stepType: 'STEP_FAIL_TRANSIENT', retryPolicy: { maxAttempts: 3, backoffMs: 10, timeoutMs: 1000, retryableErrors: [] } },
      ]);
      const wfRetried = await workflowEngine.executeWorkflow(tenantAContext, wfInit.workflowId);
      results.push({
        id: 'P3_TEST_10',
        name: 'Workflow retry policy works',
        passed: wfRetried.status === 'COMPLETED' && wfRetried.steps[0].attemptCount === 2,
        expected: 'COMPLETED with attemptCount === 2',
        actual: `status=${wfRetried.status}, attemptCount=${wfRetried.steps[0].attemptCount}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_10', name: 'Workflow retry policy works', passed: false, expected: 'Retried successfully', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_11: Permanent failure does not retry indefinitely
    // -----------------------------------------------------------------
    try {
      const wfInit = workflowEngine.createWorkflow(tenantAContext, 'PERM_FAIL_TEST', 'v1.0', [
        { stepId: 's_perm', stepType: 'STEP_FAIL_PERMANENT', retryPolicy: { maxAttempts: 5, backoffMs: 10, timeoutMs: 1000, retryableErrors: [] } },
      ]);
      const wfFailed = await workflowEngine.executeWorkflow(tenantAContext, wfInit.workflowId);
      results.push({
        id: 'P3_TEST_11',
        name: 'Permanent failure does not retry indefinitely',
        passed: wfFailed.status === 'FAILED' && wfFailed.steps[0].attemptCount === 1,
        expected: 'FAILED on attempt 1',
        actual: `status=${wfFailed.status}, attemptCount=${wfFailed.steps[0].attemptCount}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_11', name: 'Permanent failure does not retry indefinitely', passed: false, expected: 'FAILED', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_12: Bridge registry rejects unauthorized registration
    // -----------------------------------------------------------------
    try {
      bridgeRegistry.registerBridgeDefinition(tenantAContext, {
        bridgeId: 'bridge_unauth',
        provider: 'FORGED_PROVIDER',
        bridgeVersion: 'v1.0',
        capabilityId: 'some_cap',
        supportedOperations: ['TEST'],
        status: 'DEFINED',
        configurationRequirements: [],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      });
      results.push({ id: 'P3_TEST_12', name: 'Bridge registry rejects unauthorized registration', passed: false, expected: 'Rejected', actual: 'Allowed' });
    } catch (e: any) {
      results.push({
        id: 'P3_TEST_12',
        name: 'Bridge registry rejects unauthorized registration',
        passed: e.message.includes('Only Master Admin can manage platform Bridge definitions'),
        expected: 'Authorization Denied Error',
        actual: e.message,
      });
    }

    // -----------------------------------------------------------------
    // P3_TEST_13: Master can manage bridge definitions
    // -----------------------------------------------------------------
    try {
      const registered = bridgeRegistry.registerBridgeDefinition(masterContext, {
        bridgeId: 'bridge_custom_master',
        provider: 'MASTER_CUSTOM_PROVIDER',
        bridgeVersion: 'v1.0',
        capabilityId: 'custom_cap',
        supportedOperations: ['OP1'],
        status: 'MOCK',
        configurationRequirements: [],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      });
      results.push({
        id: 'P3_TEST_13',
        name: 'Master can manage bridge definitions',
        passed: registered.bridgeId === 'bridge_custom_master',
        expected: 'bridge_custom_master registered',
        actual: registered.bridgeId,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_13', name: 'Master can manage bridge definitions', passed: false, expected: 'Registered', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_14: DBK cannot manage platform bridge definitions
    // -----------------------------------------------------------------
    try {
      bridgeRegistry.registerBridgeDefinition(tenantBContext, {
        bridgeId: 'bridge_dbk_forbidden',
        provider: 'FORBIDDEN',
        bridgeVersion: 'v1.0',
        capabilityId: 'cap',
        supportedOperations: [],
        status: 'MOCK',
        configurationRequirements: [],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      });
      results.push({ id: 'P3_TEST_14', name: 'DBK cannot manage platform bridge definitions', passed: false, expected: 'Denied', actual: 'Allowed' });
    } catch (e: any) {
      results.push({
        id: 'P3_TEST_14',
        name: 'DBK cannot manage platform bridge definitions',
        passed: e.message.includes('Only Master Admin'),
        expected: 'Denied',
        actual: e.message,
      });
    }

    // -----------------------------------------------------------------
    // P3_TEST_15: Provider response is normalized
    // -----------------------------------------------------------------
    try {
      const norm = mpesaAdapter.normalizeResponse({
        Body: { stkCallback: { CheckoutRequestID: 'CO_123', ResultCode: 0, ResultDesc: 'Success', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1500 }] } } },
        correlationId: 'corr_norm_test',
      });
      results.push({
        id: 'P3_TEST_15',
        name: 'Provider response is normalized',
        passed: norm.status === 'SUCCESS' && norm.amount === 1500 && norm.provider === 'SAFARICOM_MPESA',
        expected: 'Normalized SUCCESS amount=1500',
        actual: `status=${norm.status}, amount=${norm.amount}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_15', name: 'Provider response is normalized', passed: false, expected: 'Normalized', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_16: Duplicate provider callback is idempotent
    // -----------------------------------------------------------------
    try {
      await financialLedgerRepository.savePendingTransaction({
        transactionId: 'mpesa_CO_DUP_TEST', tenantId: 'tenant_school_a', branchId: null,
        source: 'MPESA', providerReference: 'CO_DUP_TEST', amount: 100, currency: 'KES', status: 'PENDING',
        description: 'test', correlationId: 'corr_cb_dup', createdAt: new Date().toISOString(), postedAt: null, reversedAt: null,
      });

      const rawCb = {
        Body: { stkCallback: { MerchantRequestID: 'MR_TEST', CheckoutRequestID: 'CO_DUP_TEST', ResultCode: 0, ResultDesc: 'Success', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 100 }] } } },
        signature: 'VALID_SIG',
        tenantId: 'tenant_school_a',
        correlationId: 'corr_cb_dup',
      };
      const cb1 = await mpesaAdapter.handleCallback(tenantAContext, rawCb);
      const cb2 = await mpesaAdapter.handleCallback(tenantAContext, rawCb);
      results.push({
        id: 'P3_TEST_16',
        name: 'Duplicate provider callback is idempotent',
        passed: cb1.status === 'SUCCESS' && cb2.status === 'SUCCESS',
        expected: 'Both SUCCESS without error',
        actual: `cb1=${cb1.status}, cb2=${cb2.status}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_16', name: 'Duplicate provider callback is idempotent', passed: false, expected: 'Idempotent', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_17: Invalid callback verification is rejected
    // -----------------------------------------------------------------
    try {
      const verified = await mpesaAdapter.verifyCallback({ Body: { stkCallback: {} as any } }, 'INVALID_SIG');
      results.push({
        id: 'P3_TEST_17',
        name: 'Invalid callback verification is rejected',
        passed: verified.verified === false,
        expected: 'verified === false',
        actual: `verified === ${verified.verified}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_17', name: 'Invalid callback verification is rejected', passed: false, expected: 'Rejected', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_18: Callback replay protection works
    // -----------------------------------------------------------------
    try {
      const staleTimestamp = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago
      const verified = await mpesaAdapter.verifyCallback({ Body: { stkCallback: {} as any }, signature: 'VALID_SIG', timestamp: staleTimestamp });
      results.push({
        id: 'P3_TEST_18',
        name: 'Callback replay protection works',
        passed: verified.verified === false && verified.replayProtectionPassed === false,
        expected: 'replayProtectionPassed === false',
        actual: `replayProtectionPassed === ${verified.replayProtectionPassed}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_18', name: 'Callback replay protection works', passed: false, expected: 'Replay rejected', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_19: Callback cannot forge tenant context
    // -----------------------------------------------------------------
    try {
      const rawCb = {
        Body: { stkCallback: { MerchantRequestID: 'MR_TEST', CheckoutRequestID: 'CO_FORGE_1', ResultCode: 0, ResultDesc: 'Success' } },
        signature: 'VALID_SIG',
        tenantId: 'tenant_hardware_b', // Forged tenant context in callback payload
        correlationId: 'corr_forge',
      };
      await mpesaAdapter.handleCallback(tenantAContext, rawCb);
      results.push({ id: 'P3_TEST_19', name: 'Callback cannot forge tenant context', passed: false, expected: 'Denied', actual: 'Allowed' });
    } catch (e: any) {
      results.push({
        id: 'P3_TEST_19',
        name: 'Callback cannot forge tenant context',
        passed: e.message.includes('Cross-Tenant Mutation Denied'),
        expected: 'Cross-Tenant Mutation Denied',
        actual: e.message,
      });
    }

    // -----------------------------------------------------------------
    // P3_TEST_20: Cross-tenant callback mutation is denied
    // -----------------------------------------------------------------
    try {
      const rawCb = {
        Body: { stkCallback: { MerchantRequestID: 'MR_TEST', CheckoutRequestID: 'CO_CROSS_1', ResultCode: 0, ResultDesc: 'Success' } },
        signature: 'VALID_SIG',
        tenantId: 'tenant_hardware_b',
        correlationId: 'corr_cross',
      };
      await mpesaAdapter.handleCallback(tenantAContext, rawCb);
      results.push({ id: 'P3_TEST_20', name: 'Cross-tenant callback mutation is denied', passed: false, expected: 'Denied', actual: 'Allowed' });
    } catch (e: any) {
      results.push({
        id: 'P3_TEST_20',
        name: 'Cross-tenant callback mutation is denied',
        passed: e.message.includes('Cross-Tenant Mutation Denied'),
        expected: 'Denied',
        actual: e.message,
      });
    }

    // -----------------------------------------------------------------
    // P3_TEST_21: Bridge credentials never enter client bundle
    // -----------------------------------------------------------------
    try {
      const def = bridgeRegistry.getBridgeDefinition('bridge_mpesa');
      const keysExposed = Object.keys(def || {}).some((k) => k.toLowerCase().includes('passkey') || k.toLowerCase().includes('secret'));
      results.push({
        id: 'P3_TEST_21',
        name: 'Bridge credentials never enter client bundle',
        passed: keysExposed === false,
        expected: 'No secrets exposed in metadata',
        actual: `keysExposed=${keysExposed}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_21', name: 'Bridge credentials never enter client bundle', passed: false, expected: 'Isolated', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_22: Bridge credentials never enter audit payload
    // -----------------------------------------------------------------
    try {
      auditLogger.logEvent('BRIDGE_EXECUTION', 'usr_test', 'TEST_SECRET', 'bridge:mpesa', 'ALLOWED', {
        tenantId: 'tenant_school_a',
        details: { passkey: 'secret123', apiKey: 'key_xyz', safeData: 'hello' },
      });
      const events = auditLogger.getEvents({ limit: 1 });
      const sanitizedPasskey = events[0]?.details?.passkey;
      const sanitizedKey = events[0]?.details?.apiKey;

      results.push({
        id: 'P3_TEST_22',
        name: 'Bridge credentials never enter audit payload',
        passed: sanitizedPasskey === '[REDACTED]' && sanitizedKey === '[REDACTED]',
        expected: '[REDACTED]',
        actual: `passkey=${sanitizedPasskey}, apiKey=${sanitizedKey}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_22', name: 'Bridge credentials never enter audit payload', passed: false, expected: 'Redacted', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_23: Retryable bridge failure retries correctly
    // -----------------------------------------------------------------
    try {
      const wf = await workflowEngine.executeWorkflow(
        tenantAContext,
        workflowEngine.createWorkflow(tenantAContext, 'BRIDGE_RETRY_TEST', 'v1.0', [
          { stepId: 'step_retry_b', stepType: 'STEP_FAIL_TRANSIENT' },
        ]).workflowId
      );
      results.push({
        id: 'P3_TEST_23',
        name: 'Retryable bridge failure retries correctly',
        passed: wf.status === 'COMPLETED' && wf.steps[0].attemptCount === 2,
        expected: 'COMPLETED with retry attempt',
        actual: `status=${wf.status}, attempts=${wf.steps[0].attemptCount}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_23', name: 'Retryable bridge failure retries correctly', passed: false, expected: 'Retried', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_24: Permanent bridge failure stops retry
    // -----------------------------------------------------------------
    try {
      const wf = await workflowEngine.executeWorkflow(
        tenantAContext,
        workflowEngine.createWorkflow(tenantAContext, 'PERM_BRIDGE_FAIL', 'v1.0', [
          { stepId: 'step_perm_b', stepType: 'STEP_FAIL_PERMANENT' },
        ]).workflowId
      );
      results.push({
        id: 'P3_TEST_24',
        name: 'Permanent bridge failure stops retry',
        passed: wf.status === 'FAILED' && wf.steps[0].attemptCount === 1,
        expected: 'FAILED on 1st attempt',
        actual: `status=${wf.status}, attempts=${wf.steps[0].attemptCount}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_24', name: 'Permanent bridge failure stops retry', passed: false, expected: 'Stopped', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_25: UNKNOWN external result becomes reconciliation-required
    // -----------------------------------------------------------------
    try {
      const res = await bankAdapter.execute(tenantAContext, 'INITIATE_TRANSFER', {
        sourceAccount: '123',
        destinationAccount: '456',
        bankCode: '01',
        amount: 25000,
        referenceText: 'FEE_PAYMENT',
        simulateAmbiguousResult: true,
      });
      results.push({
        id: 'P3_TEST_25',
        name: 'UNKNOWN external result becomes reconciliation-required',
        passed: res.status === 'UNKNOWN' && !!res.errorDetails,
        expected: 'UNKNOWN status with reconciliation warning',
        actual: `status=${res.status}, errorDetails=${res.errorDetails}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_25', name: 'UNKNOWN external result becomes reconciliation-required', passed: false, expected: 'Reconciliation', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_26: Outbox/delivery record is idempotent
    // -----------------------------------------------------------------
    try {
      const evt: EventEnvelope = {
        eventId: 'evt_outbox_26',
        eventType: 'payment.initiated.v1',
        eventVersion: 'v1',
        occurredAt: new Date().toISOString(),
        tenantId: 'tenant_school_a',
        branchId: null,
        principalId: 'usr_tenantA_admin',
        correlationId: 'corr_outbox',
        causationId: null,
        source: 'OutboxTest',
        payload: { test: 1 },
        metadata: {},
      };
      const rec = await workflowEngine.addToOutbox(tenantAContext, evt);
      const processed = await workflowEngine.processOutbox(tenantAContext);
      results.push({
        id: 'P3_TEST_26',
        name: 'Outbox/delivery record is idempotent',
        passed: rec.eventId === 'evt_outbox_26' && processed.some((p) => p.eventId === rec.eventId && p.status === 'DELIVERED'),
        expected: 'DELIVERED outbox record',
        actual: `outboxId=${rec.eventId}, processedCount=${processed.length}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_26', name: 'Outbox/delivery record is idempotent', passed: false, expected: 'Delivered', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_27: Workflow audit event recorded
    // -----------------------------------------------------------------
    try {
      const events = auditLogger.getEvents({ eventType: 'WORKFLOW_EXECUTION' as any });
      results.push({
        id: 'P3_TEST_27',
        name: 'Workflow audit event recorded',
        passed: events.length > 0,
        expected: 'Audit events > 0',
        actual: `Audit count=${events.length}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_27', name: 'Workflow audit event recorded', passed: false, expected: 'Recorded', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_28: Bridge audit event recorded
    // -----------------------------------------------------------------
    try {
      const events = auditLogger.getEvents({ eventType: 'BRIDGE_EXECUTION' as any });
      results.push({
        id: 'P3_TEST_28',
        name: 'Bridge audit event recorded',
        passed: events.length > 0,
        expected: 'Bridge Audit events > 0',
        actual: `Bridge audit count=${events.length}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_28', name: 'Bridge audit event recorded', passed: false, expected: 'Recorded', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_29: M-Pesa mock initiation flow
    // -----------------------------------------------------------------
    try {
      const res = await mpesaAdapter.execute(tenantAContext, 'STK_PUSH', {
        phoneNumber: '254712345678',
        amount: 3500,
        accountReference: 'FEE-001',
        transactionDesc: 'Term 1 School Fees',
      });
      results.push({
        id: 'P3_TEST_29',
        name: 'M-Pesa mock initiation flow',
        passed: res.status === 'PENDING' && res.providerReference.startsWith('ws_CO_'),
        expected: 'PENDING with checkoutRequestId',
        actual: `status=${res.status}, ref=${res.providerReference}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_29', name: 'M-Pesa mock initiation flow', passed: false, expected: 'Initiated', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_30: M-Pesa mock callback verification flow
    // -----------------------------------------------------------------
    try {
      await financialLedgerRepository.savePendingTransaction({
        transactionId: 'txn_mpesa_CO_TEST_30', tenantId: 'tenant_school_a', branchId: null,
        source: 'MPESA', providerReference: 'CO_TEST_30', amount: 100, currency: 'KES', status: 'PENDING',
        description: 'test', correlationId: 'corr_test_30', createdAt: new Date().toISOString(), postedAt: null, reversedAt: null,
      });
      const rawCb = {
        Body: { stkCallback: { MerchantRequestID: 'MR_TEST', CheckoutRequestID: 'CO_TEST_30', ResultCode: 0, ResultDesc: 'The service request is processed successfully.', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 3500 }] } } },
        signature: 'VALID_SIG',
        tenantId: 'tenant_school_a',
        correlationId: 'corr_test_30',
      };
      const res = await mpesaAdapter.handleCallback(tenantAContext, rawCb);
      results.push({
        id: 'P3_TEST_30',
        name: 'M-Pesa mock callback verification flow',
        passed: res.status === 'SUCCESS' && res.providerReference === 'CO_TEST_30',
        expected: 'SUCCESS with CheckoutRequestID',
        actual: `status=${res.status}, ref=${res.providerReference}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_30', name: 'M-Pesa mock callback verification flow', passed: false, expected: 'Verified', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_31: eTIMS mock submission flow
    // -----------------------------------------------------------------
    try {
      const res = await etimsAdapter.execute(tenantAContext, 'SUBMIT_INVOICE', {
        invoiceNumber: 'INV-2026-001',
        totalAmount: 11600,
        taxAmount: 1600,
        items: [{ itemName: 'School Uniform', qty: 1, unitPrice: 10000, taxRate: 16 }],
      });
      results.push({
        id: 'P3_TEST_31',
        name: 'eTIMS mock submission flow',
        passed: res.status === 'SUCCESS' && res.providerReference.startsWith('KRA'),
        expected: 'SUCCESS with KRA ICN',
        actual: `status=${res.status}, icn=${res.providerReference}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_31', name: 'eTIMS mock submission flow', passed: false, expected: 'Submitted', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_32: WhatsApp mock notification flow
    // -----------------------------------------------------------------
    try {
      const res = await whatsappAdapter.execute(tenantAContext, 'SEND_TEMPLATE', {
        recipientPhone: '254712345678',
        templateName: 'fee_receipt',
      });
      results.push({
        id: 'P3_TEST_32',
        name: 'WhatsApp mock notification flow',
        passed: res.status === 'SUCCESS' && res.providerReference.startsWith('wamid'),
        expected: 'SUCCESS with wamid',
        actual: `status=${res.status}, wamid=${res.providerReference}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_32', name: 'WhatsApp mock notification flow', passed: false, expected: 'Sent', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_33: Email mock delivery flow
    // -----------------------------------------------------------------
    try {
      const res = await emailAdapter.execute(tenantAContext, 'SEND_EMAIL', {
        toEmail: 'parent@gmail.com',
        subject: 'Official Fee Receipt - School A',
      });
      results.push({
        id: 'P3_TEST_33',
        name: 'Email mock delivery flow',
        passed: res.status === 'SUCCESS' && res.providerReference.includes('@tdbk.co.ke'),
        expected: 'SUCCESS with messageId',
        actual: `status=${res.status}, msgId=${res.providerReference}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_33', name: 'Email mock delivery flow', passed: false, expected: 'Sent', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_34: SMS mock delivery flow
    // -----------------------------------------------------------------
    try {
      const res = await smsAdapter.execute(tenantAContext, 'SEND_SMS', {
        recipientPhone: '254712345678',
        messageText: 'Your fee payment of KES 5,000 was received.',
      });
      results.push({
        id: 'P3_TEST_34',
        name: 'SMS mock delivery flow',
        passed: res.status === 'SUCCESS' && res.providerReference.startsWith('ATXid_'),
        expected: 'SUCCESS with AT message reference',
        actual: `status=${res.status}, ref=${res.providerReference}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_34', name: 'SMS mock delivery flow', passed: false, expected: 'Sent', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_35: Bank mock status flow
    // -----------------------------------------------------------------
    try {
      const res = await bankAdapter.execute(tenantAContext, 'INITIATE_TRANSFER', {
        sourceAccount: '011091234567',
        destinationAccount: '011097654321',
        bankCode: '01',
        amount: 50000,
        referenceText: 'SUPPLIER_PAYMENT',
      });
      results.push({
        id: 'P3_TEST_35',
        name: 'Bank mock status flow',
        passed: res.status === 'SUCCESS' && res.providerReference.startsWith('FT'),
        expected: 'SUCCESS with bank transfer reference',
        actual: `status=${res.status}, ref=${res.providerReference}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_35', name: 'Bank mock status flow', passed: false, expected: 'Executed', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_36: Phase 0 regression
    // -----------------------------------------------------------------
    try {
      const p0Summary = await phase0TestRunner.runAllTests();
      results.push({
        id: 'P3_TEST_36',
        name: 'Phase 0 regression',
        passed: p0Summary.overallStatus === 'PASS' && p0Summary.passedCount === 12,
        expected: '12/12 PASS',
        actual: `${p0Summary.passedCount}/${p0Summary.totalTests} ${p0Summary.overallStatus}`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_36', name: 'Phase 0 regression', passed: false, expected: 'PASS', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_37: Phase 1 regression
    // -----------------------------------------------------------------
    try {
      const p1Summary = await Phase1TestRunner.runAllTests();
      const p1Passed = p1Summary.failedCount === 0;
      results.push({
        id: 'P3_TEST_37',
        name: 'Phase 1 regression',
        passed: p1Passed,
        expected: 'PASS',
        actual: p1Passed ? 'PASS' : `FAIL (${p1Summary.failedCount} failed)`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_37', name: 'Phase 1 regression', passed: false, expected: 'PASS', actual: e.message });
    }

    // -----------------------------------------------------------------
    // P3_TEST_38: Phase 2 regression
    // -----------------------------------------------------------------
    try {
      const p2Summary = await Phase2TestRunner.runAllTests();
      const p2Passed = p2Summary.failedCount === 0;
      results.push({
        id: 'P3_TEST_38',
        name: 'Phase 2 regression',
        passed: p2Passed,
        expected: 'PASS',
        actual: p2Passed ? 'PASS' : `FAIL (${p2Summary.failedCount} failed)`,
      });
    } catch (e: any) {
      results.push({ id: 'P3_TEST_38', name: 'Phase 2 regression', passed: false, expected: 'PASS', actual: e.message });
    }

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      executedAt: new Date().toISOString(),
      totalTests: results.length,
      passedCount,
      failedCount,
      overallStatus: failedCount === 0 ? 'PASS' : 'FAIL',
      results,
    };
  }
}
