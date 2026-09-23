/**
 * TDBK V2 — DURABLE WORKFLOW STEP EXECUTION REPOSITORY
 * Firestore Path: /tenants/{tenantId}/workflowExecutions/{executionKey}
 *
 * The execution key is the durable idempotency boundary for a workflow step.
 * A restart must rediscover this record rather than infer execution state from
 * the process-local workflow cache.
 */
import { IWorkflowStepExecutionRepository, WorkflowProviderOperationMapping, WorkflowStepExecution } from '../../types';
import { firestoreClient } from '../firestoreClient';
import { KernelError } from '../../../kernel/errors/kernelErrors';

export class WorkflowStepExecutionRepository implements IWorkflowStepExecutionRepository {
  private static instance: WorkflowStepExecutionRepository;
  private constructor() {}

  public static getInstance(): WorkflowStepExecutionRepository {
    if (!WorkflowStepExecutionRepository.instance) {
      WorkflowStepExecutionRepository.instance = new WorkflowStepExecutionRepository();
    }
    return WorkflowStepExecutionRepository.instance;
  }

  private getPath(tenantId: string, executionKey: string): string {
    return `/tenants/${tenantId}/workflowExecutions/${executionKey}`;
  }

  public async claimExecution(
    tenantId: string,
    workflowId: string,
    stepId: string,
    executionKey: string,
    workerId: string,
    leaseDurationMs: number
  ): Promise<WorkflowStepExecution | null> {
    const path = this.getPath(tenantId, executionKey);
    return await firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<WorkflowStepExecution>(path);
      const now = Date.now();

      if (current?.status === 'COMPLETED' || current?.status === 'FAILED') return current;

      const activeLease = Boolean(
        current?.status === 'EXECUTING' &&
        current.workerId &&
        current.leaseUntil &&
        Date.parse(current.leaseUntil) > now
      );

      // A live lease is exclusive even when the same worker asks again. The
      // durable execution key is the idempotency boundary; re-claiming an
      // active execution would increment attempts and permit duplicate step
      // invocation under the same worker identity.
      if (activeLease) return null;

      const nowIso = new Date(now).toISOString();
      const next: WorkflowStepExecution = {
        executionKey,
        tenantId,
        workflowId,
        stepId,
        attemptCount: (current?.attemptCount || 0) + 1,
        status: 'EXECUTING',
        output: current?.output || null,
        error: null,
        workerId,
        leaseUntil: new Date(now + leaseDurationMs).toISOString(),
        createdAt: current?.createdAt || nowIso,
        updatedAt: nowIso,
        completedAt: null,
      };

      await tx.set(path, next as unknown as Record<string, unknown>);
      return next;
    });
  }

  public async renewExecution(
    tenantId: string,
    executionKey: string,
    workerId: string,
    leaseDurationMs: number
  ): Promise<boolean> {
    const path = this.getPath(tenantId, executionKey);
    return await firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<WorkflowStepExecution>(path);
      if (!current || current.status !== 'EXECUTING' || current.workerId !== workerId) return false;
      if (!current.leaseUntil || Date.parse(current.leaseUntil) <= Date.now()) return false;
      const now = new Date().toISOString();
      await tx.update(path, {
        leaseUntil: new Date(Date.now() + leaseDurationMs).toISOString(),
        updatedAt: now,
      });
      return true;
    });
  }

  public async completeExecution(
    tenantId: string,
    executionKey: string,
    workerId: string,
    output: Record<string, unknown>
  ): Promise<WorkflowStepExecution> {
    const path = this.getPath(tenantId, executionKey);
    return await firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<WorkflowStepExecution>(path);
      if (!current) throw new KernelError('NOT_FOUND', `Workflow step execution '${executionKey}' not found`, 404);
      if (current.status === 'COMPLETED') return current;
      if (current.status !== 'EXECUTING' || current.workerId !== workerId) {
        throw new KernelError('CONFLICT', `Workflow step execution '${executionKey}' is no longer owned by '${workerId}'`, 409);
      }
      const now = new Date().toISOString();
      const completed = { ...current, status: 'COMPLETED' as const, output, error: null, workerId: null, leaseUntil: null, updatedAt: now, completedAt: now };
      await tx.set(path, completed as unknown as Record<string, unknown>);
      return completed;
    });
  }

  public async failExecution(
    tenantId: string,
    executionKey: string,
    workerId: string,
    error: string
  ): Promise<WorkflowStepExecution> {
    const path = this.getPath(tenantId, executionKey);
    return await firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<WorkflowStepExecution>(path);
      if (!current) throw new KernelError('NOT_FOUND', `Workflow step execution '${executionKey}' not found`, 404);
      if (current.status === 'FAILED') return current;
      if (current.status !== 'EXECUTING' || current.workerId !== workerId) {
        throw new KernelError('CONFLICT', `Workflow step execution '${executionKey}' is no longer owned by '${workerId}'`, 409);
      }
      const now = new Date().toISOString();
      const failed = { ...current, status: 'FAILED' as const, error, workerId: null, leaseUntil: null, updatedAt: now, completedAt: now };
      await tx.set(path, failed as unknown as Record<string, unknown>);
      return failed;
    });
  }

  public async bindProviderOperation(
    tenantId: string,
    executionKey: string,
    workerId: string,
    mapping: WorkflowProviderOperationMapping
  ): Promise<WorkflowStepExecution> {
    const path = this.getPath(tenantId, executionKey);
    return await firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<WorkflowStepExecution>(path);
      if (!current) throw new KernelError('NOT_FOUND', `Workflow step execution '${executionKey}' not found`, 404);
      if (current.status !== 'EXECUTING' || current.workerId !== workerId) {
        throw new KernelError('CONFLICT', `Workflow step execution '${executionKey}' is no longer owned by '${workerId}'`, 409);
      }
      const now = new Date().toISOString();
      const updated: WorkflowStepExecution = {
        ...current,
        providerOperationIdentity: mapping.providerOperationIdentity,
        providerName: mapping.providerName,
        providerReference: mapping.providerReference ?? current.providerReference ?? null,
        providerIdempotencySupported: mapping.providerIdempotencySupported,
        providerReconciliationSupported: mapping.providerReconciliationSupported,
        outcomeState: mapping.outcomeState ?? current.outcomeState ?? 'REQUESTED',
        updatedAt: now,
      };
      await tx.set(path, updated as unknown as Record<string, unknown>);
      return updated;
    });
  }

  public async getExecution(tenantId: string, executionKey: string): Promise<WorkflowStepExecution | null> {
    return await firestoreClient.get<WorkflowStepExecution>(this.getPath(tenantId, executionKey));
  }
}

export const workflowStepExecutionRepository = WorkflowStepExecutionRepository.getInstance();
