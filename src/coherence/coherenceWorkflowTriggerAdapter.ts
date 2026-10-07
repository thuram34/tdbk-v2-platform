import { SecurityContext } from '../kernel/types';
import { eventBus } from '../orchestration/events/eventBus';
import { workflowEngine } from '../orchestration/workflow/engine';
import { PLATFORM_WORKFLOW_CATALOG } from './moduleRegistry';
import { EventEnvelope } from '../orchestration/events/types';

/**
 * Authoritative coherence boundary:
 * Event -> catalog workflow trigger -> durable workflow instance.
 *
 * The catalog remains declarative for downstream business outcomes. This adapter
 * only creates the durable workflow instance and records the triggering event;
 * it does not fabricate downstream effects that do not yet have step handlers.
 */

const TRIGGER_STEP_TYPE = 'COHERENCE_WORKFLOW_TRIGGER';

let stepHandlerRegistered = false;

function registerTriggerStepHandler(): void {
  if (stepHandlerRegistered) return;

  workflowEngine.registerStepHandler(TRIGGER_STEP_TYPE, async ({ input, workflow }) => {
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

  stepHandlerRegistered = true;
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
  registerTriggerStepHandler();

  const definition = PLATFORM_WORKFLOW_CATALOG.find((workflow) => workflow.triggerEvent === event.eventType);
  if (!definition) return;

  const tenantId = event.tenantId || (event.payload as any)?.dbkId;
  if (!tenantId) {
    throw new Error(`Workflow trigger rejected: event '${event.eventType}' has no authoritative tenant`);
  }

  const context = contextFromEvent(event);

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
  );

  await workflowEngine.executeWorkflow(context, workflow.workflowId);
}

export function registerCoherenceWorkflowTriggerSubscriptions(): void {
  registerTriggerStepHandler();

  const triggerEvents = [...new Set(PLATFORM_WORKFLOW_CATALOG.map((workflow) => workflow.triggerEvent))];
  for (const eventType of triggerEvents) {
    eventBus.subscribe(eventType, triggerCatalogWorkflowFromEvent);
  }
}
