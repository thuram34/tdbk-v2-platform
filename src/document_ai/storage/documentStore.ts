/**
 * TDBK V2 — DOCUMENT STORAGE & TENANT SCOPE
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION
 * 
 * Rules:
 * - Canonical storage path: /tenants/{tenantId}/documents/{branchId}/{documentId}
 * - Complete tenant and branch isolation.
 * - Non-destructive storage with retention preservation.
 */

import { DocumentMetadata, DocumentStatus, DocumentRetentionPolicy } from '../types';
import { SecurityContext } from '../../kernel/types';
import { tenantIsolation } from '../../kernel/tenancy/tenantIsolation';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { documentMetadataRepository } from '../../persistence/firestore/repositories/documentMetadataRepository';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

export class DocumentStore {
  private static instance: DocumentStore;

  // Primary in-memory authoritative storage: tenantId -> Map<documentId, DocumentMetadata>
  private tenantDocumentIndex: Map<string, Map<string, DocumentMetadata>> = new Map();
  // Raw file content storage: storagePath -> string (base64 or text)
  private binaryStore: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): DocumentStore {
    if (!DocumentStore.instance) {
      DocumentStore.instance = new DocumentStore();
    }
    return DocumentStore.instance;
  }

  public getCanonicalStoragePath(tenantId: string, branchId: string, documentId: string): string {
    return `/tenants/${tenantId}/documents/${branchId}/${documentId}`;
  }

  public saveDocument(
    ctx: SecurityContext,
    doc: DocumentMetadata,
    rawContent?: string
  ): void {
    await masterAuthority.assertTenantAuthority(ctx.principal, doc.tenantId, 'PERSIST_DOCUMENT', ctx.requestId);

    if (!this.tenantDocumentIndex.has(doc.tenantId)) {
      this.tenantDocumentIndex.set(doc.tenantId, new Map());
    }

    const tenantDocs = this.tenantDocumentIndex.get(doc.tenantId)!;
    tenantDocs.set(doc.documentId, doc);

    if (rawContent) {
      this.binaryStore.set(doc.storagePath, rawContent);
    }

    void documentMetadataRepository.saveDocument(doc.tenantId, doc.documentId, doc);
  }

  /**
   * Authoritative asynchronous metadata persistence for production command paths.
   * The synchronous saveDocument method remains for legacy/test compatibility.
   */
  public async persistDocument(
    ctx: SecurityContext,
    doc: DocumentMetadata,
    rawContent?: string
  ): Promise<void> {
    await masterAuthority.assertTenantAuthority(ctx.principal, doc.tenantId, 'PERSIST_DOCUMENT', ctx.requestId);

    if (!this.tenantDocumentIndex.has(doc.tenantId)) {
      this.tenantDocumentIndex.set(doc.tenantId, new Map());
    }
    this.tenantDocumentIndex.get(doc.tenantId)!.set(doc.documentId, doc);
    if (rawContent) {
      this.binaryStore.set(doc.storagePath, rawContent);
    }

    await documentMetadataRepository.saveDocument(doc.tenantId, doc.documentId, doc);
  }

  /**
   * Persists raw document content to Firebase Storage. The in-memory binary store
   * is retained only for tests/local compatibility; production content must
   * survive instance restarts.
   */
  public async persistRawContent(
    ctx: SecurityContext,
    doc: DocumentMetadata,
    rawContent: string
  ): Promise<void> {
    await masterAuthority.assertTenantAuthority(ctx.principal, doc.tenantId, 'PERSIST_DOCUMENT_CONTENT', ctx.requestId);

    if (process.env.NODE_ENV === 'test') {
      this.binaryStore.set(doc.storagePath, rawContent);
      return;
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET;
    if (!bucketName) {
      throw new KernelError(
        'CONFIGURATION_ERROR' as any,
        'Document content storage is not configured. Set FIREBASE_STORAGE_BUCKET or GCS_BUCKET.',
        500,
        ctx.requestId
      );
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (getApps().length === 0) {
      initializeApp({
        credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
        storageBucket: bucketName,
        ...(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT
          ? { projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT }
          : {}),
      });
    }

    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(doc.storagePath.replace(/^\//, ''));
    const buffer = doc.mimeType === 'text/plain' || doc.mimeType.includes('json') || doc.mimeType.includes('csv')
      ? Buffer.from(rawContent, 'utf8')
      : Buffer.from(rawContent, 'base64');

    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: doc.mimeType,
        metadata: {
          tenantId: doc.tenantId,
          branchId: doc.branchId,
          documentId: doc.documentId,
          checksum: doc.checksum,
        },
      },
    });
  }

  /** Authoritative Firestore read for production/server paths. */
  public async getPersistentDocument(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string
  ): Promise<DocumentMetadata | null> {
    await masterAuthority.assertTenantAuthority(ctx.principal, tenantId, 'READ_DOCUMENT', ctx.requestId);
    const doc = await documentMetadataRepository.getDocument(tenantId, documentId);
    if (!doc) return null;
    if (ctx.principal.branchId && doc.branchId && ctx.principal.branchId !== doc.branchId && !ctx.principal.isMaster) {
      throw new KernelError('AUTHORIZATION_DENIED' as any, 'Branch access denied. Document is scoped to another branch', 403, ctx.requestId);
    }
    return doc;
  }

  /** Authoritative Firestore list for production/server paths. */
  public async listPersistentDocuments(
    ctx: SecurityContext,
    tenantId: string,
    branchId?: string
  ): Promise<DocumentMetadata[]> {
    await masterAuthority.assertTenantAuthority(ctx.principal, tenantId, 'LIST_DOCUMENTS', ctx.requestId);
    const effectiveBranch = branchId || (ctx.principal.isMaster ? undefined : ctx.principal.branchId);
    return documentMetadataRepository.listDocuments(tenantId, effectiveBranch);
  }

  /** Authoritative tenant-scoped duplicate lookup. */
  public async findPersistentByChecksum(
    ctx: SecurityContext,
    tenantId: string,
    checksum: string
  ): Promise<DocumentMetadata | null> {
    await masterAuthority.assertTenantAuthority(ctx.principal, tenantId, 'FIND_DOCUMENT', ctx.requestId);
    const docs = await documentMetadataRepository.listDocuments(tenantId);
    return docs.find(d => d.checksum === checksum && d.status !== 'ARCHIVED' && d.status !== 'REJECTED') || null;
  }

  public async deletePersistentDocument(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string,
    reason: string
  ): Promise<boolean> {
    await masterAuthority.assertTenantAuthority(ctx.principal, tenantId, 'DELETE_DOCUMENT', ctx.requestId);
    const doc = await this.getPersistentDocument(ctx, tenantId, documentId);
    if (!doc) throw new KernelError('NOT_FOUND', 'Document not found', 404, ctx.requestId);
    if (doc.retentionPolicy.legalHold) {
      throw new KernelError('FORBIDDEN_OPERATION' as any, 'Cannot delete document: Active Legal Hold in effect', 403, ctx.requestId);
    }
    const daysSinceUpload = (Date.now() - new Date(doc.uploadedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpload < doc.retentionPolicy.retentionPeriodDays && !ctx.principal.isMaster) {
      throw new KernelError('FORBIDDEN_OPERATION' as any, 'Retention policy violation', 403, ctx.requestId);
    }
    if (doc.retentionPolicy.archiveOnly) {
      doc.status = 'ARCHIVED';
      await documentMetadataRepository.saveDocument(tenantId, documentId, doc);
      auditLogger.logAuditEvent(ctx, {
        action: 'DOCUMENT_ARCHIVED_BY_POLICY',
        targetResource: 'document:' + documentId,
        outcome: 'ALLOWED',
        details: { reason, retentionDays: doc.retentionPolicy.retentionPeriodDays }
      });
      return true;
    }
    await documentMetadataRepository.deleteDocument(tenantId, documentId);
    auditLogger.logAuditEvent(ctx, {
      action: 'DOCUMENT_DELETED',
      targetResource: 'document:' + documentId,
      outcome: 'ALLOWED',
      details: { reason }
    });
    return true;
  }

  public getDocument(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string
  ): DocumentMetadata | null {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const tenantDocs = this.tenantDocumentIndex.get(tenantId);
    if (!tenantDocs) return null;

    const doc = tenantDocs.get(documentId);
    if (!doc) return null;

    // If principal has branch restriction and document is branch-scoped
    if (ctx.principal.branchId && doc.branchId && ctx.principal.branchId !== doc.branchId && !ctx.principal.isMaster) {
      throw new KernelError(
        'AUTHORIZATION_DENIED' as any,
        `Branch access denied. Document is scoped to branch ${doc.branchId}`,
        403,
        ctx.requestId
      );
    }

    return doc;
  }

  public listDocuments(
    ctx: SecurityContext,
    tenantId: string,
    branchId?: string
  ): DocumentMetadata[] {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const tenantDocs = this.tenantDocumentIndex.get(tenantId);
    if (!tenantDocs) return [];

    let docs = Array.from(tenantDocs.values());

    if (branchId) {
      docs = docs.filter(d => d.branchId === branchId);
    } else if (ctx.principal.branchId && !ctx.principal.isMaster) {
      docs = docs.filter(d => d.branchId === ctx.principal.branchId);
    }

    return docs;
  }

  public findByChecksum(tenantId: string, checksum: string): DocumentMetadata | null {
    const tenantDocs = this.tenantDocumentIndex.get(tenantId);
    if (!tenantDocs) return null;

    for (const doc of tenantDocs.values()) {
      if (doc.checksum === checksum && doc.status !== 'ARCHIVED' && doc.status !== 'REJECTED') {
        return doc;
      }
    }
    return null;
  }

  public async getRawContent(ctx: SecurityContext, doc: DocumentMetadata): Promise<string | null> {
    await masterAuthority.assertTenantAuthority(ctx.principal, doc.tenantId, 'READ_DOCUMENT_CONTENT', ctx.requestId);

    if (process.env.NODE_ENV === 'test') {
      return this.binaryStore.get(doc.storagePath) || null;
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET;
    if (!bucketName) {
      throw new KernelError(
        'CONFIGURATION_ERROR' as any,
        'Document content storage is not configured. Set FIREBASE_STORAGE_BUCKET or GCS_BUCKET.',
        500,
        ctx.requestId
      );
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (getApps().length === 0) {
      initializeApp({
        credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
        storageBucket: bucketName,
        ...(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT
          ? { projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT }
          : {}),
      });
    }

    const [buffer] = await getStorage().bucket(bucketName).file(doc.storagePath.replace(/^\//, '')).download();
    return doc.mimeType === 'text/plain' || doc.mimeType.includes('json') || doc.mimeType.includes('csv')
      ? buffer.toString('utf8')
      : buffer.toString('base64');
  }

  public deleteDocument(
    ctx: SecurityContext,
    tenantId: string,
    documentId: string,
    reason: string
  ): boolean {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const doc = this.getDocument(ctx, tenantId, documentId);
    if (!doc) {
      throw new KernelError('NOT_FOUND', `Document ${documentId} not found`, 404, ctx.requestId);
    }

    // Check legal hold & retention policy
    if (doc.retentionPolicy.legalHold) {
      throw new KernelError(
        'FORBIDDEN_OPERATION' as any,
        `Cannot delete document ${documentId}: Active Legal Hold in effect`,
        403,
        ctx.requestId
      );
    }

    const uploadDate = new Date(doc.uploadedAt).getTime();
    const now = Date.now();
    const daysSinceUpload = (now - uploadDate) / (1000 * 60 * 60 * 24);

    if (daysSinceUpload < doc.retentionPolicy.retentionPeriodDays && !ctx.principal.isMaster) {
      throw new KernelError(
        'FORBIDDEN_OPERATION' as any,
        `Retention policy violation: Document must be retained for at least ${doc.retentionPolicy.retentionPeriodDays} days (Elapsed: ${Math.floor(daysSinceUpload)} days)`,
        403,
        ctx.requestId
      );
    }

    // Archive instead of destructive loss if policy specifies archiveOnly
    if (doc.retentionPolicy.archiveOnly) {
      doc.status = 'ARCHIVED';
      this.saveDocument(ctx, doc);
      auditLogger.logAuditEvent(ctx, {
        action: 'DOCUMENT_ARCHIVED_BY_POLICY',
        targetResource: `document:${documentId}`,
        outcome: 'ALLOWED',
        details: { reason, retentionDays: doc.retentionPolicy.retentionPeriodDays }
      });
      return true;
    }

    // Explicit deletion
    const tenantDocs = this.tenantDocumentIndex.get(tenantId);
    if (tenantDocs) {
      tenantDocs.delete(documentId);
    }
    this.binaryStore.delete(doc.storagePath);

    auditLogger.logAuditEvent(ctx, {
      action: 'DOCUMENT_DELETED',
      targetResource: `document:${documentId}`,
      outcome: 'ALLOWED',
      details: { reason }
    });

    return true;
  }

  public clearTenant(tenantId: string): void {
    this.tenantDocumentIndex.delete(tenantId);
  }

  public clearStoreForTesting(): void {
    this.tenantDocumentIndex.clear();
    this.binaryStore.clear();
  }
}

export const documentStore = DocumentStore.getInstance();
