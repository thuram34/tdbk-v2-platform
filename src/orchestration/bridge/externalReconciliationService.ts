import { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { workflowStepExecutionRepository } from '../../persistence/firestore/repositories/workflowStepExecutionRepository';
import { bridgeRegistry } from './registry';

export class ExternalReconciliationService {
  private static instance: ExternalReconciliationService;
  private constructor() {}

  public static getInstance(): ExternalReconciliationService {
    return (this.instance ??= new ExternalReconciliationService());
  }

  public async reconcile(
    context: SecurityContext,
    executionKey: string,
  ): Promise<{ status: 'RECONCILED_SUCCESS' | 'RECONCILED_FAILURE' | 'STILL_PENDING'; execution: unknown; providerResult?: unknown }> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'Reconciliation requires an authoritative tenant context.', 403, context.requestId);

    await masterAuthority.assertTenantAuthority(context, tenantId, 'RECONCILE_EXTERNAL_OPERATION', context.requestId);

    const authorized = masterAuthority.isMasterAdmin(context.principal)
      || masterAuthority.isOwnerPortfolio(context.principal)
      || await rbacEngine.hasAnyRoleForContext(
        context.principal,
        ['TENANT_ADMIN', 'DBK_ADMIN', 'FINANCE_OFFICER'],
        tenantId,
        context.branchContext?.branchId || context.principal.branchId || null,
      );

    if (!authorized) {
      throw new KernelError('AUTHORIZATION_ERROR', 'External reconciliation requires tenant administration or finance authority.', 403, context.requestId);
    }

    const execution = await workflowStepExecutionRepository.getExecution(tenantId, executionKey);
    if (!execution) throw new KernelError('NOT_FOUND', `Workflow execution '${executionKey}' not found.`, 404, context.requestId);

    if (execution.outcomeState !== 'UNKNOWN_OUTCOME' && execution.outcomeState !== 'RECONCILIATION_REQUIRED') {
      throw new KernelError('CONFLICT', `Execution '${executionKey}' is not awaiting reconciliation.`, 409, context.requestId);
    }
    if (!execution.providerReconciliationSupported) {
      throw new KernelError('CONFLICT', `Provider '${execution.providerName || 'unknown'}' does not expose an authoritative reconciliation contract.`, 409, context.requestId);
    }
    if (!execution.providerReference) {
      throw new KernelError('CONFLICT', `Execution '${executionKey}' has no provider reference to reconcile.`, 409, context.requestId);
    }

    const bridge = this.resolveBridge(execution.providerName);
    const operation = this.reconciliationOperation(execution.providerName, execution.providerOperation);
    const payload = this.reconciliationPayload(operation, execution.providerReference);

    const providerResult = await bridge.execute(context, operation, payload);
    if (providerResult.status === 'SUCCESS') {
      const reconciled = await workflowStepExecutionRepository.recordReconciliation(
        tenantId,
        executionKey,
        'RECONCILED_SUCCESS',
        { reconciliation: providerResult.data || providerResult, providerReference: execution.providerReference },
      );
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'EXTERNAL_OPERATION_RECONCILED', `execution:${executionKey}`, 'ALLOWED', {
        tenantId,
        requestId: context.requestId,
        details: { provider: execution.providerName, outcome: 'RECONCILED_SUCCESS', providerReference: execution.providerReference },
      });
      return { status: 'RECONCILED_SUCCESS', execution: reconciled, providerResult };
    }

    if (providerResult.status === 'FAILED') {
      const reconciled = await workflowStepExecutionRepository.recordReconciliation(
        tenantId,
        executionKey,
        'RECONCILED_FAILURE',
        { error: providerResult.errorDetails || 'Provider reported a failed operation', reconciliation: providerResult.data || providerResult, providerReference: execution.providerReference },
      );
      auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'EXTERNAL_OPERATION_RECONCILED', `execution:${executionKey}`, 'ALLOWED', {
        tenantId,
        requestId: context.requestId,
        details: { provider: execution.providerName, outcome: 'RECONCILED_FAILURE', providerReference: execution.providerReference },
      });
      return { status: 'RECONCILED_FAILURE', execution: reconciled, providerResult };
    }

    return { status: 'STILL_PENDING', execution, providerResult };
  }

  private resolveBridge(providerName?: string) {
    const map: Record<string, string> = {
      SAFARICOM_MPESA: 'bridge_mpesa',
    };
    const bridgeId = providerName ? map[providerName] : undefined;
    if (!bridgeId) {
      throw new KernelError('INTEGRATION_UNAVAILABLE', `No authoritative reconciliation adapter is registered for provider '${providerName || 'unknown'}'.`, 503);
    }
    const bridge = bridgeRegistry.getBridgeInstance(bridgeId);
    if (!bridge) throw new KernelError('INTEGRATION_UNAVAILABLE', `Reconciliation adapter '${bridgeId}' is not registered.`, 503);
    return bridge;
  }

  private reconciliationOperation(providerName: string | undefined, originalOperation?: string | null): string {
    if (providerName !== 'SAFARICOM_MPESA') {
      throw new KernelError('INTEGRATION_UNAVAILABLE', `Provider '${providerName || 'unknown'}' has no reconciliation operation mapping.`, 503);
    }
    if (originalOperation === 'STK_PUSH') return 'STK_QUERY';
    if (originalOperation === 'QUERY_TRANSACTION' || originalOperation === 'C2B_REGISTER_URL') return 'QUERY_TRANSACTION';
    throw new KernelError('VALIDATION_ERROR', `M-Pesa operation '${originalOperation || 'unknown'}' cannot be reconciled automatically.`, 400);
  }

  private reconciliationPayload(operation: string, providerReference: string): Record<string, unknown> {
    if (operation === 'STK_QUERY') return { checkoutRequestId: providerReference };
    return { transactionId: providerReference };
  }
}

export const externalReconciliationService = ExternalReconciliationService.getInstance();
