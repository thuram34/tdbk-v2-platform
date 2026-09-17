/**
 * TDBK V2 — DOCUMENT LIFECYCLE & VERSIONING MANAGER
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION
 * 
 * Rules:
 * - Authoritative State Machine for document transitions.
 * - Illegal transitions rejected with audit logging.
 * - Non-destructive reprocessing: original document is immutable, historical processing recorded in history[].
 */

import { 
  DocumentMetadata, 
  DocumentStatus, 
  DocumentProcessingHistory,
  DocumentRetentionPolicy 
} from '../types';
import { SecurityContext } from '../../kernel/types';
import { tenantIsolation } from '../../kernel/tenancy/tenantIsolation';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { documentStore } from '../storage/documentStore';
import { documentMetadataRepository } from '../../persistence/firestore/repositories/documentMetadataRepository';

export class DocumentLifecycleManager {
  private static instance: DocumentLifecycleManager;

  // Valid state transitions mapping
  private static readonly VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
    UPLOADED: ['VALIDATING', 'ACCEPTED', 'PROCESSING_FAILED'],
    VALIDATING: ['ACCEPTED', 'PROCESSING_FAILED', 'REJECTED'],
    ACCEPTED: ['PROCESSING', 'REVIEW_REQUIRED', 'REJECTED', 'ARCHIVED'],
    PROCESSING: ['EXTRACTED', 'CLASSIFIED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'PROCESSING_FAILED'],
    EXTRACTED: ['CLASSIFIED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'PROCESSING'],
    CLASSIFIED: ['EXTRACTED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'PROCESSING'],
    REVIEW_REQUIRED: ['APPROVED', 'REJECTED', 'PROCESSING', 'ARCHIVED'],
    APPROVED: ['ARCHIVED', 'PROCESSING'],
    REJECTED: ['ARCHIVED', 'PROCESSING'],
    PROCESSING_FAILED: ['PROCESSING', 'REJECTED', 'ARCHIVED'],
    ARCHIVED: ['REVIEW_REQUIRED'], // Can only be unarchived by authorized admin flow
  };

  private constructor() {}

  public static getInstance(): DocumentLifecycleManager {
    if (!DocumentLifecycleManager.instance) {
      DocumentLifecycleManager.instance = new DocumentLifecycleManager();
    }
    return DocumentLifecycleManager.instance;
  }

  public transitionStatus(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string,
    targetStatus: DocumentStatus,
    reason?: string
  ): DocumentMetadata {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const doc = documentStore.getDocument(ctx, tenantId, documentId);
    if (!doc) {
      throw new KernelError('NOT_FOUND', `Document ${documentId} not found`, 404, ctx.requestId);
    }

    const currentStatus = doc.status;

    // Check if transition is valid
    const allowedNext = DocumentLifecycleManager.VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(targetStatus) && currentStatus !== targetStatus) {
      auditLogger.logAuditEvent(ctx, {
        action: 'DOCUMENT_ILLEGAL_STATE_TRANSITION_DENIED',
        targetResource: `document:${documentId}`,
        outcome: 'DENIED',
        details: {
          currentStatus,
          targetStatus,
          allowedNext,
        }
      });
      throw new KernelError(
        'ILLEGAL_STATE_TRANSITION' as any,
        `Cannot transition document from ${currentStatus} to ${targetStatus}. Allowed: [${allowedNext.join(', ')}]`,
        400,
        ctx.requestId
      );
    }

    // Apply status change
    doc.status = targetStatus;
    documentStore.saveDocument(ctx, doc);

    // Audit transition
    auditLogger.logAuditEvent(ctx, {
      action: `DOCUMENT_STATUS_${targetStatus}`,
      targetResource: `document:${documentId}`,
      outcome: 'ALLOWED',
      details: {
        previousStatus: currentStatus,
        newStatus: targetStatus,
        reason,
      }
    });

    return doc;
  }

  public recordProcessingSnapshot(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string,
    snapshot: Omit<DocumentProcessingHistory, 'processingVersion' | 'processedAt'>
  ): DocumentMetadata {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const doc = documentStore.getDocument(ctx, tenantId, documentId);
    if (!doc) {
      throw new KernelError('NOT_FOUND', `Document ${documentId} not found`, 404, ctx.requestId);
    }

    // Increment version
    const versionParts = doc.processingVersion.split('.');
    const nextMinor = parseInt(versionParts[1] || '0', 10) + 1;
    const newVersion = `${versionParts[0]}.${nextMinor}.0`;

    const historyEntry: DocumentProcessingHistory = {
      processingVersion: doc.processingVersion,
      processedAt: new Date().toISOString(),
      ...snapshot,
    };

    doc.history.push(historyEntry);
    doc.processingVersion = newVersion;
    doc.classification = snapshot.classification;
    doc.extractedData = snapshot.extractedFields;
    doc.status = snapshot.status;

    documentStore.saveDocument(ctx, doc);

    auditLogger.logAuditEvent(ctx, {
      action: 'DOCUMENT_PROCESSING_RECORDED',
      targetResource: `document:${documentId}`,
      outcome: 'ALLOWED',
      details: {
        newVersion,
        status: doc.status,
        confidenceAverage: snapshot.confidenceAverage,
        historyEntriesCount: doc.history.length,
      }
    });

    return doc;
  }

  /** Firestore-authoritative production transition. */
  public async transitionPersistentStatus(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string,
    targetStatus: DocumentStatus,
    reason?: string
  ): Promise<DocumentMetadata> {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);
    const doc = await documentStore.getPersistentDocument(ctx, tenantId, documentId);
    if (!doc) throw new KernelError('NOT_FOUND', 'Document not found', 404, ctx.requestId);
    const currentStatus = doc.status;
    const allowedNext = DocumentLifecycleManager.VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(targetStatus) && currentStatus !== targetStatus) {
      auditLogger.logAuditEvent(ctx, {
        action: 'DOCUMENT_ILLEGAL_STATE_TRANSITION_DENIED',
        targetResource: 'document:' + documentId,
        outcome: 'DENIED',
        details: { currentStatus, targetStatus, allowedNext }
      });
      throw new KernelError('ILLEGAL_STATE_TRANSITION' as any, 'Invalid document state transition', 400, ctx.requestId);
    }
    doc.status = targetStatus;
    await documentMetadataRepository.saveDocument(tenantId, documentId, doc);
    auditLogger.logAuditEvent(ctx, {
      action: 'DOCUMENT_STATUS_' + targetStatus,
      targetResource: 'document:' + documentId,
      outcome: 'ALLOWED',
      details: { previousStatus: currentStatus, newStatus: targetStatus, reason }
    });
    return doc;
  }

  /** Firestore-authoritative production processing snapshot. */
  public async recordPersistentProcessingSnapshot(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string,
    snapshot: Omit<DocumentProcessingHistory, 'processingVersion' | 'processedAt'>
  ): Promise<DocumentMetadata> {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);
    const doc = await documentStore.getPersistentDocument(ctx, tenantId, documentId);
    if (!doc) throw new KernelError('NOT_FOUND', 'Document not found', 404, ctx.requestId);
    const versionParts = doc.processingVersion.split('.');
    const nextMinor = parseInt(versionParts[1] || '0', 10) + 1;
    const newVersion = versionParts[0] + '.' + nextMinor + '.0';
    const historyEntry: DocumentProcessingHistory = {
      processingVersion: doc.processingVersion,
      processedAt: new Date().toISOString(),
      ...snapshot,
    };
    doc.history.push(historyEntry);
    doc.processingVersion = newVersion;
    doc.classification = snapshot.classification;
    doc.extractedData = snapshot.extractedFields;
    doc.status = snapshot.status;
    await documentMetadataRepository.saveDocument(tenantId, documentId, doc);
    auditLogger.logAuditEvent(ctx, {
      action: 'DOCUMENT_PROCESSING_RECORDED',
      targetResource: 'document:' + documentId,
      outcome: 'ALLOWED',
      details: { newVersion, status: doc.status, confidenceAverage: snapshot.confidenceAverage, historyEntriesCount: doc.history.length }
    });
    return doc;
  }

  public updateRetentionPolicy(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string,
    policyUpdate: Partial<DocumentRetentionPolicy>
  ): DocumentMetadata {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const doc = documentStore.getDocument(ctx, tenantId, documentId);
    if (!doc) {
      throw new KernelError('NOT_FOUND', `Document ${documentId} not found`, 404, ctx.requestId);
    }

    doc.retentionPolicy = {
      ...doc.retentionPolicy,
      ...policyUpdate,
      policySetBy: ctx.principal.id,
      policySetAt: new Date().toISOString(),
    };

    documentStore.saveDocument(ctx, doc);

    auditLogger.logAuditEvent(ctx, {
      action: 'DOCUMENT_RETENTION_POLICY_UPDATED',
      targetResource: `document:${documentId}`,
      outcome: 'ALLOWED',
      details: {
        legalHold: doc.retentionPolicy.legalHold,
        retentionPeriodDays: doc.retentionPolicy.retentionPeriodDays,
        archiveOnly: doc.retentionPolicy.archiveOnly,
      }
    });

    return doc;
  }
}

export const documentLifecycleManager = DocumentLifecycleManager.getInstance();
