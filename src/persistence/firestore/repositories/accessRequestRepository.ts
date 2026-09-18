/**
 * TDBK V2 — CAPABILITY ACCESS REQUEST REPOSITORY
 * Firestore Path: /tenants/{tenantId}/access_requests/{requestId}
 *
 * Approval requests are business authorization state, not process-local state.
 * Production reads and transitions therefore come from Firestore.
 */

import { IAccessRequestRepository } from '../../types';
import { CapabilityAccessRequest, AccessRequestStatus } from '../../../coherence/types';
import { firestoreClient } from '../firestoreClient';
import type { EventEnvelope, OutboxRecord } from '../../types';

export class AccessRequestRepository implements IAccessRequestRepository {
  private static instance: AccessRequestRepository;

  private constructor() {}

  public static getInstance(): AccessRequestRepository {
    if (!AccessRequestRepository.instance) {
      AccessRequestRepository.instance = new AccessRequestRepository();
    }
    return AccessRequestRepository.instance;
  }

  private getPath(tenantId: string, requestId: string): string {
    return `/tenants/${tenantId}/access_requests/${requestId}`;
  }

  public async saveRequest(tenantId: string, requestId: string, request: CapabilityAccessRequest): Promise<void> {
    if (request.tenantId !== tenantId) {
      throw new Error('Access request tenant boundary violation.');
    }
    await firestoreClient.set(this.getPath(tenantId, requestId), request as unknown as Record<string, unknown>);
  }

  public async getRequest(tenantId: string, requestId: string): Promise<CapabilityAccessRequest | null> {
    return await firestoreClient.get<CapabilityAccessRequest>(this.getPath(tenantId, requestId));
  }

  public async listRequests(tenantId: string, spaceId?: string, requesterId?: string): Promise<CapabilityAccessRequest[]> {
    const requests = await firestoreClient.listCollection<CapabilityAccessRequest>(
      `/tenants/${tenantId}/access_requests`
    );
    return requests.filter((request) =>
      request.tenantId === tenantId &&
      (!spaceId || request.spaceId === spaceId) &&
      (!requesterId || request.requesterId === requesterId)
    );
  }

  public async transitionRequest(
    tenantId: string,
    requestId: string,
    expectedStatus: AccessRequestStatus,
    nextStatus: AccessRequestStatus,
    reviewedBy: string,
    reviewNotes: string
  ): Promise<CapabilityAccessRequest> {
    return await firestoreClient.runTransaction(async (transaction) => {
      const path = this.getPath(tenantId, requestId);
      const request = await transaction.get<CapabilityAccessRequest>(path);
      if (!request) throw new Error(`Request '${requestId}' not found.`);
      if (request.tenantId !== tenantId) throw new Error('Access request tenant boundary violation.');
      if (request.status !== expectedStatus) {
        throw new Error(`Request '${requestId}' is already ${request.status}; expected ${expectedStatus}.`);
      }

      const updated: CapabilityAccessRequest = {
        ...request,
        status: nextStatus,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        reviewNotes,
      };
      await transaction.set(path, updated as unknown as Record<string, unknown>);

      // Authorization lifecycle state and its downstream notification/recovery
      // event are one durable unit. A crash cannot leave an approved/rejected
      // request without the corresponding outbox record.
      if (nextStatus === 'APPROVED' || nextStatus === 'REJECTED') {
        const eventId = `evt_access_request_${nextStatus.toLowerCase()}_${requestId}`;
        const now = new Date().toISOString();
        const event: EventEnvelope = {
          eventId,
          eventType: nextStatus === 'APPROVED'
            ? 'access.request_approved.v1'
            : 'access.request_rejected.v1',
          eventVersion: 'v1',
          source: 'access_request_repository',
          tenantId,
          branchId: null,
          principalId: reviewedBy,
          correlationId: `corr_${requestId}`,
          causationId: requestId,
          occurredAt: updated.reviewedAt || now,
          payload: {
            requestId,
            spaceId: updated.spaceId,
            requesterId: updated.requesterId,
            capabilityId: updated.capabilityId,
            status: updated.status,
            reviewedBy,
            reviewNotes,
          },
          metadata: {},
        };
        const outbox: OutboxRecord = {
          eventId,
          tenantId,
          branchId: null,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          occurredAt: event.occurredAt,
          correlationId: event.correlationId,
          causationId: event.causationId || null,
          source: event.source,
          payload: event.payload,
          status: 'PENDING',
          attemptCount: 0,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
          leaseOwner: null,
          leaseUntil: null,
          lastError: null,
          deliveredAt: null,
        };
        await transaction.set(`/tenants/${tenantId}/outbox/${eventId}`, outbox as unknown as Record<string, unknown>);
      }
      return updated;
    });
  }
}

export const accessRequestRepository = AccessRequestRepository.getInstance();
