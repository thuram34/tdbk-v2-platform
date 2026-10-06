/**
 * TDBK V2 ENTITY CENTRIC INTERACTION ENGINE
 * Architectural Layer: LAYER 8 & 9 — UI ENGINE & ENTITY CONTROLLER
 * Dynamically resolves entity schema, terminology, fields, and record collections for a given capability & sector.
 */

import { ExperienceEntitySchema, ExperienceEntityRecord } from '../types';
import { SecurityContext } from '../../kernel/types';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { branchAuthority } from '../../kernel/branch/branchAuthority';
import { dbkLifecycleManager } from '../../platform/lifecycle/lifecycleManager';
import { DbkWorkspaceState } from '../../platform/types';
import { capabilityViewRegistry } from '../registry/viewRegistry';
import { BlueprintTerminology } from '../../blueprint/types';
import { entityRecordRepository } from '../../persistence/firestore/repositories/entityRecordRepository';

export class EntityEngineService {
  private static instance: EntityEngineService;

  // In-memory tenant entity stores for interactive UI demo & testing
  private readonly entityStore: Map<string, ExperienceEntityRecord[]> = new Map();

  private constructor() {
    this.seedDefaultRecords();
  }

  public static getInstance(): EntityEngineService {
    if (!EntityEngineService.instance) {
      EntityEngineService.instance = new EntityEngineService();
    }
    return EntityEngineService.instance;
  }

  /**
   * Resolves dynamic schema for a capability given the workspace's terminology.
   */
  public resolveEntitySchema(capabilityId: string, workspace: DbkWorkspaceState): ExperienceEntitySchema | null {
    const viewDef = capabilityViewRegistry.getViewDefinition(capabilityId);
    if (!viewDef || !viewDef.entitySchema) {
      return null;
    }

    const term = workspace.terminology as BlueprintTerminology;
    const termKey = viewDef.terminologyKey;
    const singularName = termKey && term?.[termKey]?.singular ? term[termKey].singular : viewDef.defaultNavLabel;
    const pluralName = termKey && term?.[termKey]?.plural ? term[termKey].plural : viewDef.defaultNavLabel;

    return {
      entityType: capabilityId,
      singularName,
      pluralName,
      capabilityId,
      fields: (viewDef.entitySchema || []).map((f: any) => ({
        key: f.key || f.name,
        label: f.label,
        type: f.type || 'string',
        required: f.required,
        options: f.options ? f.options.map((o: any) => typeof o === 'string' ? { label: o, value: o } : o) : undefined,
      })),
      actions: [
        { id: 'create', label: `Add New ${singularName}`, variant: 'primary', command: 'SUBMIT_ENTITY' },
        { id: 'export', label: `Export ${pluralName} (PDF/CSV)`, variant: 'secondary', command: 'EXPORT_REPORT' },
      ],
    };
  }

  /**
   * Retrieves records for a given DBK and capability
   */
  public getRecords(dbkId: string, capabilityId: string): ExperienceEntityRecord[] {
    const key = `${dbkId}:${capabilityId}`;
    return this.entityStore.get(key) || this.getDefaultRecordsForCapability(capabilityId);
  }

  private async assertPersistentAccess(
    context: SecurityContext,
    tenantId: string,
    action: string,
    branchId?: string | null,
  ): Promise<void> {
    if (!tenantId) {
      throw new Error('Entity operation requires an authoritative DBK tenant.');
    }
    await masterAuthority.assertTenantAuthority(context, tenantId, action, context.requestId);
    await dbkLifecycleManager.assertDbkOperational(context, tenantId);

    if (branchId) {
      await branchAuthority.assertPersistentBranchContext(
        context.principal,
        tenantId,
        branchId,
        action,
        context.requestId,
      );
    }
  }

  /**
   * Authoritative server read path.
   * Production reads come from Firestore; in-memory/demo records are retained
   * only for local development and isolated test execution.
   */
  public async listPersistentRecords(
    ctx: SecurityContext,
    tenantId: string,
    entityType: string,
    branchId?: string | null,
  ): Promise<ExperienceEntityRecord[]> {
    await this.assertPersistentAccess(ctx, tenantId, 'LIST_ENTITY_RECORDS', branchId);
    const records = await entityRecordRepository.listRecords(tenantId, entityType, branchId);
    return records;
  }

