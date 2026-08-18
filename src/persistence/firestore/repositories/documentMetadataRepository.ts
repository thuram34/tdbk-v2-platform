/**
 * TDBK V2 — DOCUMENT METADATA REPOSITORY
 * Firestore Path: /tenants/{tenantId}/documents/{documentId}
 */

import { IDocumentMetadataRepository } from '../../types';
import { DocumentMetadata } from '../../../document_ai/types';
import { firestoreClient } from '../firestoreClient';

export class DocumentMetadataRepository implements IDocumentMetadataRepository {
  private static instance: DocumentMetadataRepository;

  private constructor() {}

  public static getInstance(): DocumentMetadataRepository {
    if (!DocumentMetadataRepository.instance) {
      DocumentMetadataRepository.instance = new DocumentMetadataRepository();
    }
    return DocumentMetadataRepository.instance;
  }

  private getPath(tenantId: string, documentId: string): string {
    return `/tenants/${tenantId}/documents/${documentId}`;
  }

  public async saveDocument(
    tenantId: string,
    documentId: string,
    doc: DocumentMetadata
  ): Promise<void> {
    await firestoreClient.set(this.getPath(tenantId, documentId), doc as unknown as Record<string, unknown>);
  }

  public async getDocument(tenantId: string, documentId: string): Promise<DocumentMetadata | null> {
    return await firestoreClient.get<DocumentMetadata>(this.getPath(tenantId, documentId));
  }

  public async listDocuments(tenantId: string, branchId?: string | null): Promise<DocumentMetadata[]> {
    const docs = await firestoreClient.listCollection<DocumentMetadata>(`/tenants/${tenantId}/documents`);
    if (branchId) {
      return docs.filter((d) => !d.branchId || d.branchId === branchId);
    }
    return docs;
  }

  public async deleteDocument(tenantId: string, documentId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, documentId));
  }
}

export const documentMetadataRepository = DocumentMetadataRepository.getInstance();
