/**
 * TDBK V2 — CROSS-LAYER FLOW COORDINATION CONTRACT
 * Coordinates the nine architectural layers without becoming a new authority.
 */
import { SecurityContext } from '../../kernel/types';

export type FlowStage =
  | 'IDENTITY' | 'TENANT' | 'BRANCH' | 'CAPABILITY' | 'ENTITLEMENT'
  | 'RUNTIME' | 'WORKFLOW' | 'PERSISTENCE' | 'INTEGRATION' | 'PROJECTION';

export type FlowStatus = 'STARTED' | 'RUNNING' | 'COMPLETED' | 'WAITING' | 'FAILED' | 'DENIED' | 'RECOVERING';

export type FlowFailureClass =
  | 'AUTHENTICATION' | 'AUTHORIZATION' | 'TENANT_ISOLATION' | 'VALIDATION'
  | 'CONFLICT' | 'NOT_FOUND' | 'TRANSIENT' | 'EXTERNAL_UNKNOWN'
  | 'PERSISTENCE' | 'INTERNAL';

export interface FlowStepResult<T = unknown> {
  stage: FlowStage;
  status: 'COMPLETED' | 'WAITING' | 'FAILED';
  output?: T;
  failureClassification?: FlowFailureClass;
  retryable?: boolean;
  error?: string;
}

export interface FlowExecutionState {
  flowId: string;
  correlationId: string;
  requestId: string;
  tenantId: string | null;
  branchId: string | null;
  principalId: string;
  status: FlowStatus;
  currentStage: FlowStage | null;
  completedStages: FlowStage[];
  startedAt: string;
  completedAt: string | null;
  failure: {
    classification: FlowFailureClass;
    retryable: boolean;
    message: string;
  } | null;
}

export interface FlowExecutionDefinition<T = unknown> {
  flowId?: string;
  name: string;
  context: SecurityContext;
  execute: (
    state: FlowExecutionState,
    advance: <R>(
      stage: FlowStage,
      operation: () => Promise<FlowStepResult<R>>
    ) => Promise<R>
  ) => Promise<T>;
}

export interface FlowExecutionResult<T = unknown> {
  state: FlowExecutionState;
  output?: T;
}

export interface FlowFailurePolicy {
  classification: FlowFailureClass;
  retryable: boolean;
  preserveState: boolean;
  terminal: boolean;
}
