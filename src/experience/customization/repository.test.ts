import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { TestMemoryFirestoreDriver } from '../../persistence/firestore/driver/testMemoryFirestoreDriver';
import { ExperienceCustomizationRepository } from './repository';
import type { CustomWorkflowRun } from './types';

describe('ExperienceCustomizationRepository workflow runs', () => {
  let repository: ExperienceCustomizationRepository;
  let driver: TestMemoryFirestoreDriver;
  let originalDriver: ReturnType<typeof firestoreClient.getDriver>;

  beforeEach(() => {
    originalDriver = firestoreClient.getDriver();
    driver = new TestMemoryFirestoreDriver();
    driver.clearAllForTesting();
    firestoreClient.setDriverForTesting(driver);
    repository = ExperienceCustomizationRepository.getInstance();
  });

  afterEach(() => {
    firestoreClient.setDriverForTesting(originalDriver);
  });

  const run: CustomWorkflowRun = {
    runId: 'wfr_test_001',
    dbkId: 'dbk_test',
    workflowId: 'onboarding',
    configurationVersion: 1,
    workflowSnapshot: { id: 'onboarding', name: 'Onboarding', enabled: true, steps: [{ id: 'capture', title: 'Capture request' }, { id: 'review', title: 'Review request' }] },
    questionnaireSnapshots: [],
    status: 'IN_PROGRESS',
    currentStepIndex: 0,
    completedStepIds: [],
    startedBy: 'user_test',
    startedAt: '2026-11-08T10:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
  };

  it('version-checks tenant experience configuration writes', async () => {
    const config = {
      dbkId: 'dbk_test',
      version: 1,
      menuItems: [],
      buttons: [],
      questionnaires: [],
      workflows: [],
      updatedAt: '2026-11-08T10:00:00.000Z',
      updatedBy: 'user_test',
    };
    await expect(repository.save('dbk_test', config, 0)).resolves.toMatchObject({ version: 1 });
    await expect(repository.save('dbk_test', { ...config, version: 2 }, 0)).rejects.toThrow('CONFIGURATION_CONFLICT');
  });

  it('persists workflow runs within the owning tenant path', async () => {
    await repository.createWorkflowRun(run.dbkId, run);

    await expect(repository.getWorkflowRun(run.dbkId, run.runId)).resolves.toEqual(run);
    await expect(repository.getWorkflowRun('another_dbk', run.runId)).resolves.toBeNull();
  });

  it('advances a workflow run transactionally', async () => {
    await repository.createWorkflowRun(run.dbkId, run);
    const next: CustomWorkflowRun = {
      ...run,
      currentStepIndex: 1,
      completedStepIds: ['capture'],
      updatedAt: '2026-11-08T10:01:00.000Z',
    };

    await expect(repository.advanceWorkflowRun(run.dbkId, run.runId, 0, next)).resolves.toEqual(next);
    await expect(repository.getWorkflowRun(run.dbkId, run.runId)).resolves.toEqual(next);
  });

  it('rejects stale concurrent workflow transitions', async () => {
    await repository.createWorkflowRun(run.dbkId, run);
    const next: CustomWorkflowRun = {
      ...run,
      currentStepIndex: 1,
      completedStepIds: ['capture'],
      updatedAt: '2026-11-08T10:01:00.000Z',
    };
    await repository.advanceWorkflowRun(run.dbkId, run.runId, 0, next);

    await expect(repository.advanceWorkflowRun(run.dbkId, run.runId, 0, {
      ...next,
      currentStepIndex: 2,
      completedStepIds: ['capture', 'review'],
    })).rejects.toThrow('WORKFLOW_STEP_CONFLICT');
  });
});
