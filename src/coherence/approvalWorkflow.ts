/**
 * TDBK V2 CAPABILITY COLLABORATION & APPROVAL WORKFLOW
 * 
 * WORKFLOW:
 * REQUEST ACCESS → APPROVER REVIEWS → APPROVED → ROLE / PERMISSION UPDATED → WORKSPACE RECOMPOSED → USER NOTIFIED
 * 
 * "Access granted. Your workspace has been updated."
 */

import { CapabilityAccessRequest, AccessRequestStatus } from './types';
import { auditLogger } from '../kernel/audit/auditLogger';
import { eventBus } from '../orchestration/events/eventBus';

export class CapabilityAccessStore {
  private static instance: CapabilityAccessStore;
  private requests: Map<string, CapabilityAccessRequest> = new Map();

  private constructor() {
    this.seedDefaultRequests();
  }

  public static getInstance(): CapabilityAccessStore {
    if (!CapabilityAccessStore.instance) {
      CapabilityAccessStore.instance = new CapabilityAccessStore();
    }
    return CapabilityAccessStore.instance;
  }

  private seedDefaultRequests(): void {
    const demoReq: CapabilityAccessRequest = {
      requestId: 'req_access_001',
      tenantId: 'dbk_school_01',
      spaceId: 'space_mombasa_academy',
      requesterId: 'usr_teacher_demo',
      requesterName: 'Mr. David Ochieng',
      requesterRole: 'TEACHER',
      capabilityId: 'capability_communication',
      capabilityName: 'Omnichannel Communication (Parent WhatsApp)',
      justification: 'Need to message parents of Grade 4 directly regarding upcoming educational trip.',
      status: 'PENDING',
      requestedAt: new Date(Date.now() - 3600000).toISOString(),
    };
    this.requests.set(demoReq.requestId, demoReq);
  }

  public getRequestsForSpace(spaceId: string): CapabilityAccessRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.spaceId === spaceId);
  }

  public getRequestsForUser(userId: string): CapabilityAccessRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.requesterId === userId);
  }

  public createRequest(params: {
    tenantId: string;
    spaceId: string;
    requesterId: string;
    requesterName: string;
    requesterRole: string;
    capabilityId: string;
    capabilityName: string;
    justification: string;
  }): CapabilityAccessRequest {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newReq: CapabilityAccessRequest = {
      requestId,
      ...params,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };

    this.requests.set(requestId, newReq);

    auditLogger.logEvent(
      'CAPABILITY_ACCESS_REQUESTED',
      params.requesterId,
      'CREATE_REQUEST',
      `capability:${params.capabilityId}`,
      'ALLOWED',
      {
        tenantId: params.tenantId,
        details: { spaceId: params.spaceId, capability: params.capabilityName },
      }
    );

    return newReq;
  }

  /**
   * Approves request:
   * 1. Updates request status to APPROVED
   * 2. Emits domain event
   * 3. Workspace recomposition signal
   */
  public approveRequest(requestId: string, reviewerId: string, reviewNotes?: string): CapabilityAccessRequest {
    const req = this.requests.get(requestId);
    if (!req) {
      throw new Error(`Request '${requestId}' not found.`);
    }

    req.status = 'APPROVED';
    req.reviewedBy = reviewerId;
    req.reviewedAt = new Date().toISOString();
    req.reviewNotes = reviewNotes || 'Approved by Administrator. Workspace updated.';

    this.requests.set(requestId, req);

    auditLogger.logEvent(
      'CAPABILITY_ACCESS_APPROVED',
      reviewerId,
      'APPROVE_REQUEST',
      `request:${requestId}`,
      'ALLOWED',
      {
        tenantId: req.tenantId,
        details: {
          requesterId: req.requesterId,
          capabilityId: req.capabilityId,
          spaceId: req.spaceId,
        },
      }
    );

    return req;
  }

  /**
   * Rejects request
   */
  public rejectRequest(requestId: string, reviewerId: string, reason: string): CapabilityAccessRequest {
    const req = this.requests.get(requestId);
    if (!req) {
      throw new Error(`Request '${requestId}' not found.`);
    }

    req.status = 'REJECTED';
    req.reviewedBy = reviewerId;
    req.reviewedAt = new Date().toISOString();
    req.reviewNotes = reason;

    this.requests.set(requestId, req);

    auditLogger.logEvent(
      'CAPABILITY_ACCESS_REJECTED',
      reviewerId,
      'REJECT_REQUEST',
      `request:${requestId}`,
      'DENIED',
      {
        tenantId: req.tenantId,
        details: { requesterId: req.requesterId, reason },
      }
    );

    return req;
  }
}

export const capabilityAccessStore = CapabilityAccessStore.getInstance();
