import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { dbkRegistryRepository } from '../../persistence/firestore/repositories/dbkRegistryRepository';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { securityContextFactory } from '../../kernel/context/contextFactory';
import { TokenVerifier } from '../../kernel/identity/tokenVerifier';
import { verticalCapabilityRuntime } from '../vertical/verticalCapabilityRuntime';
import { branchRepository } from '../../persistence/firestore/repositories/branchRepository';
import { financialTransactionService } from '../../finance/transactionService';
import { reconciliationService } from '../../finance/reconciliationService';
import { ledgerService } from '../../finance/ledgerService';
import { receiptService } from '../../finance/receiptService';

const cases = [
  ['school_v1', 'EDUCATION', 'student_records'],
  ['hardware_v1', 'HARDWARE', 'counter_pos'],
  ['retail_v1', 'RETAIL', 'barcode_pos'],
  ['computer_v1', 'ELECTRONICS', 'repair_job_cards'],
  ['logistics_v1', 'LOGISTICS', 'waybill_booking'],
  ['clinic_v1', 'HEALTHCARE', 'patient_queue'],
  ['hotel_v1', 'HOSPITALITY', 'room_reservations'],
  ['salon_v1', 'BEAUTY', 'appointment_booking'],
  ['prof_services_v1', 'PROFESSIONAL_SERVICES', 'case_management'],
  ['manufacturing_v1', 'MANUFACTURING', 'bom_management'],
  ['construction_v1', 'CONSTRUCTION', 'project_register'],
  ['community_v1', 'COMMUNITY', 'member_registry'],
] as const;

describe('vertical commercial closure acceptance', () => {
  beforeEach(() => {
    firestoreClient.clearAllForTesting();
    dbkCapabilityManager.clearStoreForTesting();
  });

  it.each(cases)('%s reaches operation -> payment -> reconciliation -> ledger -> receipt', async (blueprintId, sector, capabilityId) => {
    const dbkId = `dbk_commercial_${capabilityId}`;
    const branchId = `${dbkId}_hq`;
    const recordId = `record_${capabilityId}`;
    const transactionId = `txn_${capabilityId}`;
    const now = new Date().toISOString();

    await dbkRegistryRepository.saveDbk(dbkId, {
      dbkId,
      legalName: `Commercial Closure ${capabilityId}`,
      displayName: `Commercial Closure ${capabilityId}`,
      sector,
      blueprintId,
      blueprintVersion: '1.0.0',
      subscriptionTier: 'ENTERPRISE',
      status: 'ACTIVE',
      masterOwner: 'usr_vertical_commercial_master',
      createdBy: 'usr_vertical_commercial_master',
      createdAt: now,
      updatedAt: now,
      configurationVersion: 1,
      workspaceVersion: 1,
      branchTopology: [{
        branchId,
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

    await branchRepository.saveBranch(dbkId, branchId, {
      branchId,
      dbkId,
      name: 'Headquarters',
      type: 'HEADQUARTERS',
      status: 'ACTIVE',
      isHeadquarters: true,
      createdAt: now,
      updatedAt: now,
    });

    const token = TokenVerifier.mintTestToken({
      uid: 'usr_vertical_commercial_master',
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      tenantId: null,
      branchId: null,
      isMaster: true,
    });

    const context = await securityContextFactory.createSecurityContext({
      authHeader: `Bearer ${token}`,
      targetTenantId: dbkId,
      targetBranchId: branchId,
    });

    await dbkCapabilityManager.enableCapabilityPersistent(
      context,
      dbkId,
      capabilityId,
      'ENTITLED',
      false,
    );

    const created = await verticalCapabilityRuntime.execute(context, dbkId, {
      capabilityId,
      operation: 'CREATE_RECORD',
      payload: {
        branchId,
        recordId,
        reference: `REF-${capabilityId}`,
        name: `Commercial ${capabilityId}`,
      },
    });

    expect(created.recordId).toBe(recordId);

    const completed = await verticalCapabilityRuntime.execute(context, dbkId, {
      capabilityId,
      operation: 'COMPLETE_RECORD',
      recordId,
      payload: { branchId },
    });
    expect(completed.status).toBe('COMPLETED');

    const pending = await financialTransactionService.createPending({
      transactionId,
      tenantId: dbkId,
      branchId,
      source: 'MPESA',
      providerReference: `SIM-${transactionId}`,
      amount: 1000,
      currency: 'KES',
      description: `Payment for ${capabilityId}`,
      correlationId: context.correlationId,
    });
    expect(pending.status).toBe('PENDING');

    await reconciliationService.markRequired(dbkId, transactionId);
    const unresolved = await financialTransactionService.get(dbkId, transactionId);
    expect(unresolved?.status).toBe('RECONCILIATION_REQUIRED');

    const postedAt = new Date().toISOString();
    const confirmed = {
      ...unresolved!,
      status: 'POSTED' as const,
      postedAt,
    };

    await reconciliationService.resolveConfirmed(confirmed, [
      {
        entryId: `${transactionId}_debit`,
        transactionId,
        tenantId: dbkId,
        account: 'RECEIVABLES:PAYMENTS',
        entryType: 'DEBIT',
        amount: 1000,
        currency: 'KES',
        createdAt: postedAt,
        immutable: true,
      },
      {
        entryId: `${transactionId}_credit`,
        transactionId,
        tenantId: dbkId,
        account: 'CASH:MPESA',
        entryType: 'CREDIT',
        amount: 1000,
        currency: 'KES',
        createdAt: postedAt,
        immutable: true,
      },
    ]);

    const persisted = await financialTransactionService.get(dbkId, transactionId);
    expect(persisted?.status).toBe('POSTED');

    const receipt = await receiptService.createFromPostedTransaction(dbkId, transactionId);
    expect(receipt.transactionId).toBe(transactionId);
    expect(receipt.amount).toBe(1000);

    const entries = await ledgerService.entries(dbkId, transactionId);
    expect(entries).toHaveLength(2);
    expect(entries.filter((entry) => entry.entryType === 'DEBIT')).toHaveLength(1);
    expect(entries.filter((entry) => entry.entryType === 'CREDIT')).toHaveLength(1);
    expect(entries.every((entry) => entry.amount === 1000)).toBe(true);
  });
});
