/**
 * TDBK V2 WORKFLOW ENGINE PRIMITIVES & TYPE DEFINITIONS
 * Architectural Layer: LAYER 6 — WORKFLOW & EVENT ENGINE
 */

export type WorkflowStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type WorkflowStepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export type FailureClassification =
  | 'TRANSIENT'
  | 'PERMANENT'
  | 'WAITING_FOR_EXTERNAL_RESULT';

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  timeoutMs: number;
  retryableErrors: string[];
}

export interface WorkflowStep {
  stepId: string;
  stepType: string;
  status: WorkflowStepStatus;
  attemptCount: number;
  retryPolicy?: RetryPolicy;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  failureClassification?: FailureClassification;
  compensationStepId?: string;
}

export interface WorkflowInstance {
  workflowId: string;
  workflowType: string;
  workflowVersion: string;
  tenantId: string;
  branchId: string | null;
  status: WorkflowStatus;
  currentStepIndex: number;
  steps: WorkflowStep[];
  correlationId: string;
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown>;
}

export interface StepExecutorContext {
  workflow: WorkflowInstance;
  step: WorkflowStep;
  input: Record<string, unknown>;
  correlationId: string;
}

export type StepHandler = (
  context: StepExecutorContext
) => Promise<{
  success: boolean;
  status?: 'COMPLETED' | 'WAITING' | 'FAILED';
  output?: Record<string, unknown>;
  error?: string;
  failureClassification?: FailureClassification;
}>;

export interface OutboxRecord {
  outboxId: string;
  eventId: string;
  tenantId: string;
  eventType: string;
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'FAILED';
  attempts: number;
  payload: Record<string, unknown>;
  createdAt: string;
  lastAttemptAt: string | null;
  errorDetails: string | null;
}
