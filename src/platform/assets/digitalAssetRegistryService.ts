/**
 * TDBK V2 — TENANT DIGITAL ASSET REGISTRY
 *
 * Records asset claims and evidence references. This registry is not a title
 * adjudication service, investment register, custodian or valuation oracle.
 * All writes are server-side, tenant-scoped and append ownership/valuation
 * history rather than overwriting historical events.
 */
import type { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';

export type DigitalAssetClass =
  | 'SOFTWARE'
  | 'DOMAIN'
  | 'CONTENT'
  | 'EQUIPMENT'
  | 'PROPERTY_INTEREST'
  | 'CONTRACT'
  | 'RECEIVABLE'
  | 'OTHER';

export type AssetOwnerType = 'TENANT' | 'PERSON' | 'ORGANIZATION' | 'THIRD_PARTY';
export type OwnershipBasis = 'LEGAL_TITLE' | 'ASSIGNMENT' | 'LICENCE' | 'CONTRACT' | 'CUSTODY' | 'INTERNAL_RECORD';
export type AssetLifecycleStatus = 'ACTIVE' | 'DISPUTED' | 'DISPOSED' | 'RETIRED';
export type AssetValuationMethod = 'COST' | 'MARKET' | 'INCOME' | 'REPLACEMENT_COST' | 'OTHER';

export interface DigitalAssetValuation {
  valuationId: string;
  tenantId: string;
  assetId: string;
  amountMinor: number;
  currency: string;
  method: AssetValuationMethod;
  effectiveAt: string;
  recordedAt: string;
  recordedBy: string;
  sourceReference: string | null;
  isEstimate: true;
}

export interface DigitalAssetOwnershipEvent {
  eventId: string;
  tenantId: string;
  assetId: string;
  eventType: 'REGISTERED' | 'TRANSFERRED' | 'LICENCE_GRANTED' | 'LICENCE_REVOKED';
  previousOwnerId: string | null;
  ownerId: string;
  ownerType: AssetOwnerType;
  basis: OwnershipBasis;
  evidenceReferences: string[];
  recordedAt: string;
  recordedBy: string;
}

export interface DigitalAssetRecord {
  assetId: string;
  tenantId: string;
  branchId: string | null;
  assetClass: DigitalAssetClass;
  name: string;
  description: string;
  externalReference: string | null;
  lifecycleStatus: AssetLifecycleStatus;
  currentOwnerId: string;
  currentOwnerType: AssetOwnerType;
  ownershipBasis: OwnershipBasis;
  ownershipEvidenceStatus: 'UNVERIFIED' | 'EVIDENCE_RECORDED';
  latestValuation: Pick<DigitalAssetValuation, 'valuationId' | 'amountMinor' | 'currency' | 'method' | 'effectiveAt'> | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
}

export interface RegisterDigitalAssetInput {
  assetId: string;
  assetClass: DigitalAssetClass;
  name: string;
  description?: string;
  externalReference?: string | null;
  ownerId: string;
  ownerType: AssetOwnerType;
  ownershipBasis: OwnershipBasis;
  evidenceReferences?: string[];
}

export interface TransferDigitalAssetInput {
  eventId: string;
  expectedCurrentOwnerId: string;
  newOwnerId: string;
  newOwnerType: AssetOwnerType;
  basis: OwnershipBasis;
  evidenceReferences?: string[];
  eventType?: 'TRANSFERRED' | 'LICENCE_GRANTED' | 'LICENCE_REVOKED';
}

export interface RecordAssetValuationInput {
  valuationId: string;
  amountMinor: number;
  currency: string;
  method: AssetValuationMethod;
  effectiveAt: string;
  sourceReference?: string | null;
}

const ASSET_ROLE = 'TENANT_ADMIN';
const READ_ROLE = 'TENANT_ADMIN';
const ID_PATTERN = /^[A-Za-z0-9_-]{3,120}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;\nconst ASSET_CLASSES: readonly string[] = ['SOFTWARE', 'DOMAIN', 'CONTENT', 'EQUIPMENT', 'PROPERTY_INTEREST', 'CONTRACT', 'RECEIVABLE', 'OTHER'];\nconst OWNER_TYPES: readonly string[] = ['TENANT', 'PERSON', 'ORGANIZATION', 'THIRD_PARTY'];\nconst OWNERSHIP_BASES: readonly string[] = ['LEGAL_TITLE', 'ASSIGNMENT', 'LICENCE', 'CONTRACT', 'CUSTODY', 'INTERNAL_RECORD'];\nconst VALUATION_METHODS: readonly string[] = ['COST', 'MARKET', 'INCOME', 'REPLACEMENT_COST', 'OTHER'];

function fail(message: string, requestId: string): never {
  throw new KernelError('VALIDATION_ERROR', message, 400, requestId);
}

function assertId(value: string, label: string, requestId: string): void {
  if (typeof value !== 'string' || !value || !ID_PATTERN.test(value)) fail(label + ' must be 3-120 characters using letters, numbers, underscore or hyphen.', requestId);
}

function normalizeEvidenceReferences(value: unknown, requestId: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('evidenceReferences must be an array.', requestId);
  const references: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') fail('Every evidence reference must be a string.', requestId);
    const normalized = item.trim();
    if (normalized.length > 500) fail('An evidence reference exceeds 500 characters.', requestId);
    if (normalized) references.push(normalized);
  }
  return [...new Set(references)];
}

