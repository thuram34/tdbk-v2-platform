/**
 * TDBK V2 — DURABLE JOB RUNTIME
 * Stable platform facade over the existing Firestore-backed workflow engine.
 * Command -> durable workflow -> leased step execution -> outbox/event.
 */

import { SecurityContext } from '../../kernel/types';
import { idempotencyRepository } from '../../persistence/firestore/repositories/idempotencyRepository';
import { workflowEngine } from '../../orchestration/workflow/engine';
import { workflowInstanceRepository } from '../../persistence/firestore/repositories/workflowInstanceRepository';
import { WorkflowInstance } from '../../orchestration/workflow/types';

export interface DurableJobRequest {
  jobType: string;
  version?: string;
  idempotencyKey: string;
  steps: Array<{
    stepId: string;
    stepType: string;
    input?: Record<string, unknown>;
    retryPolicy?: { maxAttempts: number; backoffMs: number; timeoutMs: number; retryableErrors: string[] };
    compensationStepId?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface DurableJobResult {
  workflowId: string;
  tenantId: string;
  status: WorkflowInstance['status'];
  isIdempotentReplay: boolean;
}

export class DurableJobRuntime {
  private static instance: DurableJobRuntime;
  private constructor() {}

  public static getInstance(): DurableJobRuntime {
    if (!DurableJobRuntime.instance) DurableJobRuntime.instance = new DurableJobRuntime();
    return DurableJobRuntime.instance;
  }

  public async submit(context: SecurityContext, request: DurableJobRequest): Promise<DurableJobResult> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) throw new Error('Durable job requires an authoritative tenant context.');

    const key = `durable_job:${request.idempotencyKey}`;
    const existing = await idempotencyRepository.getIdempotencyRecord(tenantId, key);
    if (existing?.status === 'COMPLETED' && existing.responsePayload?.workflowId) {
      const workflow = await workflowInstanceRepository.getWorkflow(tenantId, String(existing.responsePayload.workflowId));
      return {
        workflowId: String(existing.responsePayload.workflowId),
        tenantId,
        status: workflow?.status || 'COMPLETED',
        isIdempotentReplay: true,
      };
    }

    const claim = await idempotencyRepository.claimIdempotencyRecord(tenantId, key, {
      idempotencyKey: key,
      tenantId,
      action: 'DURABLE_JOB_SUBMIT',
      requestHash: JSON.stringify({ jobType: request.jobType, version: request.version || 'v1', steps: request.steps }),
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (claim === 'COMPLETED') {
      const completed = await idempotencyRepository.getIdempotencyRecord(tenantId, key);
      return {
        workflowId: String(completed?.responsePayload?.workflowId || ''),
        tenantId,
        status: 'COMPLETED',
        isIdempotentReplay: true,
      };
    }
    if (claim === 'IN_PROGRESS') {
      throw new Error(`Durable job '${request.idempotencyKey}' is already being submitted.`);
    }

    try {
      const workflow = await workflowEngine.createPersistentWorkflow(
        context,
        request.jobType,
        request.version || 'v1',
        request.steps,
        request.metadata || {},
      );
      await idempotencyRepository.completeIdempotencyRecord(tenantId, key, {
        workflowId: workflow.workflowId,
        jobType: request.jobType,
      });
      return { workflowId: workflow.workflowId, tenantId, status: workflow.status, isIdempotentReplay: false };
    } catch (error) {
      await idempotencyRepository.failIdempotencyRecord(tenantId, key, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  public async execute(context: SecurityContext, workflowId: string): Promise<WorkflowInstance> {
    return workflowEngine.executeWorkflow(context, workflowId);
  }

  public async recover(context: SecurityContext): Promise<WorkflowInstance[]> {
    return workflowEngine.recoverTenantWorkflows(context);
  }
}

export const durableJobRuntime = DurableJobRuntime.getInstance();
