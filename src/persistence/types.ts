/**
 * TDBK V2 — AUTHORITATIVE PERSISTENCE LAYER TYPES
 * Layer: ARCHITECTURAL FOUNDATION — FIRESTORE NATIVE MODE
 *
 * Canonical Path Model: /tenants/{tenantId}/...
 * Invariant: tenantId === dbkId for tenant boundaries.
 */

import { DbkIdentity, DbkBranch, DbkWorkspaceState } from '../platform/types';
import { BusinessDNA } from '../blueprint/types';
import { DbkCapabilityRecord } from '../capability/types';
import { ExperienceEntityRecord } from '../experience/types';
import { DocumentMetadata, AiProposedAction, AiConversationMessage } from '../document_ai/types';
import { WorkflowInstance } from '../orchestration/workflow/types';
import { AuditEvent } from '../kernel/types';
import { TdbkIdentityRecord } from '../kernel/identity/types';

export interface FirestoreDocumentMetadata {
  _createdAt: string;
  _updatedAt: string;
  _version?: number;
}

export interface FirestoreWriteOptions {
  merge?: boolean;
  expectedVersion?: number;
}

export interface FirestoreTransaction {
  get<T>(path: string): Promise<T | null>;
  set<T>(path: string, data: T, options?: FirestoreWriteOptions): Promise<void>;
  update<T>(path: string, data: Partial<T>): Promise<void>;
  delete(path: string): Promise<void>;
}

