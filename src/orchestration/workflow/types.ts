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
  executionKey?: string;
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
  executionLeaseOwner?: string | null;
  executionLeaseUntil?: string | null;
}

export type ExternalSideEffectOutcome =
  | 'REQUESTED'
  | 'PROVIDER_ACCEPTED'
  | 'PROVIDER_REJECTED'
  | 'UNKNOWN_OUTCOME'
  | 'RECONCILIATION_REQUIRED'
  | 'RECONCILED_SUCCESS'
  | 'RECONCILED_FAILURE';

export interface ExternalSideEffectPreparation {
  operation: string;
  providerName: string;
  providerIdempotencySupported: boolean;
  providerReconciliationSupported: boolean;
}

export interface ExternalSideEffectBinding {
  operation: string;
  providerOperationIdentity: string;
  providerName: string;
  providerReference: string | null;
  providerIdempotencySupported: boolean;
  providerReconciliationSupported: boolean;
  outcomeState: ExternalSideEffectOutcome;
}

export interface StepExecutorContext {
  workflow: WorkflowInstance;
  step: WorkflowStep;
  input: Record<string, unknown>;
  correlationId: string;
  executionKey: string;
  /**
   * Must be called before a side-effecting provider operation. The Engine
   * durably binds the canonical execution identity before the external call.
   */
  prepareExternalSideEffect: (
    preparation: ExternalSideEffectPreparation
  ) => Promise<ExternalSideEffectBinding>;
  /**
   * Records the provider outcome against the same durable execution mapping.
   * UNKNOWN_OUTCOME / RECONCILIATION_REQUIRED is never converted to success.
   */
  recordExternalSideEffectOutcome: (
    outcome: Pick<ExternalSideEffectBinding, 'providerReference' | 'outcomeState'>
  ) => Promise<ExternalSideEffectBinding>;
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
