/**
 * TDBK V2 — DURABLE EXTERNAL SIDE-EFFECT GUARD
 *
 * Provider calls can succeed while the caller crashes before recording the
 * response. This guard creates a tenant-scoped durable claim before the call
 * and refuses blind replay while that claim is unresolved.
 */
import { createHash } from 'node:crypto';
import { idempotencyRepository } from '../../persistence/firestore/repositories/idempotencyRepository';
import type { IdempotencyRecord } from '../../persistence/types';
import { KernelError } from '../../kernel/errors/kernelErrors';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function externalOperationRequestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

export type ExternalOperationClaim =
  | { state: 'CLAIMED'; key: string }
  | { state: 'COMPLETED'; key: string; response: Record<string, unknown> }
  | { state: 'IN_PROGRESS'; key: string };

export async function claimExternalOperation(
  tenantId: string,
  key: string,
  action: string,
  request: unknown,
  expiresInMs = 7 * 24 * 60 * 60 * 1000,
): Promise<ExternalOperationClaim> {
  if (!tenantId || !key || !action) {
    throw new KernelError('VALIDATION_ERROR', 'External operation identity requires tenantId, key and action', 400);
  }

  const requestHash = externalOperationRequestHash(request);
  const existing = await idempotencyRepository.getIdempotencyRecord(tenantId, key);

  if (existing?.requestHash !== undefined && existing.requestHash !== requestHash) {
    throw new KernelError(
      'VALIDATION_ERROR',
      `External operation key '${key}' was already used for a different request.`,
      409,
    );
  }

  // An unresolved provider call must never become automatically replayable just
  // because a lease/claim expired. Recovery must be explicit and authoritative.
  if (existing?.status === 'IN_PROGRESS') {
    return { state: 'IN_PROGRESS', key };
  }

  if (existing?.status === 'COMPLETED') {
    if (!existing.responsePayload) {
      throw new KernelError('CONFLICT', `Completed external operation '${key}' has no durable response.`, 409);
    }
    return { state: 'COMPLETED', key, response: existing.responsePayload };
  }

  const record: IdempotencyRecord = {
    idempotencyKey: key,
    tenantId,
    action,
    requestHash,
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  };
  const claimed = await idempotencyRepository.claimIdempotencyRecord(tenantId, key, record);
  if (claimed === 'COMPLETED') {
    const completed = await idempotencyRepository.getIdempotencyRecord(tenantId, key);
    if (!completed?.responsePayload) {
      throw new KernelError('CONFLICT', `Completed external operation '${key}' has no durable response.`, 409);
    }
    return { state: 'COMPLETED', key, response: completed.responsePayload };
  }
  if (claimed === 'IN_PROGRESS') return { state: 'IN_PROGRESS', key };
  return { state: 'CLAIMED', key };
}

export async function completeExternalOperation(
  tenantId: string,
  key: string,
  response: Record<string, unknown>,
): Promise<void> {
  await idempotencyRepository.completeIdempotencyRecord(tenantId, key, response);
}

export async function failExternalOperation(
  tenantId: string,
  key: string,
  error: string,
): Promise<void> {
  await idempotencyRepository.failIdempotencyRecord(tenantId, key, { error });
}
