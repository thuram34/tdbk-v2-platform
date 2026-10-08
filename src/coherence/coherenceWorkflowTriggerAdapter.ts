import { createHash } from 'node:crypto';
import { SecurityContext } from '../kernel/types';
import type { EventEnvelope } from '../orchestration/events/types';
import type { EventHandler } from '../orchestration/events/types';
import { PLATFORM_WORKFLOW_CATALOG } from './moduleRegistry';
import { firestoreClient } from '../persistence/firestore/firestoreClient';
import { mpesaBridge } from '../orchestration/bridge/adapters/mpesaBridge';

/**
 * Authoritative coherence boundary:
 * Event -> catalog workflow trigger -> durable workflow instance.
 *
 * The catalog remains declarative for downstream business outcomes. This adapter
 * only creates the durable workflow instance and records the triggering event;
 * it does not fabricate downstream effects that do not yet have step handlers.
 */

const TRIGGER_STEP_TYPE = 'COHERENCE_WORKFLOW_TRIGGER';

function registerTriggerStepHandler(workflowEngineLike: { registerStepHandler: (stepType: string, handler: any) => void }): void {
  workflowEngineLike.registerStepHandler(TRIGGER_STEP_TYPE, async ({ input, workflow }) => {
    const triggerEventType = input.triggerEventType as string | undefined;
    const catalogWorkflowId = input.catalogWorkflowId as string | undefined;

    if (!triggerEventType || !catalogWorkflowId || workflow.workflowType !== catalogWorkflowId) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Coherence workflow trigger context is incomplete',
        failureClassification: 'PERMANENT',
      };
    }

    if (catalogWorkflowId === 'wf_pos_mpesa_payment') {
      const payload = (input.payload || {}) as Record<string, unknown>;
      const saleId = String(payload.saleId || '');
      const branchId = String(payload.branchId || workflow.branchId || '');
      const phoneNumber = String(payload.customerPhone || '');
      const amount = Number(payload.amountKes);
      if (!saleId || !branchId || !phoneNumber || !Number.isFinite(amount) || amount <= 0) {
        return { success: false, status: 'FAILED', error: 'POS M-Pesa payment trigger is missing authoritative sale, branch, phone, or amount', failureClassification: 'PERMANENT' };
      }
      const sale = await firestoreClient.get<Record<string, any>>(
        '/tenants/' + workflow.tenantId + '/entities/sales_counter/records/' + saleId,
      );
      if (!sale || sale.status !== 'COMPLETED' || sale.branchId !== branchId) {
        return { success: false, status: 'FAILED', error: 'Authoritative POS sale ' + saleId + ' is missing, incomplete, or belongs to another branch', failureClassification: 'PERMANENT' };
      }
      if (sale.attributes?.paymentMethod !== 'MPESA' || Number(sale.attributes?.totalAmountKes) !== amount) {
        return { success: false, status: 'FAILED', error: 'POS sale ' + saleId + ' does not reconcile with the requested M-Pesa payment', failureClassification: 'PERMANENT' };
      }
      const operation = await prepareExternalSideEffect({
        operation: 'STK_PUSH',
        providerName: 'SAFARICOM_MPESA',
        providerIdempotencySupported: false,
        providerReconciliationSupported: true,
      });
      const context = contextFromEvent({
        eventId: String(input.triggerEventId || workflow.workflowId),
        eventType: triggerEventType,
        eventVersion: 'v1',
        occurredAt: workflow.startedAt,
        tenantId: workflow.tenantId,
        branchId,
        principalId: String(workflow.metadata?.triggerPrincipalId || 'SYSTEM'),
        correlationId: workflow.correlationId,
        causationId: String(input.triggerEventId || workflow.workflowId),
        source: String(input.source || 'POS'),
        payload: {},
        metadata: {},
      });
      try {
        const providerResult = await mpesaBridge.execute(context, 'STK_PUSH', {
          phoneNumber,
          amount,
          accountReference: saleId,
          transactionDesc: 'TDBK POS sale ' + saleId,
        });
        await recordExternalSideEffectOutcome({
          providerReference: providerResult.providerReference,
          outcomeState: providerResult.status === 'PENDING' || providerResult.status === 'SUCCESS' ? 'PROVIDER_ACCEPTED' : 'PROVIDER_REJECTED',
        });
        return { success: true, status: 'COMPLETED', output: {
          operation: 'POS_MPESA_STK_PUSH', saleId, branchId, amountKes: amount,
          paymentStatus: providerResult.status, provider: providerResult.provider,
          providerReference: providerResult.providerReference,
          providerOperationIdentity: operation.providerOperationIdentity, confirmationRequired: true,
        } };
      } catch (error: any) {
        const initiation = await firestoreClient.get<any>('/tenants/' + workflow.tenantId + '/financialTransactions/mpesa_init_' + context.requestId);
        if (initiation?.status === 'RECONCILIATION_REQUIRED') {
          await recordExternalSideEffectOutcome({ providerReference: initiation.providerReference || null, outcomeState: 'RECONCILIATION_REQUIRED' });
          return { success: false, status: 'WAITING', error: 'M-Pesa provider accepted the request but local financial state requires reconciliation', failureClassification: 'WAITING_FOR_EXTERNAL_RESULT' };
        }
        await recordExternalSideEffectOutcome({ providerReference: initiation?.providerReference || null, outcomeState: 'PROVIDER_REJECTED' });
        return { success: false, status: 'FAILED', error: error?.message || 'M-Pesa STK initiation failed', failureClassification: 'PERMANENT' };
      }
    }
    if (catalogWorkflowId === 'wf_execute_checkout') {
      const payload = (input.payload || {}) as Record<string, unknown>;
      const saleId = String(payload.saleId || '');
      const branchId = String(payload.branchId || workflow.branchId || '');
      if (!saleId || !branchId) {
        return {
          success: false,
          status: 'FAILED',
          error: 'POS checkout trigger is missing authoritative saleId or branchId',
          failureClassification: 'PERMANENT',
        };
      }

      const sale = await firestoreClient.get<Record<string, any>>(
        `/tenants/${workflow.tenantId}/entities/sales_counter/records/${saleId}`,
      );
      if (!sale) {
        return {
          success: false,
          status: 'FAILED',
          error: `Authoritative sale '${saleId}' was not found`,
          failureClassification: 'PERMANENT',
        };
      }

      if (sale.status !== 'COMPLETED' || sale.branchId !== branchId) {
        return {
          success: false,
          status: 'FAILED',
          error: `Authoritative sale '${saleId}' is not completed in the triggering branch`,
          failureClassification: 'PERMANENT',
        };
      }

      const eventTotal = Number(payload.totalAmountKes);
      const persistedTotal = Number(sale.attributes?.totalAmountKes);
      if (!Number.isFinite(eventTotal) || eventTotal !== persistedTotal) {
        return {
          success: false,
          status: 'FAILED',
          error: `POS sale '${saleId}' total does not reconcile with persisted business truth`,
          failureClassification: 'PERMANENT',
        };
      }

      return {
        success: true,
        status: 'COMPLETED',
        output: {
          operation: 'POS_CHECKOUT',
          saleId,
          branchId,
          saleStatus: sale.status,
          totalAmountKes: persistedTotal,
          paymentStatus: sale.attributes?.paymentStatus || null,
          reconciledAgainstPersistedSale: true,
          reconciledAt: new Date().toISOString(),
        },
      };
    }

    return {
      success: true,
      status: 'COMPLETED',
      output: {
        triggerEventType,
        catalogWorkflowId,
        triggerRecordedAt: new Date().toISOString(),
      },
    };
  });

}