  public listRecords(
    ctx: unknown,
    tenantId: string,
    entityType: string,
    filter?: Record<string, unknown>
  ): (ExperienceEntityRecord & { recordId: string; data: Record<string, unknown> })[] {
    const records = this.getRecords(tenantId, entityType);
    const enriched = records.map(r => ({
      ...r,
      recordId: r.id,
      data: r.attributes,
    }));
    if (!filter) return enriched;
    return enriched.filter((r) => {
      for (const [k, v] of Object.entries(filter)) {
        if (r.attributes && r.attributes[k] !== v && r[k as keyof ExperienceEntityRecord] !== v) {
          return false;
        }
      }
      return true;
    });
  }

  public getRecord(
    ctx: unknown,
    tenantId: string,
    entityType: string,
    recordId: string
  ): (ExperienceEntityRecord & { recordId: string; data: Record<string, unknown>; [key: string]: any }) | null {
    const records = this.listRecords(ctx, tenantId, entityType);
    const rec = records.find(r => r.id === recordId || r.recordId === recordId);
    if (!rec) return null;
    return {
      ...rec,
      ...rec.attributes,
      recordId: rec.id,
      data: rec.attributes,
    };
  }

  public createRecord(
    ctx: unknown,
    tenantId: string,
    entityType: string,
    data: Record<string, unknown>
  ): ExperienceEntityRecord & { recordId: string; data: Record<string, unknown> } {
    const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRecord: ExperienceEntityRecord = {
      id: recordId,
      entityType,
      primaryIdentifier: (data.primaryIdentifier as string) || (data.admissionNo as string) || (data.skuCode as string) || recordId,
      secondaryIdentifier: (data.secondaryIdentifier as string) || (data.fullName as string) || (data.itemName as string) || entityType,
      status: (data.status as string) || 'ACTIVE',
      attributes: { ...data },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = this.saveRecord(tenantId, entityType, newRecord);
    return {
      ...saved,
      recordId: saved.id,
      data: saved.attributes,
    };
  }

  /** Creates an entity and waits for the authoritative Firestore commit. */
  public async createPersistentRecord(
    ctx: SecurityContext,
    tenantId: string,
    entityType: string,
    data: Record<string, unknown>
  ): Promise<ExperienceEntityRecord & { recordId: string; data: Record<string, unknown> }> {
    const branchId = typeof data.branchId === 'string' ? data.branchId : null;
    await this.assertPersistentAccess(ctx, tenantId, 'CREATE_ENTITY_RECORD', branchId);
    const recordId = (data.id as string) || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const record: ExperienceEntityRecord = {
      id: recordId,
      entityType,
      primaryIdentifier: (data.primaryIdentifier as string) || (data.admissionNo as string) || (data.skuCode as string) || recordId,
      secondaryIdentifier: (data.secondaryIdentifier as string) || (data.fullName as string) || (data.itemName as string) || entityType,
      status: (data.status as string) || 'ACTIVE',
      attributes: { ...data },
      createdAt: now,
      updatedAt: now,
    };
    const persisted = await entityRecordRepository.createIfAbsent(tenantId, entityType, record.id, record);
    const authoritative = persisted;
    const cache = this.entityStore.get(`${tenantId}:${entityType}`) || [];
    this.entityStore.set(`${tenantId}:${entityType}`, [authoritative, ...cache.filter((item) => item.id !== authoritative.id)]);
    return { ...authoritative, recordId: authoritative.id, data: authoritative.attributes };
  }

  /** Persists an entity record before updating the hot cache. Production command paths use this method. */
  public async savePersistentRecord(
    ctx: SecurityContext,
    tenantId: string,
    entityType: string,
    record: ExperienceEntityRecord,
  ): Promise<ExperienceEntityRecord> {
    await this.assertPersistentAccess(ctx, tenantId, 'WRITE_ENTITY_RECORD', record.branchId);
    const updated = { ...record, updatedAt: new Date().toISOString() };
    await entityRecordRepository.saveRecord(tenantId, entityType, updated.id, updated);
    const key = `${tenantId}:${entityType}`;
    const list = this.entityStore.get(key) || [];
    this.entityStore.set(key, [updated, ...list.filter((item) => item.id !== updated.id)]);
    return updated;
  }

  /** Updates an existing entity and waits for the authoritative Firestore commit. */
  public async updatePersistentRecord(
    ctx: SecurityContext,
    tenantId: string,
    entityType: string,
    recordId: string,
    patch: Record<string, unknown>,
  ): Promise<ExperienceEntityRecord & { recordId: string; data: Record<string, unknown> }> {
    const existing = await entityRecordRepository.getRecord(tenantId, entityType, recordId);
    await this.assertPersistentAccess(ctx, tenantId, 'UPDATE_ENTITY_RECORD', existing?.branchId || (patch.branchId as string | undefined));
    if (!existing) throw new Error(`Entity record '${recordId}' not found`);
    const now = new Date().toISOString();
    const updated: ExperienceEntityRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      entityType: existing.entityType,
      attributes: { ...existing.attributes, ...patch },
      updatedAt: now,
    };
    await entityRecordRepository.saveRecord(tenantId, entityType, recordId, updated);
    const key = `${tenantId}:${entityType}`;
    const list = this.entityStore.get(key) || [];
    this.entityStore.set(key, [updated, ...list.filter((item) => item.id !== recordId)]);
    return { ...updated, recordId: updated.id, data: updated.attributes };
  }

