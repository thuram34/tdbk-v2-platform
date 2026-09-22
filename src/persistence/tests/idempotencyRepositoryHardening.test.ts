import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../firestore/firestoreClient';
import { idempotencyRepository } from '../firestore/repositories/idempotencyRepository';
import type { IdempotencyRecord } from '../types';

const baseRecord = (overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord => ({
  idempotencyKey: 'hardening-key',
  tenantId: 'tenant-hardening',
  action: 'HARDENING_TEST',
  requestHash: 'request-a',
  status: 'IN_PROGRESS',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  ...overrides,
});

describe('IdempotencyRepository request binding hardening', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
  });

  it('rejects a different request hash when an existing claim has expired', async () => {
    const expired = baseRecord({
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    await idempotencyRepository.saveIdempotencyRecord(
      expired.tenantId,
      expired.idempotencyKey,
      expired,
    );

    const replacement = baseRecord({ requestHash: 'request-b' });

    await expect(
      idempotencyRepository.claimIdempotencyRecord(
        replacement.tenantId,
        replacement.idempotencyKey,
        replacement,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    const persisted = await idempotencyRepository.getIdempotencyRecord(
      expired.tenantId,
      expired.idempotencyKey,
    );
    expect(persisted?.requestHash).toBe('request-a');
    expect(persisted?.status).toBe('IN_PROGRESS');
  });

  it('allows an expired claim to be reclaimed only by the same request hash', async () => {
    const expired = baseRecord({
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    await idempotencyRepository.saveIdempotencyRecord(
      expired.tenantId,
      expired.idempotencyKey,
      expired,
    );

    const replacement = baseRecord({
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expect(
      idempotencyRepository.claimIdempotencyRecord(
        replacement.tenantId,
        replacement.idempotencyKey,
        replacement,
      ),
    ).resolves.toBe('CLAIMED');

    const persisted = await idempotencyRepository.getIdempotencyRecord(
      expired.tenantId,
      expired.idempotencyKey,
    );
    expect(persisted?.requestHash).toBe('request-a');
    expect(persisted?.status).toBe('IN_PROGRESS');
  });

  it('rejects a different request hash even when the existing request is completed', async () => {
    const completed = baseRecord({
      requestHash: 'request-a',
      status: 'COMPLETED',
      responsePayload: { result: 'original' },
    });
    await idempotencyRepository.saveIdempotencyRecord(
      completed.tenantId,
      completed.idempotencyKey,
      completed,
    );

    const replacement = baseRecord({ requestHash: 'request-b' });

    await expect(
      idempotencyRepository.claimIdempotencyRecord(
        replacement.tenantId,
        replacement.idempotencyKey,
        replacement,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