export interface IdempotencyRecord {
  idempotencyKey: string;
  tenantId: string;
  action: string;
  requestHash: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  statusCode?: number;
  responsePayload?: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

export interface ConnectorSecretReference {
  name: string;
  provider: 'GCP_SECRET_MANAGER' | 'CLOUD_RUN_ENV';
}

export type ConnectorConnectionStatus = 'UNCONFIGURED' | 'CONFIGURED' | 'DISABLED' | 'ERROR';
export type ConnectorHealthStatus = 'UNKNOWN' | 'HEALTHY' | 'UNAVAILABLE' | 'ERROR';

export interface ConnectorConnection {
  connectionId: string;
  tenantId: string;
  bridgeId: string;
  provider: string;
  status: ConnectorConnectionStatus;
  enabled: boolean;
  configurationVersion: number;
  parameters: Record<string, string>;
  secretRefs: Record<string, ConnectorSecretReference>;
  configuredAt: string | null;
  updatedAt: string;
  lastHealthCheckAt: string | null;
  lastHealthStatus: ConnectorHealthStatus;
  lastErrorCode: string | null;
}

export interface IConnectorConnectionRepository {
  saveConnection(tenantId: string, connectionId: string, connection: ConnectorConnection): Promise<void>;
  getConnection(tenantId: string, connectionId: string): Promise<ConnectorConnection | null>;
  listConnections(tenantId: string): Promise<ConnectorConnection[]>;
  deleteConnection(tenantId: string, connectionId: string): Promise<void>;
  updateHealth(
    tenantId: string,
    connectionId: string,
    healthStatus: ConnectorHealthStatus,
    lastErrorCode?: string | null
  ): Promise<void>;
}

export type FinancialTransactionStatus = 'PENDING' | 'POSTED' | 'FAILED' | 'REVERSED' | 'RECONCILIATION_REQUIRED';
export type LedgerEntryType = 'DEBIT' | 'CREDIT';

export interface FinancialTransaction {
  transactionId: string;
  tenantId: string;
  branchId: string | null;
  source: 'MPESA' | 'BANK' | 'CASH' | 'ETIMS' | 'OTHER';
  providerReference: string;
  amount: number;
  currency: string;
  status: FinancialTransactionStatus;
  description: string;
  correlationId: string;
  createdAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  reversalOfTransactionId?: string | null;
}

export interface LedgerEntry {
  entryId: string;
  transactionId: string;
  tenantId: string;
  account: string;
  entryType: LedgerEntryType;
  amount: number;
  currency: string;
  createdAt: string;
  immutable: true;
}

export interface FinancialReceipt {
  receiptId: string;
  tenantId: string;
  transactionId: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: 'CREATED';
  createdAt: string;
}

export interface IReceiptRepository {
  createIfAbsent(tenantId: string, receipt: FinancialReceipt, transaction: FirestoreTransaction, outboxRecord: OutboxRecord): Promise<boolean>;
  getReceipt(tenantId: string, receiptId: string): Promise<FinancialReceipt | null>;
  listReceipts(tenantId: string): Promise<FinancialReceipt[]>;
}

export interface IReconciliationRepository {
  markRequired(tenantId: string, transactionId: string, expectedStatus: FinancialTransactionStatus): Promise<FinancialTransaction>;
  resolve(
    tenantId: string,
    transactionId: string,
    expectedStatus: FinancialTransactionStatus,
    status: Extract<FinancialTransactionStatus, 'POSTED' | 'FAILED' | 'REVERSED'>
  ): Promise<FinancialTransaction>;
  get(tenantId: string, transactionId: string): Promise<FinancialTransaction | null>;
}

export interface IFinancialLedgerRepository {
  savePendingTransaction(transaction: FinancialTransaction): Promise<void>;
  postTransaction(transaction: FinancialTransaction, entries: LedgerEntry[]): Promise<void>;
  reverseTransaction(tenantId: string, transactionId: string, reversalTransaction: FinancialTransaction, reversalEntries: LedgerEntry[]): Promise<void>;
  getTransaction(tenantId: string, transactionId: string): Promise<FinancialTransaction | null>;
  listEntries(tenantId: string, transactionId: string): Promise<LedgerEntry[]>;
}
// -------------------------------------------------------------
// REPOSITORY INTERFACES
// -------------------------------------------------------------

export interface IDbkRegistryRepository {
  saveDbk(tenantId: string, dbk: DbkIdentity): Promise<void>;
  getDbk(tenantId: string): Promise<DbkIdentity | null>;
  listAllDbks(): Promise<DbkIdentity[]>;
  hasDbk(tenantId: string): Promise<boolean>;
  deleteDbk(tenantId: string): Promise<void>;
}

export interface IBusinessDnaRepository {
  saveDna(tenantId: string, dna: BusinessDNA): Promise<void>;
  getDna(tenantId: string): Promise<BusinessDNA | null>;
  hasDna(tenantId: string): Promise<boolean>;
  deleteDna(tenantId: string): Promise<void>;
}

export interface IBranchRepository {
  saveBranch(tenantId: string, branchId: string, branch: DbkBranch): Promise<void>;
  getBranch(tenantId: string, branchId: string): Promise<DbkBranch | null>;
  listBranches(tenantId: string): Promise<DbkBranch[]>;
  deleteBranch(tenantId: string, branchId: string): Promise<void>;
}

export interface ICapabilityStateRepository {
  saveCapabilityState(tenantId: string, capabilityId: string, record: DbkCapabilityRecord): Promise<void>;
  getCapabilityState(tenantId: string, capabilityId: string): Promise<DbkCapabilityRecord | null>;
  listCapabilityStates(tenantId: string): Promise<DbkCapabilityRecord[]>;
  deleteCapabilityState(tenantId: string, capabilityId: string): Promise<void>;
}

export interface IWorkspaceRepository {
  saveActiveWorkspace(tenantId: string, workspace: DbkWorkspaceState): Promise<void>;
  getActiveWorkspace(tenantId: string): Promise<DbkWorkspaceState | null>;
  deleteActiveWorkspace(tenantId: string): Promise<void>;
}

export interface IEntityRecordRepository {
  saveRecord(tenantId: string, capabilityId: string, recordId: string, record: ExperienceEntityRecord): Promise<void>;
  getRecord(tenantId: string, capabilityId: string, recordId: string): Promise<ExperienceEntityRecord | null>;
  listRecords(tenantId: string, capabilityId: string, branchId?: string | null): Promise<ExperienceEntityRecord[]>;
  deleteRecord(tenantId: string, capabilityId: string, recordId: string): Promise<void>;
}

export interface IDocumentMetadataRepository {
  saveDocument(tenantId: string, documentId: string, doc: DocumentMetadata): Promise<void>;
  getDocument(tenantId: string, documentId: string): Promise<DocumentMetadata | null>;
  listDocuments(tenantId: string, branchId?: string | null): Promise<DocumentMetadata[]>;
  deleteDocument(tenantId: string, documentId: string): Promise<void>;
}

export interface IAiProposalRepository {
  saveProposal(tenantId: string, proposalId: string, proposal: AiProposedAction): Promise<void>;
  getProposal(tenantId: string, proposalId: string): Promise<AiProposedAction | null>;
  listProposals(tenantId: string, branchId?: string | null): Promise<AiProposedAction[]>;
  deleteProposal(tenantId: string, proposalId: string): Promise<void>;
  transitionProposal(
    tenantId: string,
    proposalId: string,
    expectedStatus: import('../document_ai/types').ProposalStatus,
    nextStatus: import('../document_ai/types').ProposalStatus,
    reviewedBy: string,
    adjustedPayload?: Record<string, any>,
    metadataPatch?: Partial<Pick<AiProposedAction, 'rejectionReason' | 'executionResult'>>
  ): Promise<AiProposedAction>;
}

export interface IAiConversationRepository {
  saveMessage(tenantId: string, conversationId: string, messageId: string, message: AiConversationMessage): Promise<void>;
  listMessages(tenantId: string, conversationId: string): Promise<AiConversationMessage[]>;
  getConversationMetadata(tenantId: string, conversationId: string): Promise<{ conversationId: string; branchId: string; principalId: string } | null>;
  saveConversationMetadata(tenantId: string, conversationId: string, meta: { conversationId: string; branchId: string; principalId: string }): Promise<void>;
}

export interface IWorkflowInstanceRepository {
  saveWorkflow(tenantId: string, workflowId: string, workflow: WorkflowInstance): Promise<void>;
  getWorkflow(tenantId: string, workflowId: string): Promise<WorkflowInstance | null>;
  listWorkflows(tenantId: string): Promise<WorkflowInstance[]>;
}

export type OutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'RETRY_WAIT'
  | 'FAILED'
  | 'DEAD_LETTER';

export interface OutboxRecord {
  eventId: string;
  tenantId: string;
  branchId: string | null;
  eventType: string;
  eventVersion: string;
  occurredAt: string;
  correlationId: string;
  causationId: string | null;
  source: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attemptCount: number;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
  leaseOwner: string | null;
  leaseUntil: string | null;
  lastError: string | null;
  deliveredAt: string | null;
}

export type IdempotencyClaimResult = 'CLAIMED' | 'COMPLETED' | 'IN_PROGRESS';

export interface IIdempotencyRepository {
  claimIdempotencyRecord(tenantId: string, key: string, record: IdempotencyRecord): Promise<IdempotencyClaimResult>;
  completeIdempotencyRecord(tenantId: string, key: string, responsePayload?: Record<string, unknown>): Promise<void>;
  failIdempotencyRecord(tenantId: string, key: string, responsePayload?: Record<string, unknown>): Promise<void>;
  saveIdempotencyRecord(tenantId: string, key: string, record: IdempotencyRecord): Promise<void>;
  getIdempotencyRecord(tenantId: string, key: string): Promise<IdempotencyRecord | null>;
  deleteIdempotencyRecord(tenantId: string, key: string): Promise<void>;
}

export interface IOutboxRepository {
  saveOutbox(tenantId: string, eventId: string, record: OutboxRecord, transaction?: FirestoreTransaction): Promise<void>;
  getOutbox(tenantId: string, eventId: string): Promise<OutboxRecord | null>;
  listOutbox(tenantId: string, status?: OutboxStatus): Promise<OutboxRecord[]>;
  claimNextPending(tenantId: string, workerId: string, leaseDurationMs: number): Promise<OutboxRecord | null>;
  updateStatus(tenantId: string, eventId: string, status: OutboxStatus, extra?: Partial<OutboxRecord>): Promise<void>;
  deleteOutbox(tenantId: string, eventId: string): Promise<void>;
}

export interface IAccessRequestRepository {
  saveRequest(tenantId: string, requestId: string, request: import('../coherence/types').CapabilityAccessRequest): Promise<void>;
  getRequest(tenantId: string, requestId: string): Promise<import('../coherence/types').CapabilityAccessRequest | null>;
  listRequests(tenantId: string, spaceId?: string, requesterId?: string): Promise<import('../coherence/types').CapabilityAccessRequest[]>;
  transitionRequest(
    tenantId: string,
    requestId: string,
    expectedStatus: import('../coherence/types').AccessRequestStatus,
    nextStatus: import('../coherence/types').AccessRequestStatus,
    reviewedBy: string,
    reviewNotes: string
  ): Promise<import('../coherence/types').CapabilityAccessRequest>;
}

export interface IAuditRepository {
  appendAudit(tenantId: string | null, auditId: string, event: AuditEvent): Promise<void>;
  listAudits(tenantId?: string | null, limit?: number): Promise<AuditEvent[]>;
}

export interface ITdbkIdentityRepository {
  saveIdentity(uid: string, identity: TdbkIdentityRecord): Promise<void>;
  getIdentity(uid: string): Promise<TdbkIdentityRecord | null>;
  listIdentities(tenantId?: string): Promise<TdbkIdentityRecord[]>;
  hasIdentity(uid: string): Promise<boolean>;
  hasMasterIdentity(): Promise<boolean>;
  deleteIdentity(uid: string): Promise<void>;
  runTransaction<T>(updateFunction: (transaction: FirestoreTransaction) => Promise<T>): Promise<T>;
}
