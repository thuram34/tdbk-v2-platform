import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { dbkRegistryRepository } from '../../persistence/firestore/repositories/dbkRegistryRepository';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { securityContextFactory } from '../../kernel/context/contextFactory';
import { TokenVerifier } from '../../kernel/identity/tokenVerifier';
import { verticalCapabilityRuntime } from '../vertical/verticalCapabilityRuntime';

const cases = [
  ['school_v1', 'EDUCATION', 'student_records', { admissionNo: 'ADM-001', fullName: 'Student One', classStream: 'Grade 4A' }],
  ['hardware_v1', 'HARDWARE', 'counter_pos', { receiptNo: 'R-001', items: 'Cement x10', amount: 15000, paymentMethod: 'MPESA' }],
  ['retail_v1', 'RETAIL', 'barcode_pos', { barcode: '890001', itemName: 'Retail Item', quantity: 2, amount: 1200 }],
  ['computer_v1', 'ELECTRONICS', 'repair_job_cards', { jobNo: 'JOB-001', device: 'Laptop', customerName: 'Customer One', fault: 'No power', technician: 'Tech One' }],
  ['logistics_v1', 'LOGISTICS', 'waybill_booking', { waybillNo: 'WB-001', consignor: 'Sender', consignee: 'Receiver', originDepot: 'Mombasa', destinationDepot: 'Nairobi' }],
  ['clinic_v1', 'HEALTHCARE', 'patient_queue', { patientNumber: 'OPD-001', fullName: 'Patient One', triageCategory: 'ROUTINE', complaint: 'Fever' }],
  ['hotel_v1', 'HOSPITALITY', 'room_reservations', { bookingRef: 'BK-001', guestName: 'Guest One', roomNumber: '101', checkInDate: '2026-10-07', checkOutDate: '2026-10-09' }],
  ['salon_v1', 'BEAUTY', 'appointment_booking', { clientName: 'Client One', service: 'Hair', appointmentDate: '2026-10-08', stylist: 'Stylist One' }],
  ['prof_services_v1', 'PROFESSIONAL_SERVICES', 'case_management', { clientName: 'Client One', matterReference: 'MAT-001', matterType: 'Commercial' }],
  ['manufacturing_v1', 'MANUFACTURING', 'bom_management', { bomNumber: 'BOM-001', productName: 'Product One', components: 'Steel x2' }],
  ['construction_v1', 'CONSTRUCTION', 'project_register', { projectCode: 'PRJ-001', projectName: 'Project One', clientName: 'Client One' }],
  ['community_v1', 'COMMUNITY', 'member_registry', { memberNumber: 'MEM-001', fullName: 'Member One', membershipType: 'Community' }],
] as const;

describe('vertical operation acceptance matrix', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
    dbkCapabilityManager.clearStoreForTesting();
  });

  it.each(cases)('%s executes a real %s operation through the authoritative runtime', async (blueprintId, sector, capabilityId, payload) => {
    const dbkId = `dbk_vertical_matrix_${capabilityId}`;
    const now = new Date().toISOString();

    await dbkRegistryRepository.saveDbk(dbkId, {
      dbkId,
      legalName: `Vertical Matrix ${capabilityId}`,
      displayName: `Vertical Matrix ${capabilityId}`,
      sector,
      blueprintId,
      blueprintVersion: '1.0.0',
      subscriptionTier: 'FOUNDATION',
      status: 'ACTIVE',
      masterOwner: 'usr_vertical_matrix_master',
      createdAt: now,
      updatedAt: now,
      configurationVersion: 1,
      workspaceVersion: 1,
      branchTopology: [{
        branchId: `${dbkId}_hq`,
        dbkId,
        name: 'Headquarters',
        type: 'HEADQUARTERS',
        status: 'ACTIVE',
        isHeadquarters: true,
        createdAt: now,
        updatedAt: now,
      }],
      lifecycleHistory: [],
      metadata: {},
    });

    const token = TokenVerifier.mintTestToken({
      uid: 'usr_vertical_matrix_master',
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      tenantId: null,
      branchId: null,
      isMaster: true,
    });

    const context = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${token}`,
      targetTenantId: dbkId,
      targetBranchId: `${dbkId}_hq`,
    });

    await dbkCapabilityManager.enableCapabilityPersistent(
      context,
      dbkId,
      capabilityId,
      'ENTITLED',
      false,
    );

    const result = await verticalCapabilityRuntime.execute(context, dbkId, {
      capabilityId,
      operation: 'CREATE_RECORD',
      payload: { ...payload, branchId: `${dbkId}_hq` },
    });

    expect(result.recordId).toBeTruthy();
    expect(result.record).toMatchObject(payload);
    expect(result.status).toBeTruthy();
    expect(result.eventId).toBeTruthy();
  });
});
