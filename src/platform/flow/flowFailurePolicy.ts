import { FlowFailureClass, FlowFailurePolicy } from './flowTypes';
import { AuthenticationError, AuthorizationError, KernelError } from '../../kernel/errors/kernelErrors';

export function classifyFlowFailure(error: unknown): FlowFailurePolicy {
  if (error instanceof AuthenticationError || (error instanceof KernelError && error.code === 'AUTHENTICATION_ERROR'))
    return { classification: 'AUTHENTICATION', retryable: false, preserveState: true, terminal: true };

  if (error instanceof AuthorizationError || (error instanceof KernelError && error.code === 'AUTHORIZATION_ERROR'))
    return { classification: 'AUTHORIZATION', retryable: false, preserveState: true, terminal: true };

  if (error instanceof KernelError && error.code === 'TENANT_ISOLATION_ERROR')
    return { classification: 'TENANT_ISOLATION', retryable: false, preserveState: true, terminal: true };

  if (error instanceof KernelError && error.code === 'VALIDATION_ERROR')
    return { classification: 'VALIDATION', retryable: false, preserveState: true, terminal: true };

  if (error instanceof KernelError && error.code === 'CONFLICT')
    return { classification: 'CONFLICT', retryable: true, preserveState: true, terminal: false };

  if (error instanceof KernelError && error.code === 'NOT_FOUND')
    return { classification: 'NOT_FOUND', retryable: false, preserveState: true, terminal: true };

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (/timeout|timed out|temporarily unavailable|network|econnreset|provider busy|service unavailable/.test(normalized))
    return { classification: 'TRANSIENT', retryable: true, preserveState: true, terminal: false };

  if (/unknown outcome|reconciliation required/.test(normalized))
    return { classification: 'EXTERNAL_UNKNOWN', retryable: false, preserveState: true, terminal: false };

  if (/firestore|persistence|database|failed-precondition/.test(normalized))
    return { classification: 'PERSISTENCE', retryable: true, preserveState: true, terminal: false };

  return { classification: 'INTERNAL', retryable: false, preserveState: true, terminal: true };
}

export function isSecurityFailure(classification: FlowFailureClass): boolean {
  return classification === 'AUTHENTICATION' ||
    classification === 'AUTHORIZATION' ||
    classification === 'TENANT_ISOLATION';
}
