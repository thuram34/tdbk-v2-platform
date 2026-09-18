/**
 * TDBK V2 CAPABILITY COLLABORATION & APPROVAL WORKFLOW
 *
 * Durable production authority lives in Firestore. The in-memory map below is
 * retained only for legacy/test fixtures and never gates production access.
 */

import { CapabilityAccessRequest } from './types';
import { auditLogger } from '../kernel/audit/auditLogger';
import { SecurityContext } from '../kernel/types';
import { masterAuthority } from '../kernel/master/masterAuthority';
import { accessRequestRepository } from '../persistence/firestore/repositories/accessRequestRepository';

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

  private assertTenant(context: SecurityContext, tenantId: string, action: string): void {
    if (masterAuthority.isMasterAdmin(context.principal)) return;
    if (context.principal.tenantId !== tenantId) {
      throw new Error(`Tenant boundary violation while attempting to ${action}.`);
    }
  }

  private buildRequest(params: {
    tenantId: string;
    spaceId: string;
    requesterId: string;
    requesterName: string;
    requesterRole: string;
    capabilityId: string;
    capabilityName: string;
    justification: string;
  }): CapabilityAccessRequest {
    return {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...params,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };
  }

  /** Durable production path: persist first; only then publish the success-side audit. */
  public async createPersistentRequest(context: SecurityContext, params: {
    tenantId: string;
    spaceId: string;
    requesterId: string;
    requesterName: string;
    requesterRole: string;
    capabilityId: string;
    capabilityName: string;
    justification: string;
  }): Promise<CapabilityAccessRequest> {
    this.assertTenant(context, params.tenantId, 'create access request');
    if (params.requesterId !== context.principal.id && !masterAuthority.isMasterAdmin(context.principal)) {
      throw new Error('Requester identity does not match authenticated principal.');
    }

    const request = this.buildRequest(params);
    await accessRequestRepository.saveRequest(params.tenantId, request.requestId, request);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      params.requesterId,
      'CAPABILITY_ACCESS_REQUESTED',
      `capability:${params.capabilityId}`,
      'ALLOWED',
      {
        tenantId: params.tenantId,
        details: { spaceId: params.spaceId, capability: params.capabilityName, requestId: request.requestId },
      }
    );

    return request;
  }

  public async listPersistentRequestsForSpace(context: SecurityContext, tenantId: string, spaceId: string): Promise<CapabilityAccessRequest[]> {
    this.assertTenant(context, tenantId, 'list access requests');
    const requests = await accessRequestRepository.listRequests(tenantId, spaceId);
    if (requests.length === 0 && process.env.NODE_ENV === 'test') {
      return this.getRequestsForSpace(spaceId).filter((request) => request.tenantId === tenantId);
    }
    return requests;
  }

  public async listPersistentRequestsForUser(context: SecurityContext, tenantId: string, userId: string): Promise<CapabilityAccessRequest[]> {
    this.assertTenant(context, tenantId, 'list user access requests');
    const requests = await accessRequestRepository.listRequests(tenantId, undefined, userId);
    if (requests.length === 0 && process.env.NODE_ENV === 'test') {
      return this.getRequestsForUser(userId).filter((request) => request.tenantId === tenantId);
    }
    return requests;
  }

  /** Durable compare-and-set approval transition. */
  public async approvePersistentRequest(context: SecurityContext, requestId: string, tenantId: string, reviewerId: string, reviewNotes?: string): Promise<CapabilityAccessRequest> {
    this.assertTenant(context, tenantId, 'approve access request');
    if (reviewerId !== context.principal.id) throw new Error('Reviewer identity does not match authenticated principal.');

    const approved = await accessRequestRepository.transitionRequest(
      tenantId, requestId, 'PENDING', 'APPROVED', reviewerId,
      reviewNotes || 'Approved by Administrator. Workspace updated.'
    );

    this.requests.set(requestId, approved);
    auditLogger.logEvent('SECURITY_CONFIGURATION_CHANGE', reviewerId, 'CAPABILITY_ACCESS_APPROVED', `request:${requestId}`, 'ALLOWED', {
      tenantId: approved.tenantId,
      details: { requesterId: approved.requesterId, capabilityId: approved.capabilityId, spaceId: approved.spaceId },
    });
    return approved;
  }

  /** Durable compare-and-set rejection transition. */
  public async rejectPersistentRequest(context: SecurityContext, requestId: string, tenantId: string, reviewerId: string, reason: string): Promise<CapabilityAccessRequest> {
    this.assertTenant(context, tenantId, 'reject access request');
    if (reviewerId !== context.principal.id) throw new Error('Reviewer identity does not match authenticated principal.');

    const rejected = await accessRequestRepository.transitionRequest(tenantId, requestId, 'PENDING', 'REJECTED', reviewerId, reason);
    this.requests.set(requestId, rejected);
    auditLogger.logEvent('AUTHORIZATION_DENIED', reviewerId, 'CAPABILITY_ACCESS_REJECTED', `request:${requestId}`, 'DENIED', {
      tenantId: rejected.tenantId,
      details: { requesterId: rejected.requesterId, reason },
    });
    return rejected;
  }

  public getRequestsForSpace(spaceId: string): CapabilityAccessRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.spaceId === spaceId);
  }

  public getRequestsForUser(userId: string): CapabilityAccessRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.requesterId === userId);
  }

  /** Legacy synchronous/test API. Production callers must use createPersistentRequest. */
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
    const newReq = this.buildRequest(params);
    this.requests.set(newReq.requestId, newReq);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      params.requesterId,
      'CAPABILITY_ACCESS_REQUESTED',
      `capability:${params.capabilityId}`,
      'ALLOWED',
      {
        tenantId: params.tenantId,
        details: { spaceId: params.spaceId, capability: params.capabilityName, requestId: newReq.requestId },
      }
    );

    return newReq;
  }

  public approveRequest(requestId: string, reviewerId: string, reviewNotes?: string): CapabilityAccessRequest {
    const req = this.requests.get(requestId);
    if (!req) throw new Error(`Request '${requestId}' not found.`);

    req.status = 'APPROVED';
    req.reviewedBy = reviewerId;
    req.reviewedAt = new Date().toISOString();
    req.reviewNotes = reviewNotes || 'Approved by Administrator. Workspace updated.';
    this.requests.set(requestId, req);

    auditLogger.logEvent('SECURITY_CONFIGURATION_CHANGE', reviewerId, 'CAPABILITY_ACCESS_APPROVED', `request:${requestId}`, 'ALLOWED', {
      tenantId: req.tenantId,
      details: { requesterId: req.requesterId, capabilityId: req.capabilityId, spaceId: req.spaceId },
    });
    return req;
  }

  public rejectRequest(requestId: string, reviewerId: string, reason: string): CapabilityAccessRequest {
    const req = this.requests.get(requestId);
    if (!req) throw new Error(`Request '${requestId}' not found.`);

    req.status = 'REJECTED';
    req.reviewedBy = reviewerId;
    req.reviewedAt = new Date().toISOString();
    req.reviewNotes = reason;
    this.requests.set(requestId, req);

    auditLogger.logEvent('AUTHORIZATION_DENIED', reviewerId, 'CAPABILITY_ACCESS_REJECTED', `request:${requestId}`, 'DENIED', {
      tenantId: req.tenantId,
      details: { requesterId: req.requesterId, reason },
    });
    return req;
  }
}

export const capabilityAccessStore = CapabilityAccessStore.getInstance();