export class DigitalAssetRegistryService {
  private assetPath(tenantId: string, assetId: string): string {
    return `/tenants/${tenantId}/digitalAssets/${assetId}`;
  }

  private ownershipPath(tenantId: string, assetId: string, eventId: string): string {
    return `${this.assetPath(tenantId, assetId)}/ownershipEvents/${eventId}`;
  }

  private valuationPath(tenantId: string, assetId: string, valuationId: string): string {
    return `${this.assetPath(tenantId, assetId)}/valuations/${valuationId}`;
  }

  private assertBranchAccess(context: SecurityContext, asset: DigitalAssetRecord): void {\n    const principalBranchId = context.branchContext?.branchId ?? context.principal.branchId;\n    if (principalBranchId && asset.branchId !== principalBranchId) {\n      throw new KernelError('AUTHORIZATION_ERROR', 'Asset is outside the caller branch scope.', 403, context.requestId);\n    }\n  }\n\n  private async authorize(context: SecurityContext, tenantId: string, requiredRole: string, action: string): Promise<void> {
    const contextTenantId = context.tenantContext?.tenantId ?? context.principal.tenantId;
    if (!contextTenantId || contextTenantId !== tenantId) {
      throw new KernelError('TENANT_ISOLATION_ERROR', 'Digital asset operation denied: tenant context mismatch.', 403, context.requestId);
    }
    const result = await rbacEngine.authorizeAsync(
      context.principal,
      action,
      'digital-assets:registry',
      { tenantId, branchId: context.branchContext?.branchId ?? context.principal.branchId ?? undefined, requiredRole, requestId: context.requestId },
    );
    if (!result.allowed) throw new KernelError('AUTHORIZATION_ERROR', result.reason, 403, context.requestId);
  }

  async registerAsset(context: SecurityContext, tenantId: string, input: RegisterDigitalAssetInput): Promise<{ asset: DigitalAssetRecord; idempotent: boolean }> {
    await this.authorize(context, tenantId, ASSET_ROLE, 'register-digital-asset');
    assertId(input.assetId, 'assetId', context.requestId);
    assertId(input.ownerId, 'ownerId', context.requestId);
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 160) fail('Asset name is required and must not exceed 160 characters.', context.requestId);
    if (input.description !== undefined && typeof input.description !== 'string') fail('Asset description must be a string.', context.requestId);
    if (input.description && input.description.length > 4000) fail('Asset description must not exceed 4000 characters.', context.requestId);
    const evidenceReferences = normalizeEvidenceReferences(input.evidenceReferences, context.requestId);

