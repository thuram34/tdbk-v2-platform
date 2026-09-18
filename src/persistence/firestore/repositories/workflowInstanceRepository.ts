/**
 * TDBK V2 — WORKFLOW INSTANCE REPOSITORY
 * Firestore Path: /tenants/{tenantId}/workflows/{workflowId}
 */

import { IWorkflowInstanceRepository } from '../../types';
import { WorkflowInstance } from '../../../orchestration/workflow/types';
import { firestoreClient } from '../firestoreClient';

export class WorkflowInstanceRepository implements IWorkflowInstanceRepository {
  private static instance: WorkflowInstanceRepository;

  private constructor() {}

  public static getInstance(): WorkflowInstanceRepository {
    if (!WorkflowInstanceRepository.instance) {
      WorkflowInstanceRepository.instance = new WorkflowInstanceRepository();
    }
    return WorkflowInstanceRepository.instance;
  }

  private getPath(tenantId: string, workflowId: string): string {
    return `/tenants/${tenantId}/workflows/${workflowId}`;
  }

  public async saveWorkflow(
    tenantId: string,
    workflowId: string,
    workflow: WorkflowInstance
  ): Promise<void> {
    await firestoreClient.set(
      this.getPath(tenantId, workflowId),
      workflow as unknown as Record<string, unknown>
    );
  }

  public async getWorkflow(tenantId: string, workflowId: string): Promise<WorkflowInstance | null> {
    return await firestoreClient.get<WorkflowInstance>(this.getPath(tenantId, workflowId));
  }

  public async listWorkflows(tenantId: string): Promise<WorkflowInstance[]> {
    return await firestoreClient.listCollection<WorkflowInstance>(`/tenants/${tenantId}/workflows`);
  }

  /** Atomically claims a workflow execution lease so concurrent workers cannot execute the same workflow. */
  public async claimExecutionLease(
    tenantId: string,
    workflowId: string,
    owner: string,
    leaseDurationMs: number
  ): Promise<WorkflowInstance | null> {
    const path = this.getPath(tenantId, workflowId);
    const now = Date.now();
    const leaseUntil = new Date(now + leaseDurationMs).toISOString();

    return await firestoreClient.runTransaction(async (tx) => {
      const workflow = await tx.get<WorkflowInstance>(path);
      if (!workflow) return null;
      if (workflow.status === 'COMPLETED' || workflow.status === 'CANCELLED') return workflow;

      const currentLeaseUntil = workflow.executionLeaseUntil ? Date.parse(workflow.executionLeaseUntil) : 0;
      const leaseActive = Boolean(workflow.executionLeaseOwner && currentLeaseUntil > now);
      if (leaseActive && workflow.executionLeaseOwner !== owner) return null;

      const leased = {
        ...workflow,
        executionLeaseOwner: owner,
        executionLeaseUntil: leaseUntil,
      };
      await tx.set(path, leased);
      return leased;
    });
  }

  /** Releases only the lease owned by this worker. */
  public async releaseExecutionLease(
    tenantId: string,
    workflowId: string,
    owner: string
  ): Promise<void> {
    const path = this.getPath(tenantId, workflowId);
    await firestoreClient.runTransaction(async (tx) => {
      const workflow = await tx.get<WorkflowInstance>(path);
      if (!workflow || workflow.executionLeaseOwner !== owner) return;
      await tx.update<WorkflowInstance>(path, {
        executionLeaseOwner: null,
        executionLeaseUntil: null,
      });
    });
  }
}

export const workflowInstanceRepository = WorkflowInstanceRepository.getInstance();