function contextFromEvent(event: EventEnvelope): SecurityContext {
  const tenantId = event.tenantId || (event.payload as any)?.dbkId;
  if (!tenantId) {
    throw new Error(`Cannot trigger coherence workflow '${event.eventType}' without tenant authority`);
  }

  return {
    requestId: event.causationId || event.eventId,
    correlationId: event.correlationId,
    timestamp: event.occurredAt,
    principal: {
      id: event.principalId || 'SYSTEM',
      isMaster: false,
      tenantId,
      branchId: event.branchId || null,
      roles: [],
      permissions: [],
      authTime: Math.floor(Date.parse(event.occurredAt) / 1000),
      tokenSource: 'SYSTEM',
    },
    tenantContext: {
      tenantId,
      name: tenantId,
      status: 'ACTIVE',
    },
    branchContext: event.branchId ? { branchId: event.branchId } : null,
    ipAddress: '127.0.0.1',
    userAgent: 'TDBK-CoherenceWorkflowTriggerAdapter',
  };
}

export async function triggerCatalogWorkflowFromEvent(event: EventEnvelope): Promise<void> {
  const { workflowEngine } = await import('../orchestration/workflow/engine');
  const definition = PLATFORM_WORKFLOW_CATALOG.find((workflow) => workflow.triggerEvent === event.eventType);
  if (!definition) return;

  const tenantId = event.tenantId || (event.payload as any)?.dbkId;
  if (!tenantId) {
    throw new Error(`Workflow trigger rejected: event '${event.eventType}' has no authoritative tenant`);
  }

  const context = contextFromEvent(event);
  const workflowId = `coh_${createHash('sha256').update(`${tenantId}:${definition.workflowId}:${event.eventId}`).digest('hex').slice(0, 48)}`;

  const workflow = await workflowEngine.createPersistentWorkflow(
    context,
    definition.workflowId,
    'v1',
    [
      {
        stepId: `trigger_${definition.workflowId}`,
        stepType: TRIGGER_STEP_TYPE,
        input: {
          catalogWorkflowId: definition.workflowId,
          triggerEventType: definition.triggerEvent,
          triggerEventId: event.eventId,
          source: event.source,
          payload: event.payload,
        },
      },
    ],
    {
      triggerEventId: event.eventId,
      triggerEventType: event.eventType,
      triggerSource: event.source,
      catalogWorkflowId: definition.workflowId,
      catalogModuleId: definition.moduleId,
      catalogCapabilityId: definition.capabilityId,
      downstreamOutcomes: definition.downstreamOutcomes,
    },
    workflowId,
  );

  await workflowEngine.executeWorkflow(context, workflow.workflowId);
}

export function registerCoherenceWorkflowTriggerSubscriptions(
  eventBusLike: { subscribe: (eventType: string, handler: EventHandler) => void },
): void {
  // The handler is registered lazily after the EventBus is initialized to avoid a module cycle.
  void import('../orchestration/workflow/engine').then(({ workflowEngine }) => registerTriggerStepHandler(workflowEngine));

  const triggerEvents = [...new Set(PLATFORM_WORKFLOW_CATALOG.map((workflow) => workflow.triggerEvent))];
  for (const eventType of triggerEvents) {
    eventBusLike.subscribe(eventType, triggerCatalogWorkflowFromEvent);
  }
}
