/**
 * Deterministic provider-operation identity for external side effects.
 * Canonical input is the durable Engine execution identity plus connector operation.
 */
import { createHash } from 'node:crypto';

export function deriveProviderOperationIdentity(executionKey: string, operation: string): string {
  const canonicalExecutionKey = executionKey.trim();
  const canonicalOperation = operation.trim();
  if (!canonicalExecutionKey || !canonicalOperation) throw new Error('executionKey and connector operation are required');
  return `tdbk-op-v1_${createHash('sha256').update(canonicalExecutionKey).update('\\0').update(canonicalOperation).digest('hex')}`;
}