  /** Deletes an entity only after the authoritative Firestore delete succeeds. */
  public async deletePersistentRecord(
    ctx: SecurityContext,
    tenantId: string,
    entityType: string,
    recordId: string,
  ): Promise<void> {
    const existing = await entityRecordRepository.getRecord(tenantId, entityType, recordId);
    await this.assertPersistentAccess(ctx, tenantId, 'DELETE_ENTITY_RECORD', existing?.branchId);
    if (!existing) throw new Error(`Entity record '${recordId}' not found`);
    await entityRecordRepository.deleteRecord(tenantId, entityType, recordId);
    const key = `${tenantId}:${entityType}`;
    const list = this.entityStore.get(key) || [];
    this.entityStore.set(key, list.filter((item) => item.id !== recordId));
  }

  /**
   * Adds or updates a record for a given DBK and capability
   */
  public saveRecord(dbkId: string, capabilityId: string, record: ExperienceEntityRecord): ExperienceEntityRecord {
    const key = `${dbkId}:${capabilityId}`;
    const list = this.getRecords(dbkId, capabilityId);
    const existingIndex = list.findIndex((r) => r.id === record.id);

    let updated: ExperienceEntityRecord;
    if (existingIndex >= 0) {
      updated = { ...record, updatedAt: new Date().toISOString() };
      list[existingIndex] = updated;
    } else {
      updated = { ...record, createdAt: record.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      list.unshift(updated);
    }

    this.entityStore.set(key, list);
    void entityRecordRepository.saveRecord(dbkId, capabilityId, updated.id, updated);
    return updated;
  }

  private getDefaultRecordsForCapability(capabilityId: string): ExperienceEntityRecord[] {
    switch (capabilityId) {
      case 'student_records':
        return [
          { id: 'std_01', entityType: 'student_records', primaryIdentifier: 'ADM-2026-001', secondaryIdentifier: 'Zawadi Mwangi', status: 'ACTIVE', attributes: { admissionNo: 'ADM-2026-001', fullName: 'Zawadi Mwangi', classStream: 'Grade 7 East', parentContact: '+254712345678', feeBalance: 0, status: 'ACTIVE' }, createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-14T00:00:00Z' },
          { id: 'std_02', entityType: 'student_records', primaryIdentifier: 'ADM-2026-002', secondaryIdentifier: 'Brian Kiprono', status: 'ACTIVE', attributes: { admissionNo: 'ADM-2026-002', fullName: 'Brian Kiprono', classStream: 'Grade 8 West', parentContact: '+254722334455', feeBalance: 12500, status: 'ACTIVE' }, createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-14T00:00:00Z' },
          { id: 'std_03', entityType: 'student_records', primaryIdentifier: 'ADM-2026-003', secondaryIdentifier: 'Amina Hassan', status: 'ACTIVE', attributes: { admissionNo: 'ADM-2026-003', fullName: 'Amina Hassan', classStream: 'PP2 Blue', parentContact: '+254733445566', feeBalance: 4000, status: 'ACTIVE' }, createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-14T00:00:00Z' },
        ];
      case 'stock_control':
        return [
          { id: 'stk_01', entityType: 'stock_control', primaryIdentifier: 'CEM-BAM-425', secondaryIdentifier: 'Bamburi Power Plus 42.5N', status: 'ACTIVE', attributes: { skuCode: 'CEM-BAM-425', itemName: 'Bamburi Power Plus 42.5N Cement', category: 'Cement', quantityOnHand: 450, unit: '50kg Bags', unitPrice: 780, reorderLevel: 50 }, createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-14T00:00:00Z' },
          { id: 'stk_02', entityType: 'stock_control', primaryIdentifier: 'STL-TMT-12M', secondaryIdentifier: '12mm TMT Deformed Steel Bars', status: 'ACTIVE', attributes: { skuCode: 'STL-TMT-12M', itemName: '12mm TMT Deformed Steel Bars (12m)', category: 'Steel', quantityOnHand: 320, unit: 'Pieces', unitPrice: 1450, reorderLevel: 30 }, createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-14T00:00:00Z' },
          { id: 'stk_03', entityType: 'stock_control', primaryIdentifier: 'PNT-CRW-20L', secondaryIdentifier: 'Crown Matt Emulsion White (20L)', status: 'ACTIVE', attributes: { skuCode: 'PNT-CRW-20L', itemName: 'Crown Matt Emulsion Super White 20L', category: 'Paint', quantityOnHand: 65, unit: 'Buckets', unitPrice: 4200, reorderLevel: 10 }, createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-14T00:00:00Z' },
        ];
      case 'patient_queue':
        return [
          { id: 'rec_pt_01', entityType: 'patient_queue', primaryIdentifier: 'OPD-8821', secondaryIdentifier: 'John Mwangi', status: 'WITH_DOCTOR', attributes: { patientNumber: 'OPD-8821', fullName: 'John Mwangi', nationalId: '28449102', triageCategory: 'URGENT', assignedDoctor: 'Dr. G. Otieno', waitTime: 14 }, createdAt: '2026-08-14T06:45:00Z', updatedAt: '2026-08-14T07:00:00Z' },
          { id: 'rec_pt_02', entityType: 'patient_queue', primaryIdentifier: 'OPD-8822', secondaryIdentifier: 'Sharon Chebet', status: 'LAB_QUEUED', attributes: { patientNumber: 'OPD-8822', fullName: 'Sharon Chebet', nationalId: '31998012', triageCategory: 'ROUTINE', assignedDoctor: 'Dr. M. Wanjiku', waitTime: 22 }, createdAt: '2026-08-14T06:50:00Z', updatedAt: '2026-08-14T07:05:00Z' },
        ];
      case 'room_reservations':
        return [
          { id: 'rec_res_01', entityType: 'room_reservations', primaryIdentifier: 'RES-9901', secondaryIdentifier: 'Dr. & Mrs. Kariuki', status: 'CHECKED_IN', attributes: { bookingRef: 'RES-9901', guestName: 'Dr. & Mrs. Kariuki', roomNumber: 'Suite 204', checkInDate: '2026-08-13', checkOutDate: '2026-08-16', status: 'CHECKED_IN' }, createdAt: '2026-08-10T12:00:00Z', updatedAt: '2026-08-13T14:00:00Z' },
        ];
      case 'waybill_booking':
        return [
          { id: 'rec_wb_01', entityType: 'waybill_booking', primaryIdentifier: 'WB-9941', secondaryIdentifier: 'Nairobi to Mombasa Express', status: 'IN_TRANSIT', attributes: { waybillNo: 'WB-9941', consignor: 'Nairobi Hardware Ltd', consignee: 'Coastal Builders Mombasa', originDepot: 'Nairobi HQ Hub', destinationDepot: 'Mombasa Port Depot', declaredWeight: 2400, status: 'IN_TRANSIT' }, createdAt: '2026-08-14T04:00:00Z', updatedAt: '2026-08-14T06:30:00Z' },
        ];
      default:
        return [];
    }
  }

  private seedDefaultRecords(): void {
    // Initialized on demand via getDefaultRecordsForCapability
  }

  public clearStoreForTesting(): void {
    this.entityStore.clear();
  }
}

export const entityEngine = EntityEngineService.getInstance();
