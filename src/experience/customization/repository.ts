import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import type { CustomWorkflowRun, ExperienceCustomization } from './types';

export class ExperienceCustomizationRepository {
  private static instance: ExperienceCustomizationRepository;
  private constructor() {}
  public static getInstance(): ExperienceCustomizationRepository {
    if (!ExperienceCustomizationRepository.instance) {
      ExperienceCustomizationRepository.instance = new ExperienceCustomizationRepository();
    }
    return ExperienceCustomizationRepository.instance;
  }

  private path(dbkId: string): string {
    return `/tenants/${dbkId}/configuration/experience_customization`;
  }

  public async get(dbkId: string): Promise<ExperienceCustomization | null> {
    return firestoreClient.get<ExperienceCustomization>(this.path(dbkId));
  }

  private workflowRunPath(dbkId: string, runId: string): string {
    return `/tenants/${dbkId}/workflow_runs/${runId}`;
  }

  public async createWorkflowRun(dbkId: string, run: CustomWorkflowRun): Promise<void> {
    await firestoreClient.set(this.workflowRunPath(dbkId, run.runId), run as unknown as Record<string, unknown>);
  }

  public async getWorkflowRun(dbkId: string, runId: string): Promise<CustomWorkflowRun | null> {
    return firestoreClient.get<CustomWorkflowRun>(this.workflowRunPath(dbkId, runId));
  }

  public async advanceWorkflowRun(
    dbkId: string,
    runId: string,
    expectedStepIndex: number,
    next: CustomWorkflowRun,
  ): Promise<CustomWorkflowRun> {
    return firestoreClient.runTransaction(async transaction => {
      const path = this.workflowRunPath(dbkId, runId);
      const existing = await transaction.get<CustomWorkflowRun>(path);
      if (!existing) throw new Error('WORKFLOW_RUN_NOT_FOUND');
      if (existing.status === 'COMPLETED') return existing;
      if (existing.currentStepIndex !== expectedStepIndex) {
        throw new Error('WORKFLOW_STEP_CONFLICT');
      }
      await transaction.set(path, next);
      return next;
    });
  }

  public async save(
    dbkId: string,
    value: ExperienceCustomization,
    expectedVersion: number,
  ): Promise<ExperienceCustomization> {
    return firestoreClient.runTransaction(async (transaction) => {
      const path = this.path(dbkId);
      const existing = await transaction.get<ExperienceCustomization>(path);
      const currentVersion = existing?.version || 0;
      if (currentVersion !== expectedVersion) {
        throw new Error(`CONFIGURATION_CONFLICT: Expected version ${expectedVersion}, current version is ${currentVersion}.`);
      }
      const saved = { ...value, dbkId, version: currentVersion + 1 };
      await transaction.set(path, saved);
      return saved;
    });
  }
}

export const experienceCustomizationRepository = ExperienceCustomizationRepository.getInstance();