    const now = new Date().toISOString();
    const asset: DigitalAssetRecord = {
      assetId: input.assetId,
      tenantId,
      branchId: context.branchContext?.branchId ?? context.principal.branchId ?? null,
      assetClass: input.assetClass,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      externalReference: input.externalReference?.trim() || null,
      lifecycleStatus: 'ACTIVE',
      currentOwnerId: input.ownerId,
      currentOwnerType: input.ownerType,
      ownershipBasis: input.ownershipBasis,
      ownershipEvidenceStatus: evidenceReferences.length ? 'EVIDENCE_RECORDED' : 'UNVERIFIED',
      latestValuation: null,
      createdAt: now,
      updatedAt: now,
      createdBy: context.principal.id,
      version: 1,
    };
    const event: DigitalAssetOwnershipEvent = {
      eventId: `registered-${input.assetId}`,
      tenantId,
      assetId: input.assetId,
      eventType: 'REGISTERED',
      previousOwnerId: null,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      basis: input.ownershipBasis,
      evidenceReferences,
      recordedAt: now,
      recordedBy: context.principal.id,
    };

    return firestoreClient.runTransaction(async (tx) => {
      const path = this.assetPath(tenantId, input.assetId);
      const existing = await tx.get<DigitalAssetRecord>(path);
      if (existing) {
        if (existing.tenantId !== tenantId || existing.assetId !== input.assetId) {
          throw new KernelError('TENANT_ISOLATION_ERROR', 'Asset identity collision.', 403, context.requestId);
        }
        return { asset: existing, idempotent: true };
      }
      await tx.set(path, asset as unknown as Record<string, unknown>);
      await tx.set(this.ownershipPath(tenantId, input.assetId, event.eventId), event as unknown as Record<string, unknown>);
      return { asset, idempotent: false };
    });
  }

  async recordOwnershipChange(context: SecurityContext, tenantId: string, assetId: string, input: TransferDigitalAssetInput): Promise<DigitalAssetRecord> {
    await this.authorize(context, tenantId, ASSET_PERMISSION, 'change-digital-asset-ownership');
    assertId(assetId, 'assetId', context.requestId);
    assertId(input.eventId, 'eventId', context.requestId);
    assertId(input.expectedCurrentOwnerId, 'expectedCurrentOwnerId', context.requestId);
    assertId(input.newOwnerId, 'newOwnerId', context.requestId);
    const evidenceReferences = normalizeEvidenceReferences(input.evidenceReferences, context.requestId);
    const now = new Date().toISOString();

    return firestoreClient.runTransaction(async (tx) => {
      const path = this.assetPath(tenantId, assetId);
      const asset = await tx.get<DigitalAssetRecord>(path);
      if (!asset) throw new KernelError('NOT_FOUND', 'Digital asset not found.', 404, context.requestId);
      if (asset.tenantId !== tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'Asset tenant mismatch.', 403, context.requestId);
      const eventPath = this.ownershipPath(tenantId, assetId, input.eventId);
      const priorEvent = await tx.get<DigitalAssetOwnershipEvent>(eventPath);
      if (priorEvent) {\n        if (priorEvent.ownerId !== input.newOwnerId || priorEvent.previousOwnerId !== input.expectedCurrentOwnerId || priorEvent.basis !== input.basis) {\n          throw new KernelError('OPTIMISTIC_LOCK_ERROR', 'Ownership event ID was already used for a different change.', 409, context.requestId);\n        }\n        return asset;\n      }

      const event: DigitalAssetOwnershipEvent = {
        eventId: input.eventId,
        tenantId,
        assetId,
        eventType: input.eventType ?? 'TRANSFERRED',
        previousOwnerId: asset.currentOwnerId,
        ownerId: input.newOwnerId,
        ownerType: input.newOwnerType,
        basis: input.basis,
        evidenceReferences,
        recordedAt: now,
        recordedBy: context.principal.id,
      };
      const updated: DigitalAssetRecord = {
        ...asset,
        currentOwnerId: input.newOwnerId,
        currentOwnerType: input.newOwnerType,
        ownershipBasis: input.basis,
        ownershipEvidenceStatus: evidenceReferences.length ? 'EVIDENCE_RECORDED' : 'UNVERIFIED',
        updatedAt: now,
        version: asset.version + 1,
      };
      await tx.set(eventPath, event as unknown as Record<string, unknown>);
      await tx.set(path, updated as unknown as Record<string, unknown>);
      return updated;
    });
  }

  async recordValuation(context: SecurityContext, tenantId: string, assetId: string, input: RecordAssetValuationInput): Promise<DigitalAssetRecord> {
    await this.authorize(context, tenantId, ASSET_PERMISSION, 'record-digital-asset-valuation');
    assertId(assetId, 'assetId', context.requestId);
    assertId(input.valuationId, 'valuationId', context.requestId);
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) fail('Valuation must be a non-negative integer in minor currency units.', context.requestId);
    if (typeof input.currency !== 'string' || !CURRENCY_PATTERN.test(input.currency)) fail('Currency must be a three-letter ISO currency code.', context.requestId);
    if (input.sourceReference !== undefined && input.sourceReference !== null && typeof input.sourceReference !== 'string') fail('sourceReference must be a string.', context.requestId);
    if (typeof input.effectiveAt !== 'string' || !Number.isFinite(Date.parse(input.effectiveAt))) fail('effectiveAt must be a valid date.', context.requestId);
    const now = new Date().toISOString();
    const valuation: DigitalAssetValuation = {
      valuationId: input.valuationId,
      tenantId,
      assetId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      method: input.method,
      effectiveAt: input.effectiveAt,
      recordedAt: now,
      recordedBy: context.principal.id,
      sourceReference: input.sourceReference?.trim() || null,
      isEstimate: true,
    };

    return firestoreClient.runTransaction(async (tx) => {
      const path = this.assetPath(tenantId, assetId);
      const asset = await tx.get<DigitalAssetRecord>(path);
      if (!asset) throw new KernelError('NOT_FOUND', 'Digital asset not found.', 404, context.requestId);
      if (asset.tenantId !== tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'Asset tenant mismatch.', 403, context.requestId);
      const valuationPath = this.valuationPath(tenantId, assetId, input.valuationId);
      const existingValuation = await tx.get<DigitalAssetValuation>(valuationPath);
      if (existingValuation) {\n        if (existingValuation.amountMinor !== valuation.amountMinor || existingValuation.currency !== valuation.currency || existingValuation.method !== valuation.method) {\n          throw new KernelError('OPTIMISTIC_LOCK_ERROR', 'Valuation ID was already used for a different valuation.', 409, context.requestId);\n        }\n        return asset;\n      }
      const updated: DigitalAssetRecord = {
        ...asset,
        latestValuation: {
          valuationId: valuation.valuationId,
          amountMinor: valuation.amountMinor,
          currency: valuation.currency,
          method: valuation.method,
          effectiveAt: valuation.effectiveAt,
        },
        updatedAt: now,
        version: asset.version + 1,
      };
      await tx.set(valuationPath, valuation as unknown as Record<string, unknown>);
      await tx.set(path, updated as unknown as Record<string, unknown>);
      return updated;
    });
  }

  async getAsset(context: SecurityContext, tenantId: string, assetId: string): Promise<DigitalAssetRecord | null> {
    await this.authorize(context, tenantId, READ_ROLE, 'read-digital-asset');
    assertId(assetId, 'assetId', context.requestId);
    const asset = await firestoreClient.get<DigitalAssetRecord>(this.assetPath(tenantId, assetId));
    if (asset && asset.tenantId !== tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'Asset tenant mismatch.', 403, context.requestId);
    return asset;
  }

  async listAssets(context: SecurityContext, tenantId: string): Promise<DigitalAssetRecord[]> {
    await this.authorize(context, tenantId, READ_PERMISSION, 'list-digital-assets');
    const assets = await firestoreClient.listCollection<DigitalAssetRecord>(`/tenants/${tenantId}/digitalAssets`);
    const principalBranchId = context.branchContext?.branchId ?? context.principal.branchId;\n    return assets.filter((asset) => asset.tenantId === tenantId && (!principalBranchId || asset.branchId === principalBranchId));
  }
}

export const digitalAssetRegistryService = new DigitalAssetRegistryService();
