/**
 * TDBK V2 WORKFLOW ENGINE & OUTBOX DELIVERY SYSTEM
 * Architectural Layer: LAYER 6 — WORKFLOW & EVENT ENGINE
 */

import {
  WorkflowInstance,
  WorkflowStep,
  StepHandler,
} from './types';
import type { OutboxRecord } from '../../persistence/types';
import { SecurityContext } from '../../kernel/types';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { eventBus } from '../events/eventBus';
import { EventEnvelope } from '../events/types';
import { workflowInstanceRepository } from '../../persistence/firestore/repositories/workflowInstanceRepository';
import { workflowStepExecutionRepository } from '../../persistence/firestore/repositories/workflowStepExecutionRepository';
import { outboxEngine } from '../outbox/outboxEngine';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';

class WorkflowEngineService {
  private workflows: Map<string, WorkflowInstance> = new Map();
  private stepHandlers: Map<string, StepHandler> = new Map();

  /**
   * Registers a step handler for a specific step type.
   */
  public registerStepHandler(stepType: string, handler: StepHandler): void {
    this.stepHandlers.set(stepType, handler);
  }

  /**
   * Initializes a new Workflow Instance bound to a tenant context.
   */
  public createWorkflow(
    context: SecurityContext,
    workflowType: string,
    workflowVersion: string,
    stepDefinitions: Array<{
      stepId: string;
      stepType: string;
      input?: Record<string, unknown>;
      retryPolicy?: {
        maxAttempts: number;
        backoffMs: number;
        timeoutMs: number;
        retryableErrors: string[];
      };
      compensationStepId?: string;
    }>,
    metadata: Record<string, unknown> = {},
    publishLifecycleEvent: boolean = true
  ): WorkflowInstance {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) {
      throw new KernelError(
        'TENANT_ISOLATION_ERROR',
        'Workflow Initialization Denied: Security Context lacks authoritative Tenant Context',
        403,
        context.requestId
      );
    }

    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const steps: WorkflowStep[] = stepDefinitions.map((s) => ({
      stepId: s.stepId,
      stepType: s.stepType,
      status: 'PENDING',
      attemptCount: 0,
      retryPolicy: s.retryPolicy || {
        maxAttempts: 3,
        backoffMs: 100,
        timeoutMs: 5000,
        retryableErrors: ['TRANSIENT_NETWORK', 'TIMEOUT', 'PROVIDER_BUSY'],
      },
      input: s.input || {},
      output: null,
      startedAt: null,
      completedAt: null,
      error: null,
      compensationStepId: s.compensationStepId,
      executionKey: undefined,
    }));

    const workflow: WorkflowInstance = {
      workflowId,
      workflowType,
      workflowVersion,
      tenantId,
      branchId: context.branchContext?.branchId || context.principal.branchId || null,
      status: 'PENDING',
      currentStepIndex: 0,
      steps,
      correlationId: context.correlationId || `corr_${workflowId}`,
      startedAt: new Date().toISOString(),
      completedAt: null,
      failureReason: null,
      metadata,
    };

    this.workflows.set(workflowId, workflow);

    // Audit Log
    auditLogger.logEvent(
      'WORKFLOW_EXECUTION',
      context.principal.id,
      'WORKFLOW_STARTED',
      `workflow:${workflowId}`,
      'ALLOWED',
      {
        tenantId,
        requestId: context.requestId,
        details: {
          workflowType,
          workflowVersion,
          correlationId: workflow.correlationId,
          totalSteps: steps.length,
        },
      }
    );

    // Publish event
    const eventEnvelope: EventEnvelope = {
      eventId: `evt_${workflowId}_started`,
      eventType: 'workflow.started.v1',
      eventVersion: 'v1',
      occurredAt: workflow.startedAt,
      tenantId,
      branchId: workflow.branchId,
      principalId: context.principal.id,
      correlationId: workflow.correlationId,
      causationId: null,
      source: 'WorkflowEngine',
      payload: { workflowId, workflowType, workflowVersion },
      metadata,
    };

    if (publishLifecycleEvent) {
      void eventBus.publish(eventEnvelope);
    }

