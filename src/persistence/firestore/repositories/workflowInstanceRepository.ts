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
    workflow: WorkflowInstance,
    expectedLeaseOwner?: string
  ): Promise<void> {
    if (!expectedLeaseOwner) {
      await firestoreClient.set(
        this.getPath(tenantId, workflowId),
        workflow as unknown as Record<string, unknown>
      );
      return;
    }

    await firestoreClient.runTransaction(async (tx) => {
      const path = this.getPath(tenantId, workflowId);
      const current = await tx.get<WorkflowInstance>(path);
      if (!current) throw new Error(`Workflow '${workflowId}' not found.`);
      if (current.executionLeaseOwner !== expectedLeaseOwner) {
        throw new Error(`Workflow '${workflowId}' execution lease is not owned by '${expectedLeaseOwner}'.`);
      }
      await tx.set(path, workflow as unknown as Record<string, unknown>);
    });
  }

  public async saveWorkflowWithOutbox(
    tenantId: string,
    workflowId: string,
    workflow: WorkflowInstance,
    event: import('../../types').OutboxRecord,
    expectedLeaseOwner?: string
  ): Promise<void> {
    await firestoreClient.runTransaction(async (tx) => {
      const path = this.getPath(tenantId, workflowId);
      if (expectedLeaseOwner) {
        const current = await tx.get<WorkflowInstance>(path);
        if (!current) throw new Error(`Workflow '${workflowId}' not found.`);
        if (current.executionLeaseOwner !== expectedLeaseOwner) {
          throw new Error(`Workflow '${workflowId}' execution lease is not owned by '${expectedLeaseOwner}'.`);
        }
      }
      await tx.set(path, workflow as unknown as Record<string, unknown>);
      await tx.set('/tenants/' + tenantId + '/outbox/' + event.eventId, event as unknown as Record<string, unknown>);
    });
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

  /** Renews only the active lease owned by this worker. */
  public async renewExecutionLease(
    tenantId: string,
    workflowId: string,
    owner: string,
    leaseDurationMs: number
  ): Promise<boolean> {
    const path = this.getPath(tenantId, workflowId);
    const leaseUntil = new Date(Date.now() + leaseDurationMs).toISOString();
    return await firestoreClient.runTransaction(async (tx) => {
      const workflow = await tx.get<WorkflowInstance>(path);
      if (!workflow || workflow.executionLeaseOwner !== owner) return false;
      const currentLeaseUntil = workflow.executionLeaseUntil ? Date.parse(workflow.executionLeaseUntil) : 0;
      if (currentLeaseUntil <= Date.now()) return false;
      await tx.update<WorkflowInstance>(path, { executionLeaseUntil: leaseUntil });
      return true;
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
