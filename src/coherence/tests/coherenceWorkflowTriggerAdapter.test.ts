import { describe, expect, it, beforeEach } from 'vitest';
import { eventBus } from '../../orchestration/events/eventBus';
import { workflowEngine } from '../../orchestration/workflow/engine';
import { workflowInstanceRepository } from '../../persistence/firestore/repositories/workflowInstanceRepository';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';

describe('Coherence Event -> Durable Workflow Trigger', () => {
  const tenantId = 'tenant_coherence_trigger_01';

  beforeEach(() => {
    firestoreClient.clearAllForTesting();
    workflowEngine.clearStoreForTesting();
    eventBus.clearStoreForTesting();
  });

  it('creates and executes the catalog workflow from a durable-domain event', async () => {
    const event = {
      eventId: 'evt_attendance_trigger_001',
      eventType: 'attendance.recorded.v1',
      eventVersion: 'v1',
      occurredAt: new Date().toISOString(),
      tenantId,
      branchId: 'branch_hq',
      principalId: 'usr_teacher_01',
      correlationId: 'corr_attendance_trigger_001',
      causationId: 'req_attendance_001',
      source: 'RoleBasedCoherenceEngine:ContributionDispatcher',
      payload: {
        contributionId: 'contrib_attendance_001',
        dbkId: tenantId,
        className: 'Grade 4-Blue',
        status: 'PRESENT',
      },
      metadata: {},
    };

    const published = await eventBus.publish(event);
    const workflows = await workflowInstanceRepository.listWorkflows(tenantId);
    const workflow = workflows.find((candidate) => candidate.workflowType === 'wf_record_attendance');

    expect(published.published).toBe(true);
    expect(workflow).toBeDefined();
    expect(workflow?.metadata.triggerEventId).toBe(event.eventId);
    expect(workflow?.metadata.catalogWorkflowId).toBe('wf_record_attendance');
    expect(workflow?.steps[0].stepType).toBe('COHERENCE_WORKFLOW_TRIGGER');
    expect(workflow?.steps[0].status).toBe('COMPLETED');
    expect(workflow?.status).toBe('COMPLETED');

    // Simulate subscriber/process restart: the EventBus cache and Workflow Engine
    // cache are cleared, but Firestore remains authoritative.
    eventBus.clearStoreForTesting();
    workflowEngine.clearStoreForTesting();

    const replay = await eventBus.publish(event);
    const replayedWorkflows = await workflowInstanceRepository.listWorkflows(tenantId);
    const matching = replayedWorkflows.filter((candidate) => candidate.workflowType === 'wf_record_attendance');

    expect(replay.published).toBe(true);
    expect(matching).toHaveLength(1);
    expect(matching[0].workflowId).toBe(workflow?.workflowId);
  });
});