    return workflow;
  }

  /** Creates and durably persists a workflow instance. */
  public async createPersistentWorkflow(
    context: SecurityContext,
    workflowType: string,
    workflowVersion: string,
    stepDefinitions: Array<{
      stepId: string;
      stepType: string;
      input?: Record<string, unknown>;
      retryPolicy?: { maxAttempts: number; backoffMs: number; timeoutMs: number; retryableErrors: string[] };
      compensationStepId?: string;
    }>,
    metadata: Record<string, unknown> = {}
  ): Promise<WorkflowInstance> {
    // Durable creation must commit business state before publishing its lifecycle signal.
    const workflow = this.createWorkflow(context, workflowType, workflowVersion, stepDefinitions, metadata, false);
    const startedEnvelope: EventEnvelope = {
      eventId: `evt_${workflow.workflowId}_started`,
      eventType: 'workflow.started.v1',
      eventVersion: 'v1',
      occurredAt: workflow.startedAt,
      tenantId: workflow.tenantId,
      branchId: workflow.branchId,
      principalId: context.principal.id,
      correlationId: workflow.correlationId,
      causationId: null,
      source: 'WorkflowEngine',
      payload: { workflowId: workflow.workflowId, workflowType, workflowVersion },
      metadata: workflow.metadata,
    };

    const startedRecord: OutboxRecord = {
      eventId: startedEnvelope.eventId, tenantId: workflow.tenantId, branchId: workflow.branchId,
      eventType: startedEnvelope.eventType, eventVersion: startedEnvelope.eventVersion,
      occurredAt: startedEnvelope.occurredAt, correlationId: startedEnvelope.correlationId,
      causationId: startedEnvelope.causationId, source: startedEnvelope.source, payload: startedEnvelope.payload,
      status: 'PENDING', attemptCount: 0, availableAt: workflow.startedAt, createdAt: workflow.startedAt,
      updatedAt: workflow.startedAt, leaseOwner: null, leaseUntil: null, lastError: null, deliveredAt: null,
    };
    await workflowInstanceRepository.saveWorkflowWithOutbox(workflow.tenantId, workflow.workflowId, workflow, startedRecord);
    await eventBus.publish(startedEnvelope);
    return workflow;
  }

  /**
   * Rehydrates and resumes all non-terminal workflows for a tenant after a
   * process restart. Durable Firestore state is the recovery source; the
   * in-memory workflow map is only repopulated as a cache.
   */
  public async recoverTenantWorkflows(context: SecurityContext): Promise<WorkflowInstance[]> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) {
      throw new KernelError(
        'TENANT_ISOLATION_ERROR',
        'Workflow Recovery Denied: Missing Tenant Context',
        403,
        context.requestId
      );
    }

    const durableWorkflows = await workflowInstanceRepository.listWorkflows(tenantId);
    const recoverable = durableWorkflows.filter(
      (workflow) => workflow.status === 'RUNNING' || workflow.status === 'WAITING' || workflow.status === 'PENDING'
    );

    const recovered: WorkflowInstance[] = [];
    for (const workflow of recoverable) {
      // Recovery is itself an authorized action. A branch-scoped principal may
      // only resume workflows belonging to that same durable branch; otherwise
      // a tenant-wide scan could accidentally attempt another branch's work.
      if (!context.principal.isMaster && workflow.branchId) {
        const requestBranch = context.branchContext?.branchId || context.principal.branchId || null;
        if (requestBranch !== workflow.branchId) continue;
      }
      // Hydrate first so a fresh process can resume without prior cache state.
      this.workflows.set(workflow.workflowId, workflow);
      recovered.push(await this.executeWorkflow(context, workflow.workflowId));
    }

    return recovered;
  }

  private buildLifecycleOutboxRecord(envelope: EventEnvelope): OutboxRecord {
    const now = new Date().toISOString();
    return {
      eventId: envelope.eventId,
      tenantId: envelope.tenantId,
      branchId: envelope.branchId,
      eventType: envelope.eventType,
      eventVersion: envelope.eventVersion,
      occurredAt: envelope.occurredAt,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId || null,
      source: envelope.source,
      payload: envelope.payload,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: now,
      createdAt: now,
      updatedAt: now,
      leaseOwner: null,
      leaseUntil: null,
      lastError: null,
      deliveredAt: null,
    };
  }

  /**
   * Executes or resumes a workflow instance step by step.
   */
  public async executeWorkflow(
    context: SecurityContext,
    workflowId: string
  ): Promise<WorkflowInstance> {
    const requestTenant = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!requestTenant) {
      throw new KernelError(
        'TENANT_ISOLATION_ERROR',
        'Workflow Execution Denied: Security Context lacks authoritative Tenant Context',
        403,
        context.requestId
      );
    }

    // Production execution is Firestore-authoritative. The in-memory map remains
    // a hot cache and test/runtime compatibility layer, but a restart must not
    // make a durable workflow disappear.
    const durableWorkflow = await workflowInstanceRepository.getWorkflow(requestTenant, workflowId);
    let workflow = durableWorkflow ?? this.workflows.get(workflowId);
    if (workflow) this.workflows.set(workflowId, workflow);

    if (!workflow) {
      throw new KernelError(
        'NOT_FOUND',
        `Workflow Instance '${workflowId}' not found`,
        404,
        context.requestId
      );
    }

    // Verify tenant isolation
    if (workflow.tenantId !== requestTenant && !context.principal.isMaster) {
      auditLogger.logEvent(
        'TENANT_ISOLATION_VIOLATION',
        context.principal.id,
        'EXECUTE_WORKFLOW',
        `workflow:${workflowId}`,
        'DENIED',
        {
          tenantId: requestTenant,
          requestId: context.requestId,
          details: { targetWorkflowTenant: workflow.tenantId },
        }
      );
      throw new KernelError(
        'TENANT_ISOLATION_ERROR',
        `Tenant Isolation Violation: Principal from '${requestTenant}' cannot execute workflow for tenant '${workflow.tenantId}'`,
        403,
        context.requestId
      );
    }

    if (workflow.status === 'COMPLETED' || workflow.status === 'CANCELLED') {
      return workflow;
    }

    // A workflow is branch-scoped business state. Non-master execution must use
    // the same authoritative branch context; a missing branch context cannot
    // silently become permission to execute another branch's workflow.
    if (!context.principal.isMaster && workflow.branchId) {
      const requestBranch = context.branchContext?.branchId || context.principal.branchId || null;
      if (requestBranch !== workflow.branchId) {
        auditLogger.logEvent(
          'TENANT_ISOLATION_VIOLATION',
          context.principal.id,
          'EXECUTE_WORKFLOW_CROSS_BRANCH',
          'workflow:' + workflowId,
          'DENIED',
          { tenantId: requestTenant, requestId: context.requestId, details: { targetWorkflowBranch: workflow.branchId, requestBranch } }
        );
        throw new KernelError(
          'AUTHORIZATION_ERROR',
          'Branch Authorization Violation: Principal cannot execute workflow for branch ' + workflow.branchId,
          403,
          context.requestId
        );
      }
    }

    const workerId = 'workflow-' + context.principal.id + '-' + context.requestId;
    const durableExecution = durableWorkflow
      ? await workflowInstanceRepository.claimExecutionLease(workflow.tenantId, workflow.workflowId, workerId, 300000)
      : workflow;
    if (!durableExecution) {
      throw new KernelError('CONFLICT', 'Workflow is currently executing', 409, context.requestId);
    }
    workflow = durableExecution;
    this.workflows.set(workflow.workflowId, workflow);

    workflow.status = 'RUNNING';
      await workflowInstanceRepository.saveWorkflow(workflow.tenantId, workflow.workflowId, workflow, workerId);

      // Keep long-running workflows from losing their durable execution lease while
      // an external provider/step is still executing. The lease remains owned by
      // this worker; if renewal fails, subsequent durable writes will be rejected.
      const leaseDurationMs = 300000;
      const leaseHeartbeatMs = 60000;
      let leaseLost = false;
      const leaseHeartbeat = durableWorkflow
        ? setInterval(() => {
            void workflowInstanceRepository
              .renewExecutionLease(workflow.tenantId, workflow.workflowId, workerId, leaseDurationMs)
              .then((renewed) => {
                if (!renewed) leaseLost = true;
              })
              .catch(() => {
                leaseLost = true;
              });
          }, leaseHeartbeatMs)
        : null;

      try {
        while (workflow.currentStepIndex < workflow.steps.length) {
          if (leaseLost) {
            throw new KernelError(
              'CONFLICT',
              'Workflow execution lease was lost; refusing to continue with potentially stale state.',
              409,
              context.requestId
            );
          }
      const step = workflow.steps[workflow.currentStepIndex];
      const handler = this.stepHandlers.get(step.stepType);

      if (!handler) {
        step.status = 'FAILED';
        step.error = `No handler registered for step type '${step.stepType}'`;
        step.failureClassification = 'PERMANENT';
        workflow.status = 'FAILED';
        workflow.failureReason = step.error;
        workflow.completedAt = new Date().toISOString();

        auditLogger.logEvent(
          'WORKFLOW_EXECUTION',
          context.principal.id,
          'WORKFLOW_FAILED',
          `workflow:${workflowId}`,
          'ERROR',
          {
            tenantId: workflow.tenantId,
            requestId: context.requestId,
            details: { stepId: step.stepId, reason: step.error },
          }
        );

        await workflowInstanceRepository.saveWorkflow(workflow.tenantId, workflow.workflowId, workflow, workerId);
        return workflow;
      }

      step.status = 'RUNNING';
      step.executionKey = step.executionKey || ('exec_' + workflow.workflowId + '_' + step.stepId);
      if (!step.startedAt) step.startedAt = new Date().toISOString();

      let maxAttempts = step.retryPolicy?.maxAttempts || 3;
      let stepSuccess = false;

      while (step.attemptCount < maxAttempts && !stepSuccess) {
        if (leaseLost) {
          throw new KernelError('CONFLICT', 'Workflow execution lease was lost; refusing to execute a stale step.', 409, context.requestId);
        }

        const execution = await workflowStepExecutionRepository.claimExecution(
          workflow.tenantId,
          workflow.workflowId,
          step.stepId,
          step.executionKey!,
          workerId,
          300000
        );

        if (!execution) {
          throw new KernelError('CONFLICT', `Workflow step '${step.stepId}' is currently executing on another worker.`, 409, context.requestId);
        }

        // A completed durable execution is authoritative after restart. Rehydrate
        // its result and advance without invoking the external side effect again.
        if (execution.status === 'COMPLETED') {
          step.attemptCount = Math.max(step.attemptCount, execution.attemptCount);
          step.status = 'COMPLETED';
          step.output = execution.output || {};
          step.completedAt = execution.completedAt || new Date().toISOString();
          stepSuccess = true;
          break;
        }

        if (execution.status === 'FAILED') {
          step.attemptCount = Math.max(step.attemptCount, execution.attemptCount);
          step.status = 'FAILED';
          step.error = execution.error || 'Durable step execution failed';
          step.failureClassification = 'PERMANENT';
          break;
        }

        step.attemptCount = Math.max(step.attemptCount + 1, execution.attemptCount);
        const stepLeaseDurationMs = 300000;
        const stepLeaseHeartbeatMs = 60000;
        let stepLeaseLost = false;
        const stepLeaseHeartbeat = setInterval(() => {
          void workflowStepExecutionRepository
            .renewExecution(workflow.tenantId, step.executionKey!, workerId, stepLeaseDurationMs)
            .then((renewed) => { if (!renewed) stepLeaseLost = true; })
            .catch(() => { stepLeaseLost = true; });
        }, stepLeaseHeartbeatMs);
        try {
          const result = await handler({
            workflow,
            step,
            input: step.input,
            correlationId: workflow.correlationId,
            executionKey: step.executionKey!,
          });

          if (leaseLost || stepLeaseLost) {
            throw new KernelError(
              'CONFLICT',
              'Workflow execution lease was lost during step execution; refusing to retry or persist stale results.',
              409,
              context.requestId
            );
          }

          if (result.status === 'WAITING' || result.failureClassification === 'WAITING_FOR_EXTERNAL_RESULT') {
            step.status = 'WAITING';
            step.failureClassification = 'WAITING_FOR_EXTERNAL_RESULT';
            workflow.status = 'WAITING';
            // Keep the durable execution in EXECUTING while the workflow is WAITING.
            // After lease expiry, recovery can reclaim the same executionKey and resume
            // the provider operation without manufacturing a second execution identity.
            await workflowInstanceRepository.saveWorkflow(workflow.tenantId, workflow.workflowId, workflow, workerId);
            return workflow;
          }

          if (result.success) {
            step.status = 'COMPLETED';
            step.output = result.output || {};
            step.completedAt = new Date().toISOString();
            await workflowStepExecutionRepository.completeExecution(
              workflow.tenantId,
              step.executionKey!,
              workerId,
              step.output
            );
            stepSuccess = true;
          } else {
            step.error = result.error || 'Step execution failed';
            step.failureClassification = result.failureClassification || 'TRANSIENT';
            if (step.failureClassification === 'PERMANENT' || step.attemptCount >= maxAttempts) {
              await workflowStepExecutionRepository.failExecution(
                workflow.tenantId,
                step.executionKey!,
                workerId,
                step.error
              );
              break;
            }
          }
        } catch (err: any) {
          if (leaseLost || stepLeaseLost) throw err;
          step.error = err.message || 'Exception during step execution';
          step.failureClassification = 'TRANSIENT';
          if (step.attemptCount >= maxAttempts) {
            await workflowStepExecutionRepository.failExecution(
              workflow.tenantId,
              step.executionKey!,
              workerId,
              step.error
            );
            break;
          }
        } finally {
          clearInterval(stepLeaseHeartbeat);
        }
      }

      if (!stepSuccess) {
        if (step.status !== 'WAITING') {
          step.status = 'FAILED';
          if (!step.failureClassification) step.failureClassification = 'PERMANENT';
          workflow.status = 'FAILED';
          workflow.failureReason = `Step '${step.stepId}' failed: ${step.error}`;
          workflow.completedAt = new Date().toISOString();

          // Execute Compensation Handlers for previous completed steps
          await this.executeCompensation(context, workflow);

          auditLogger.logEvent(
            'WORKFLOW_EXECUTION',
            context.principal.id,
            'WORKFLOW_FAILED',
            `workflow:${workflowId}`,
            'ERROR',
            {
              tenantId: workflow.tenantId,
              requestId: context.requestId,
              details: { stepId: step.stepId, attempts: step.attemptCount, error: step.error },
            }
          );

          const failedEnvelope: EventEnvelope = {
            eventId: `evt_${workflowId}_failed`,
            eventType: 'workflow.failed.v1',
            eventVersion: 'v1',
            occurredAt: workflow.completedAt!,
            tenantId: workflow.tenantId,
            branchId: workflow.branchId,
            principalId: context.principal.id,
            correlationId: workflow.correlationId,
            causationId: step.stepId,
            source: 'WorkflowEngine',
            payload: { workflowId, failedStepId: step.stepId, reason: step.error },
            metadata: workflow.metadata,
          };
          const failedRecord = this.buildLifecycleOutboxRecord(failedEnvelope);
          await workflowInstanceRepository.saveWorkflowWithOutbox(workflow.tenantId, workflow.workflowId, workflow, failedRecord, workerId);
          await eventBus.publish(failedEnvelope);
          return workflow;
        }
      } else {
        workflow.currentStepIndex++;
        await workflowInstanceRepository.saveWorkflow(workflow.tenantId, workflow.workflowId, workflow, workerId);
      }
    }

    workflow.status = 'COMPLETED';
    workflow.completedAt = new Date().toISOString();

    const completedEnvelope: EventEnvelope = {
      eventId: `evt_${workflowId}_completed`,
      eventType: 'workflow.completed.v1',
      eventVersion: 'v1',
      occurredAt: workflow.completedAt,
      tenantId: workflow.tenantId,
      branchId: workflow.branchId,
      principalId: context.principal.id,
      correlationId: workflow.correlationId,
      causationId: null,
      source: 'WorkflowEngine',
      payload: { workflowId, status: 'COMPLETED' },
      metadata: workflow.metadata,
    };

    // Terminal workflow state and lifecycle outbox event commit atomically.
    const completedRecord = this.buildLifecycleOutboxRecord(completedEnvelope);
    await workflowInstanceRepository.saveWorkflowWithOutbox(
      workflow.tenantId,
      workflow.workflowId,
      workflow,
      completedRecord,
      workerId
    );

    auditLogger.logEvent(
      'WORKFLOW_EXECUTION',
      context.principal.id,
      'WORKFLOW_COMPLETED',
      `workflow:${workflowId}`,
      'ALLOWED',
      {
        tenantId: workflow.tenantId,
        requestId: context.requestId,
        details: { correlationId: workflow.correlationId },
      }
    );

    await eventBus.publish(completedEnvelope);

        return workflow;
      } finally {
      if (leaseHeartbeat) clearInterval(leaseHeartbeat);
      if (durableWorkflow) {
        await workflowInstanceRepository.releaseExecutionLease(workflow.tenantId, workflow.workflowId, workerId);
      }
    }
  }

  /**
   * Compensation rollback runner for workflow failures.
   */
  private async executeCompensation(
    context: SecurityContext,
    workflow: WorkflowInstance
  ): Promise<void> {
    for (let i = workflow.currentStepIndex - 1; i >= 0; i--) {
      const step = workflow.steps[i];
      if (step.status === 'COMPLETED' && step.compensationStepId) {
        const compHandler = this.stepHandlers.get(step.compensationStepId);
        if (compHandler) {
          try {
            await compHandler({
              workflow,
              step,
              input: step.output || {},
              correlationId: workflow.correlationId,
              executionKey: `comp_${workflow.workflowId}_${step.stepId}_${step.compensationStepId}`,
            });
            step.status = 'SKIPPED'; // marked rolled back
          } catch (err: any) {
            console.error(`Compensation step '${step.compensationStepId}' failed:`, err);
          }
        }
      }
    }
  }

  /**
   * Adds an event envelope to the Firestore Outbox Delivery Store (/tenants/{tenantId}/outbox/{eventId}).
   */
  public async addToOutbox(context: SecurityContext, event: EventEnvelope): Promise<OutboxRecord> {
    const tenantId = event.tenantId || context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) {
      throw new KernelError(
        'TENANT_ISOLATION_ERROR',
        'Outbox Delivery Denied: Missing Tenant Context',
        403,
        context.requestId
      );
    }

    // Durable outbox is authoritative. The workflow engine no longer maintains
    // a second in-memory business outbox that would disappear on restart.
    const durable = await outboxEngine.enqueueEvent(
      tenantId,
      event,
      undefined,
      context.principal.id
    );

    return {
      eventId: durable.eventId,
      tenantId: durable.tenantId,
      eventType: durable.eventType,
      status: durable.status === 'PROCESSING' ? 'PROCESSING' : 'PENDING',
      attempts: durable.attemptCount,
      payload: durable.payload,
      createdAt: durable.createdAt,
      lastAttemptAt: null,
      errorDetails: durable.lastError,
    };
  }

  /**
   * Processes the durable Firestore outbox. Delivery, leasing, retries and
   * dead-letter handling are delegated to the authoritative OutboxEngine.
   */
  public async processOutbox(context: SecurityContext): Promise<OutboxRecord[]> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) {
      throw new KernelError(
        'TENANT_ISOLATION_ERROR',
        'Outbox Processing Denied: Missing Tenant Context',
        403,
        context.requestId
      );
    }

    await outboxEngine.processTenantOutbox(
      tenantId,
      `workflow-worker-${context.principal.id}`
    );

    // Return the durable delivered records for this tenant.
    const durableRecords = await outboxRepository.listOutbox(tenantId, 'DELIVERED');
    return durableRecords
      .map((record) => ({
        eventId: record.eventId,
        tenantId: record.tenantId,
        eventType: record.eventType,
        status: 'DELIVERED' as const,
        attempts: record.attemptCount,
        payload: record.payload,
        createdAt: record.createdAt,
        lastAttemptAt: record.updatedAt,
        errorDetails: record.lastError,
      }));
  }

  /**
   * Retrieves a workflow by ID.
   */
  public getWorkflow(workflowId: string): WorkflowInstance | undefined {
    return this.workflows.get(workflowId);
  }

  public clearStoreForTesting(): void {
    this.workflows.clear();
    this.stepHandlers.clear();
  }
}

export const workflowEngine = new WorkflowEngineService();
