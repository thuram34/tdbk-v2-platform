/**
 * TDBK V2 — DOCUMENT INGESTION SERVICE
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION
 * 
 * Rules:
 * - Accepts supported document inputs (PDF, IMAGE, CSV, SPREADSHEET, TEXT, JSON).
 * - Authoritative metadata creation and SHA-256 checksum integrity.
 * - Duplicate detection scoped to tenant.
 * - Strict tenant isolation & branch boundary validation.
 * - Non-destructive storage pipeline.
 */

import crypto from 'crypto';
import { 
  DocumentMetadata, 
  DocumentType, 
  DocumentRetentionPolicy 
} from '../types';
import { SecurityContext } from '../../kernel/types';
import { tenantIsolation } from '../../kernel/tenancy/tenantIsolation';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { documentStore } from '../storage/documentStore';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { dbkRegistry } from '../../platform/dbkRegistry';

export interface IngestDocumentRequest {
  tenantId: string;
  branchId: string;
  fileName: string;
  mimeType: string;
  fileBufferBase64?: string;
  textContent?: string;
  source?: 'MANUAL_UPLOAD' | 'API_BRIDGE' | 'EMAIL_INGEST' | 'MOBILE_CAPTURE';
  customRetentionDays?: number;
  causationId?: string;
}

export class DocumentIngestionService {
  private static instance: DocumentIngestionService;

  private constructor() {}

  public static getInstance(): DocumentIngestionService {
    if (!DocumentIngestionService.instance) {
      DocumentIngestionService.instance = new DocumentIngestionService();
    }
    return DocumentIngestionService.instance;
  }

  public detectDocumentType(mimeType: string, fileName: string): DocumentType {
    const lowerMime = mimeType.toLowerCase();
    const lowerName = fileName.toLowerCase();

    if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
      return 'PDF';
    }
    if (lowerMime.includes('image') || lowerName.match(/\.(png|jpg|jpeg|webp|gif)$/)) {
      return 'IMAGE';
    }
    if (lowerMime.includes('csv') || lowerName.endsWith('.csv')) {
      return 'CSV';
    }
    if (lowerMime.includes('sheet') || lowerMime.includes('excel') || lowerName.match(/\.(xls|xlsx)$/)) {
      return 'SPREADSHEET';
    }
    if (lowerMime.includes('json') || lowerName.endsWith('.json')) {
      return 'JSON';
    }
    if (lowerMime.includes('text') || lowerName.endsWith('.txt')) {
      return 'TEXT';
    }

    // Default to TEXT for plain structured data
    return 'TEXT';
  }

  public calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public async ingestDocument(
    ctx: SecurityContext,
    req: IngestDocumentRequest
  ): Promise<DocumentMetadata> {
    // 1. Authoritative Tenant Isolation Check
    await masterAuthority.assertTenantAuthority(ctx.principal, req.tenantId, 'INGEST_DOCUMENT', ctx.requestId);

    // 1b. Check DBK status (Suspended DBK cannot ingest documents)
    const tenant = await dbkRegistry.getDbk(ctx, req.tenantId);
    if (tenant && tenant.status === 'SUSPENDED') {
      throw new KernelError(
        'FORBIDDEN_OPERATION' as any,
        `Tenant '${req.tenantId}' is currently suspended. Document ingestion disallowed.`,
        403,
        ctx.requestId
      );
    }

    // 2. Authoritative Branch Scoping Check
    if (ctx.principal.branchId && ctx.principal.branchId !== req.branchId && !ctx.principal.isMaster) {
      throw new KernelError(
        'AUTHORIZATION_DENIED' as any,
        `Caller branch ${ctx.principal.branchId} cannot ingest documents for branch ${req.branchId}`,
        403,
        ctx.requestId
      );
    }

    // 3. Validate content
    const rawContent = req.fileBufferBase64 || req.textContent;
    if (!rawContent || rawContent.trim().length === 0) {
      throw new KernelError(
        'VALIDATION_ERROR',
        'Cannot ingest empty document payload',
        400,
        ctx.requestId
      );
    }

    // 4. Calculate File Integrity & Checksum
    const checksum = this.calculateChecksum(rawContent);
    const fileSize = Buffer.byteLength(rawContent, 'utf8');

    // 5. Duplicate Detection (within Tenant Scope)
    const existing = await documentStore.findPersistentByChecksum(ctx, req.tenantId, checksum);
    if (existing) {
      auditLogger.logAuditEvent(ctx, {
        action: 'DOCUMENT_DUPLICATE_DETECTED',
        targetResource: `document:${existing.documentId}`,
        outcome: 'ALLOWED',
        details: { checksum, originalDocumentId: existing.documentId, fileName: req.fileName }
      });
      // Return existing document if already present
      return existing;
    }

    // 6. Assemble Authoritative Metadata
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const documentType = this.detectDocumentType(req.mimeType, req.fileName);
    const storagePath = documentStore.getCanonicalStoragePath(req.tenantId, req.branchId, documentId);

    const defaultRetention: DocumentRetentionPolicy = {
      retentionPeriodDays: req.customRetentionDays || 365 * 7, // 7 years default business record retention
      legalHold: false,
      archiveOnly: true,
      policySetBy: ctx.principal.id,
      policySetAt: new Date().toISOString(),
    };

    const metadata: DocumentMetadata = {
      documentId,
      tenantId: req.tenantId,
      branchId: req.branchId,
      uploadedBy: ctx.principal.id,
      uploadedAt: new Date().toISOString(),
      documentType,
      mimeType: req.mimeType,
      fileName: req.fileName,
      fileSize,
      checksum,
      status: 'ACCEPTED',
      source: req.source || 'MANUAL_UPLOAD',
      storagePath,
      processingVersion: '1.0.0',
      history: [],
      retentionPolicy: defaultRetention,
      correlationId: ctx.correlationId,
      causationId: req.causationId,
      contentSnippet: req.textContent ? req.textContent.substring(0, 500) : undefined,
    };

    // 7. Store document
    await documentStore.persistDocument(ctx, metadata);
    await documentStore.persistRawContent(ctx, metadata, rawContent);

    // 8. Audit event
    auditLogger.logAuditEvent(ctx, {
      action: 'DOCUMENT_UPLOADED',
      targetResource: `document:${documentId}`,
      outcome: 'ALLOWED',
      details: {
        documentId,
        fileName: req.fileName,
        fileSize,
        documentType,
        checksum,
        storagePath,
      }
    });

    // 9. Commit the lifecycle event to the durable outbox before returning success.
    const eventEnvelope = {
      eventId: `evt_doc_${documentId}_ingested`,
      eventType: 'document.ingested.v1' as const,
      eventVersion: 'v1',
      source: 'document_ingestion_service',
      tenantId: req.tenantId,
      branchId: req.branchId,
      principalId: ctx.principal.id,
      correlationId: ctx.correlationId || `corr_${Date.now()}`,
      causationId: req.causationId || null,
      occurredAt: new Date().toISOString(),
      payload: { documentId, fileName: req.fileName, documentType, checksum },
      metadata: {},
    };
    await outboxEngine.enqueueEvent(req.tenantId, eventEnvelope, undefined, ctx.principal.id);

    return metadata;
  }
}

export const documentIngestionService = DocumentIngestionService.getInstance();
