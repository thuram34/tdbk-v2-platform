import { createHash } from 'node:crypto';
import { SecurityContext } from '../kernel/types';
import type { EventEnvelope } from '../orchestration/events/types';
import type { EventHandler } from '../orchestration/events/types';
import { PLATFORM_WORKFLOW_CATALOG } from './moduleRegistry';
import { firestoreClient } from '../persistence/firestore/firestoreClient';

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
