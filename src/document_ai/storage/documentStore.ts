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
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { documentMetadataRepository } from '../../persistence/firestore/repositories/documentMetadataRepository';

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
    tenantIsolation.assertTenantIsolation(ctx.principal, doc.tenantId);

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

  public getRawContent(ctx: SecurityContext, doc: DocumentMetadata): string | null {
    tenantIsolation.assertTenantIsolation(ctx.principal, doc.tenantId);
    return this.binaryStore.get(doc.storagePath) || null;
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
