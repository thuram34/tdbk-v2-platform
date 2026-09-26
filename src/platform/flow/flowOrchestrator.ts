/**
 * TDBK V2 — FLOW ORCHESTRATOR
 *
 * Cross-layer coordinator. It does not authenticate, authorize, grant
 * entitlements, replace the runtime, or replace WorkflowEngine.
 */
import { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { classifyFlowFailure, flowFailurePolicyForClassification, isSecurityFailure } from './flowFailurePolicy';
import { FlowExecutionDefinition, FlowExecutionResult, FlowExecutionState, FlowFailureClass, FlowStage } from './flowTypes';

export class FlowOrchestrator {
  public async execute<T>(definition: FlowExecutionDefinition<T>): Promise<FlowExecutionResult<T>> {
    const state = this.createState(definition);
    const context = definition.context;

    auditLogger.logEvent('WORKFLOW_EXECUTION', context.principal.id, 'FLOW_STARTED', `flow:${state.flowId}`, 'ALLOWED', {
      tenantId: state.tenantId,
      branchId: state.branchId,
      requestId: state.requestId,
      details: { name: definition.name, correlationId: state.correlationId },
    });

    state.status = 'RUNNING';

    const advance = async <R>(
      stage: FlowStage,
      operation: () => Promise<{ stage: FlowStage; status: 'COMPLETED' | 'WAITING' | 'FAILED'; output?: R; failureClassification?: FlowFailureClass; error?: string }>
    ): Promise<R> => {
      state.currentStage = stage;
      try {
        const result = await operation();

        if (result.status === 'FAILED') {
          const classification = result.failureClassification || 'INTERNAL';
          this.failState(state, classification, result.error || `Flow stage ${stage} failed`, context);
          throw new KernelError(this.kernelCodeFor(classification), result.error || `Flow stage ${stage} failed`, this.statusFor(classification), context.requestId);
        }

        if (result.status === 'WAITING') {
          state.status = 'WAITING';
          return result.output as R;
        }

        state.completedStages.push(stage);
        return result.output as R;
      } catch (error) {
        const policy = classifyFlowFailure(error);
        this.failState(state, policy.classification, this.safeMessage(error), context);
        throw error;
      }
    };

    try {
      const output = await definition.execute(state, advance);

      if (state.status === 'WAITING') {
        return { state, output };
      }

      state.status = 'COMPLETED';
      state.completedAt = new Date().toISOString();
      state.currentStage = null;

      auditLogger.logEvent('WORKFLOW_EXECUTION', context.principal.id, 'FLOW_COMPLETED', `flow:${state.flowId}`, 'ALLOWED', {
        tenantId: state.tenantId,
        branchId: state.branchId,
        requestId: state.requestId,
        details: { name: definition.name, completedStages: state.completedStages },
      });

      return { state, output };
    } catch (error) {
      throw error;
    }
  }

  public async recover<T>(definition: FlowExecutionDefinition<T>): Promise<FlowExecutionResult<T>> {
    const statefulDefinition = { ...definition, flowId: definition.flowId || `recovery_${Date.now()}` };
    return this.execute(statefulDefinition);
  }

  private createState<T>(definition: FlowExecutionDefinition<T>): FlowExecutionState {
    const context = definition.context;
    return {
      flowId: definition.flowId || `flow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      correlationId: context.correlationId || context.requestId,
      requestId: context.requestId,
      tenantId: context.tenantContext?.tenantId || context.principal.tenantId || null,
      branchId: context.branchContext?.branchId || context.principal.branchId || null,
      principalId: context.principal.id,
      status: 'STARTED',
      currentStage: null,
      completedStages: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      failure: null,
    };
  }

  private failState(state: FlowExecutionState, classification: FlowFailureClass, message: string, context: SecurityContext): void {
    const policy = flowFailurePolicyForClassification(classification);
    state.failure = { classification, retryable: policy.retryable, message };
    state.status = isSecurityFailure(classification) ? 'DENIED' : 'FAILED';
    state.completedAt = new Date().toISOString();

    auditLogger.logEvent('WORKFLOW_EXECUTION', context.principal.id, 'FLOW_FAILED', `flow:${state.flowId}`,
      isSecurityFailure(classification) ? 'DENIED' : 'ERROR', {
        tenantId: state.tenantId,
        branchId: state.branchId,
        requestId: state.requestId,
        details: { classification, retryable: policy.retryable, currentStage: state.currentStage, completedStages: state.completedStages, error: message },
      });
  }

  private safeMessage(error: unknown): string {
    return error instanceof KernelError ? error.message : error instanceof Error ? error.message : String(error);
  }

  private kernelCodeFor(classification: FlowFailureClass): any {
    switch (classification) {
      case 'AUTHENTICATION': return 'AUTHENTICATION_ERROR';
      case 'AUTHORIZATION': return 'AUTHORIZATION_ERROR';
      case 'TENANT_ISOLATION': return 'TENANT_ISOLATION_ERROR';
      case 'VALIDATION': return 'VALIDATION_ERROR';
      case 'CONFLICT': return 'CONFLICT';
      case 'NOT_FOUND': return 'NOT_FOUND';
      default: return 'INTERNAL_ERROR';
    }
  }

  private statusFor(classification: FlowFailureClass): number {
    switch (classification) {
      case 'AUTHENTICATION': return 401;
      case 'AUTHORIZATION':
      case 'TENANT_ISOLATION': return 403;
      case 'VALIDATION': return 422;
      case 'CONFLICT': return 409;
      case 'NOT_FOUND': return 404;
      default: return 500;
    }
  }
}

export const flowOrchestrator = new FlowOrchestrator();
