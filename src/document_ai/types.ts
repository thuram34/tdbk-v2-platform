/**
 * TDBK V2 PHASE 6 — DOCUMENT INGESTION & AI BOUNDARIES TYPES
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION & AI ASSISTANCE
 * 
 * CORE CONTRACT:
 * - AI IS AN ASSISTANT. TDBK IS THE AUTHORITY.
 * - Documents are inputs. AI produces interpretations, classifications, extractions, suggestions, and proposed actions.
 * - Authoritative TDBK services decide whether anything actually changes.
 * - AI MUST NEVER become the source of permissions, tenant identity, business identity, capabilities, entitlements, financial truth, ledger truth, workflow authority, or branch authority.
 */

import { SubscriptionTier } from '../capability/types';
import { SecurityContext } from '../kernel/types';

export type DocumentType = 
  | 'PDF'
  | 'IMAGE'
  | 'CSV'
  | 'SPREADSHEET'
  | 'TEXT'
  | 'JSON';

export type DocumentStatus = 
  | 'UPLOADED'
  | 'VALIDATING'
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'EXTRACTED'
  | 'CLASSIFIED'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED'
  | 'PROCESSING_FAILED';

export type DocumentClassificationType = 
  | 'invoice'
  | 'receipt'
  | 'statement'
  | 'purchase_order'
  | 'student_record'
  | 'admission_document'
  | 'patient_form'
  | 'prescription'
  | 'delivery_note'
  | 'waybill'
  | 'contract'
  | 'identity_document'
  | 'report'
  | 'unknown';

export interface DocumentClassification {
  type: DocumentClassificationType;
  confidence: number; // 0.0 to 1.0
  secondaryTypes?: Array<{ type: DocumentClassificationType; confidence: number }>;
  detectedLanguage?: string;
  classificationVersion: string;
  classifiedAt: string;
}

export interface SourceEvidence {
  page?: number;
  lineReference?: string;
  textSnippet?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ExtractedField<T = unknown> {
  fieldName: string;
  value: T;
  confidence: number; // 0.0 to 1.0
  sourceEvidence?: SourceEvidence;
  extractionMethod: 'OCR_RULE' | 'SCHEMA_MATCH' | 'AI_INFERENCE';
  processingVersion: string;
}

export interface ExtractedDataMap {
  [fieldName: string]: ExtractedField<any>;
}

export interface DocumentRetentionPolicy {
  retentionPeriodDays: number;
  legalHold: boolean;
  autoDeleteAfterDays?: number;
  archiveOnly: boolean;
  policySetBy: string;
  policySetAt: string;
}

export interface DocumentProcessingHistory {
  processingVersion: string;
  processedAt: string;
  model: string;
  provider: string;
  classification: DocumentClassification;
  extractedFields: ExtractedDataMap;
  confidenceAverage: number;
  durationMs: number;
  status: DocumentStatus;
  notes?: string;
}

export interface DocumentMetadata {
  documentId: string;
  tenantId: string;
  branchId: string;
  uploadedBy: string;
  uploadedAt: string;
  documentType: DocumentType;
  mimeType: string;
  fileName: string;
  fileSize: number;
  checksum: string; // SHA-256
  status: DocumentStatus;
  source: 'MANUAL_UPLOAD' | 'API_BRIDGE' | 'EMAIL_INGEST' | 'MOBILE_CAPTURE';
  storagePath: string; // /tenants/{tenantId}/documents/{branchId}/{documentId}
  classification?: DocumentClassification;
  extractedData?: ExtractedDataMap;
  processingVersion: string;
  history: DocumentProcessingHistory[];
  retentionPolicy: DocumentRetentionPolicy;
  correlationId: string;
  causationId?: string;
  contentSnippet?: string; // sanitized text snippet
}

// -------------------------------------------------------------
// AI BOUNDARY & PROPOSAL TYPES
// -------------------------------------------------------------

export type AiProposalType = 
  | 'PROPOSE_CREATE_INVOICE'
  | 'PROPOSE_RECORD_PAYMENT'
  | 'PROPOSE_ADMIT_STUDENT'
  | 'PROPOSE_BOOK_WAYBILL'
  | 'PROPOSE_CREATE_PATIENT_RECORD'
  | 'PROPOSE_RECONCILE_TRANSACTION'
  | 'PROPOSE_UPDATE_INVENTORY'
  | 'PROPOSE_GENERAL_ENTRY';

export type ProposalStatus = 
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'EXECUTED';

export interface AiProposedAction {
  proposalId: string;
  documentId?: string;
  tenantId: string;
  branchId: string;
  proposalType: AiProposalType;
  suggestedPayload: Record<string, any>;
  confidence: number;
  summary: string;
  status: ProposalStatus;
  sourceEvidence?: Record<string, SourceEvidence>;
  proposedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  executionResult?: {
    success: boolean;
    executedCommand?: string;
    recordId?: string;
    executedAt: string;
  };
  correlationId: string;
  causationId: string;
}

// -------------------------------------------------------------
// AI PROVIDER & CONTEXT ISOLATION
// -------------------------------------------------------------

export interface AiModelMetadata {
  provider: 'gemini' | 'local_deterministic' | 'azure_openai' | 'anthropic';
  model: string;
  version: string;
}

export interface AiRequestOptions {
  tenantId: string;
  branchId: string;
  principalId: string;
  task: 'CLASSIFICATION' | 'EXTRACTION' | 'SUMMARY' | 'PROPOSAL_GENERATION' | 'ASSISTANT_QUERY';
  prompt: string;
  untrustedDocumentContent?: string;
  documentMetadata?: Partial<DocumentMetadata>;
  temperature?: number;
  correlationId: string;
  causationId?: string;
}

export interface AiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  provider: string;
  model: string;
  latencyMs: number;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  confidence?: number;
  correlationId: string;
}

export interface AiConversationMessage {
  id: string;
  sender: 'USER' | 'AI_ASSISTANT' | 'SYSTEM';
  text: string;
  timestamp: string;
  untrustedWarning?: boolean;
  proposals?: AiProposedAction[];
  referencedDocumentIds?: string[];
}

export interface AiConversation {
  conversationId: string;
  tenantId: string;
  branchId: string;
  principalId: string;
  createdAt: string;
  updatedAt: string;
  messages: AiConversationMessage[];
}
