/**
 * TDBK V2 — WORKSPACE REPOSITORY
 * Firestore Path: /tenants/{tenantId}/workspaces/active
 */

import { IWorkspaceRepository } from '../../types';
import { DbkWorkspaceState } from '../../../platform/types';
import { firestoreClient } from '../firestoreClient';

export class WorkspaceRepository implements IWorkspaceRepository {
  private static instance: WorkspaceRepository;

  private constructor() {}

  public static getInstance(): WorkspaceRepository {
    if (!WorkspaceRepository.instance) {
      WorkspaceRepository.instance = new WorkspaceRepository();
    }
    return WorkspaceRepository.instance;
  }

  private getPath(tenantId: string): string {
    return `/tenants/${tenantId}/workspaces/active`;
  }

  public async saveActiveWorkspace(tenantId: string, workspace: DbkWorkspaceState): Promise<void> {
    await firestoreClient.set(this.getPath(tenantId), workspace as unknown as Record<string, unknown>);
  }

  public async getActiveWorkspace(tenantId: string): Promise<DbkWorkspaceState | null> {
    return await firestoreClient.get<DbkWorkspaceState>(this.getPath(tenantId));
  }

  public async deleteActiveWorkspace(tenantId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId));
  }
}

export const workspaceRepository = WorkspaceRepository.getInstance();
