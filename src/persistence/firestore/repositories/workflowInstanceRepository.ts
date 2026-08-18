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
}

export const workflowInstanceRepository = WorkflowInstanceRepository.getInstance();
