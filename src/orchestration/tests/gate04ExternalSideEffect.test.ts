import { beforeEach, describe, expect, it } from 'vitest';
import { deriveProviderOperationIdentity } from '../bridge/providerOperationIdentity';
import { MpesaBridge } from '../bridge/adapters/mpesaBridge';
import { BankBridge } from '../bridge/adapters/bankBridge';
import { EmailBridge } from '../bridge/adapters/emailBridge';
import { EtimsBridge } from '../bridge/adapters/etimsBridge';
import { SmsBridge } from '../bridge/adapters/smsBridge';
import { WhatsappBridge } from '../bridge/adapters/whatsappBridge';
import { bridgeRegistry } from '../bridge/registry';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { workflowStepExecutionRepository } from '../../persistence/firestore/repositories/workflowStepExecutionRepository';
import { workflowEngine } from '../workflow/engine';

describe('Gate 04 — external side-effect identity and mapping', () => {
  const tenantId = 'tenant_gate04_identity';

  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('derives the same provider identity for the same execution and operation', () => {
    expect(deriveProviderOperationIdentity('exec_01', 'STK_PUSH'))
      .toBe(deriveProviderOperationIdentity('exec_01', 'STK_PUSH'));
  });

  it('derives different provider identities for different execution identities', () => {
    expect(deriveProviderOperationIdentity('exec_01', 'STK_PUSH'))
      .not.toBe(deriveProviderOperationIdentity('exec_02', 'STK_PUSH'));
  });

  it('does not depend on worker, attempt, time, or randomness inputs', () => {
    const identity = deriveProviderOperationIdentity('exec_stable', 'INITIATE_TRANSFER');
    expect(identity).toBe(deriveProviderOperationIdentity('exec_stable', 'INITIATE_TRANSFER'));
  });

  it('declares provider side-effect capabilities consistently at adapter and registry boundaries', () => {
    const bridges = [
      [new MpesaBridge(), 'bridge_mpesa'],
      [new BankBridge(), 'bridge_bank'],
      [new EmailBridge(), 'bridge_email'],
      [new EtimsBridge(), 'bridge_etims'],
      [new SmsBridge(), 'bridge_sms'],
      [new WhatsappBridge(), 'bridge_whatsapp'],
    ] as const;

    for (const [adapter, bridgeId] of bridges) {
      const registered = bridgeRegistry.getBridgeDefinition(bridgeId)?.sideEffectCapabilities;
      expect(registered).toBeDefined();
      expect(registered).toMatchObject(adapter.sideEffectCapabilities);
      expect(registered?.automaticUnknownReplay).toBe(false);
      expect(registered?.providerOperationIdentityRequired).toBe(true);
    }

    expect(bridgeRegistry.getBridgeDefinition('bridge_mpesa')?.sideEffectCapabilities).toEqual({
      providerIdempotency: false,
      providerReconciliation: true,
      automaticUnknownReplay: false,
      providerOperationIdentityRequired: true,
    });

    for (const bridgeId of ['bridge_bank', 'bridge_email', 'bridge_sms', 'bridge_whatsapp']) {
      expect(bridgeRegistry.getBridgeDefinition(bridgeId)?.sideEffectCapabilities).toEqual({
        providerIdempotency: false,
        providerReconciliation: false,
        automaticUnknownReplay: false,
        providerOperationIdentityRequired: true,
      });
    }
  });

  it('normalizes legacy registry definitions to conservative Gate 04 defaults', () => {
    const context = {
      principal: { id: 'master_gate04', tenantId: null, isMaster: true },
      requestId: 'req_gate04_registry',
    } as any;

    const registered = bridgeRegistry.registerBridgeDefinition(context, {
      bridgeId: 'bridge_gate04_legacy',
      provider: 'TEST_PROVIDER',
      bridgeVersion: 'v1.0',
      capabilityId: 'test_provider',
      supportedOperations: ['SEND'],
      status: 'MOCK',
      configurationRequirements: [],
      healthStatus: 'UNAVAILABLE',
      registeredAt: new Date().toISOString(),
      sideEffectCapabilities: { providerIdempotency: false, providerReconciliation: false },
    });

    expect(registered.sideEffectCapabilities).toEqual({
      providerIdempotency: false,
      providerReconciliation: false,
      automaticUnknownReplay: false,
      providerOperationIdentityRequired: true,
    });
  });

  it('durably associates provider operation and reference with the canonical execution', async () => {
    const executionKey = 'exec_provider_mapping_01';
    const claimed = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_gate04', 'step_payment', executionKey, 'worker_a', 300000
    );
    expect(claimed?.executionKey).toBe(executionKey);

    const providerOperationIdentity = deriveProviderOperationIdentity(executionKey, 'STK_PUSH');
    await workflowStepExecutionRepository.bindProviderOperation(
      tenantId,
      executionKey,
      'worker_a',
      {
        operation: 'STK_PUSH',
        providerOperationIdentity,
        providerName: 'SAFARICOM_MPESA',
        providerReference: 'CO_GATE04_01',
        providerIdempotencySupported: false,
        providerReconciliationSupported: true,
        outcomeState: 'PROVIDER_ACCEPTED',
      }
    );

    const recovered = await workflowStepExecutionRepository.getExecution(tenantId, executionKey);
    expect(recovered?.providerOperationIdentity).toBe(providerOperationIdentity);
    expect(recovered?.providerReference).toBe('CO_GATE04_01');
    expect(recovered?.providerName).toBe('SAFARICOM_MPESA');
    expect(recovered?.outcomeState).toBe('PROVIDER_ACCEPTED');
  });

  it('preserves the provider mapping when the same execution is reclaimed', async () => {
    const executionKey = 'exec_provider_reclaim_01';
    await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_gate04', 'step_payment', executionKey, 'worker_a', 1
    );
    const providerOperationIdentity = deriveProviderOperationIdentity(executionKey, 'INITIATE_TRANSFER');
    await workflowStepExecutionRepository.bindProviderOperation(
      tenantId,
      executionKey,
      'worker_a',
      {
        operation: 'INITIATE_TRANSFER',
        providerOperationIdentity,
        providerName: 'GENERIC_BANK',
        providerReference: 'FT_GATE04_01',
        providerIdempotencySupported: false,
        providerReconciliationSupported: false,
        outcomeState: 'UNKNOWN_OUTCOME',
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 5));
    const reclaimed = await workflowStepExecutionRepository.claimExecution(
      tenantId, 'wf_gate04', 'step_payment', executionKey, 'worker_b', 300000
    );

    expect(reclaimed?.executionKey).toBe(executionKey);
    expect(reclaimed?.providerOperationIdentity).toBe(providerOperationIdentity);
    expect(reclaimed?.providerReference).toBe('FT_GATE04_01');
    expect(reclaimed?.outcomeState).toBe('UNKNOWN_OUTCOME');
  });

  it('binds before the provider call and prevents local success from clearing UNKNOWN', async () => {
    const context = {
      principal: { id: 'usr_gate04', tenantId, branchId: null, isMaster: false },
      tenantContext: { tenantId },
      branchContext: { branchId: null },
      requestId: 'req_gate04_execution',
      correlationId: 'corr_gate04_execution',
    } as any;

    workflowEngine.clearStoreForTesting();
    workflowEngine.registerStepHandler('GATE04_UNKNOWN_SIDE_EFFECT', async (ctx) => {
      const binding = await ctx.prepareExternalSideEffect({
        operation: 'INITIATE_TRANSFER',
        providerName: 'GENERIC_BANK',
        providerIdempotencySupported: false,
        providerReconciliationSupported: false,
      });

      expect(binding.providerOperationIdentity).toBe(
        deriveProviderOperationIdentity(ctx.executionKey, 'INITIATE_TRANSFER')
      );

      await ctx.recordExternalSideEffectOutcome({
        providerReference: 'FT_UNKNOWN_01',
        outcomeState: 'UNKNOWN_OUTCOME',
      });

      return { success: true, output: { locallyCompleted: true } };
    });

    const workflow = workflowEngine.createWorkflow(
      context,
      'GATE04_UNKNOWN_TEST',
      'v1.0',
      [{ stepId: 'step_unknown', stepType: 'GATE04_UNKNOWN_SIDE_EFFECT' }]
    );

    const result = await workflowEngine.executeWorkflow(context, workflow.workflowId);
    const execution = await workflowStepExecutionRepository.getExecution(
      tenantId,
      result.steps[0].executionKey!
    );

    expect(result.status).toBe('WAITING');
    expect(result.steps[0].status).toBe('WAITING');
    expect(execution?.outcomeState).toBe('UNKNOWN_OUTCOME');
    expect(execution?.providerReference).toBe('FT_UNKNOWN_01');
  });

  it('parks an ambiguous provider exception as UNKNOWN instead of retrying a non-idempotent side effect', async () => {
    const context = {
      principal: { id: 'usr_gate04_ambiguous', tenantId, branchId: null, isMaster: false },
      tenantContext: { tenantId },
      branchContext: { branchId: null },
      requestId: 'req_gate04_ambiguous',
      correlationId: 'corr_gate04_ambiguous',
    } as any;

    workflowEngine.clearStoreForTesting();
    let handlerCalls = 0;

    workflowEngine.registerStepHandler('GATE04_AMBIGUOUS_THROW', async (ctx) => {
      handlerCalls += 1;
      await ctx.prepareExternalSideEffect({
        operation: 'INITIATE_TRANSFER',
        providerName: 'GENERIC_BANK',
        providerIdempotencySupported: false,
        providerReconciliationSupported: false,
      });

      throw new Error('network timeout after provider accepted request');
    });

    const workflow = workflowEngine.createWorkflow(
      context,
      'GATE04_AMBIGUOUS_THROW_TEST',
      'v1.0',
      [{
        stepId: 'step_ambiguous',
        stepType: 'GATE04_AMBIGUOUS_THROW',
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 0,
          timeoutMs: 5000,
          retryableErrors: ['TIMEOUT'],
        },
      }]
    );

    const result = await workflowEngine.executeWorkflow(context, workflow.workflowId);
    const execution = await workflowStepExecutionRepository.getExecution(
      tenantId,
      result.steps[0].executionKey!
    );

    expect(handlerCalls).toBe(1);
    expect(result.status).toBe('WAITING');
    expect(result.steps[0].status).toBe('WAITING');
    expect(result.steps[0].failureClassification).toBe('WAITING_FOR_EXTERNAL_RESULT');
    expect(execution?.outcomeState).toBe('UNKNOWN_OUTCOME');
    expect(execution?.providerIdempotencySupported).toBe(false);
    expect(execution?.providerReconciliationSupported).toBe(false);
  });

  it('rejects terminal outcome regression and provider identity mutation', async () => {
    const executionKey = 'exec_provider_state_machine_01';
    await workflowStepExecutionRepository.claimExecution(tenantId, 'wf_gate04', 'step_payment', executionKey, 'worker_a', 300000);
    const identity = deriveProviderOperationIdentity(executionKey, 'STK_PUSH');
    await workflowStepExecutionRepository.bindProviderOperation(tenantId, executionKey, 'worker_a', {
      operation: 'STK_PUSH', providerOperationIdentity: identity, providerName: 'SAFARICOM_MPESA',
      providerReference: 'CO_STATE_01', providerIdempotencySupported: false, providerReconciliationSupported: true,
      outcomeState: 'PROVIDER_ACCEPTED',
    });
    await expect(workflowStepExecutionRepository.bindProviderOperation(tenantId, executionKey, 'worker_a', {
      operation: 'STK_PUSH', providerOperationIdentity: identity, providerName: 'SAFARICOM_MPESA',
      providerReference: 'CO_STATE_01', providerIdempotencySupported: false, providerReconciliationSupported: true,
      outcomeState: 'UNKNOWN_OUTCOME',
    })).rejects.toThrow('Invalid external side-effect outcome transition');
    await expect(workflowStepExecutionRepository.bindProviderOperation(tenantId, executionKey, 'worker_a', {
      operation: 'STK_PUSH', providerOperationIdentity: 'forged-provider-operation', providerName: 'SAFARICOM_MPESA',
      providerReference: 'CO_STATE_01', providerIdempotencySupported: false, providerReconciliationSupported: true,
      outcomeState: 'PROVIDER_ACCEPTED',
    })).rejects.toThrow('Provider operation identity cannot change');
  });

  it('requires reconciliation support before accepting a reconciled outcome', async () => {
    const executionKey = 'exec_provider_state_machine_02';
    await workflowStepExecutionRepository.claimExecution(tenantId, 'wf_gate04', 'step_payment', executionKey, 'worker_a', 300000);
    const identity = deriveProviderOperationIdentity(executionKey, 'INITIATE_TRANSFER');
    await expect(workflowStepExecutionRepository.bindProviderOperation(tenantId, executionKey, 'worker_a', {
      operation: 'INITIATE_TRANSFER', providerOperationIdentity: identity, providerName: 'GENERIC_BANK',
      providerReference: 'FT_STATE_02', providerIdempotencySupported: false, providerReconciliationSupported: false,
      outcomeState: 'RECONCILED_SUCCESS',
    })).rejects.toThrow('reconciled state without provider reconciliation support');
  });
});
