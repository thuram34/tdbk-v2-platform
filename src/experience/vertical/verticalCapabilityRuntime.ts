import { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { dbkRegistry } from '../../platform/dbkRegistry';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { capabilityRegistry } from '../../capability/registry';
import { entityEngine } from '../entity/entityEngine';
import { eventBus } from '../../orchestration/events/eventBus';
import { VERTICAL_WORKFLOW_CATALOG } from './workflowCatalog';
import { entityRecordRepository } from '../../persistence/firestore/repositories/entityRecordRepository';

export type VerticalOperation =
  | 'CREATE_RECORD'
  | 'UPDATE_RECORD'
  | 'COMPLETE_RECORD'
  | 'CANCEL_RECORD';

export interface VerticalOperationRequest {
  capabilityId: string;
  operation: VerticalOperation;
  recordId?: string;
  payload: Record<string, unknown>;
}

export interface VerticalOperationResult {
  capabilityId: string;
  operation: VerticalOperation;
  recordId: string;
  status: string;
  record: Record<string, unknown>;
  eventId?: string;
}

export class VerticalCapabilityRuntime {
  private static instance: VerticalCapabilityRuntime;

  private constructor() {}

  public static getInstance(): VerticalCapabilityRuntime {
    if (!VerticalCapabilityRuntime.instance) {
      VerticalCapabilityRuntime.instance = new VerticalCapabilityRuntime();
    }
    return VerticalCapabilityRuntime.instance;
  }

  public async execute(
    context: SecurityContext,
    dbkId: string,
    request: VerticalOperationRequest,
  ): Promise<VerticalOperationResult> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'verticalCapabilityOperation', context.requestId);
    const dbk = await dbkRegistry.getDbk(context, dbkId);
    if (!dbk) throw new KernelError('NOT_FOUND', `DBK '${dbkId}' not found`, 404, context.requestId);

    const capability = capabilityRegistry.getCapability(request.capabilityId, `VERTICAL_${request.operation}`);
    if (!capability) {
      throw new KernelError('NOT_FOUND', `Capability '${request.capabilityId}' not found`, 404, context.requestId);
    }

    await dbkCapabilityManager.assertCapabilityOperational(context, dbkId, request.capabilityId);

    const workflow = VERTICAL_WORKFLOW_CATALOG.find((item) => item.capabilityId === request.capabilityId);
    if (workflow) {
      const missing = workflow.requiredFields.filter((field) => request.payload[field] === undefined || request.payload[field] === null || request.payload[field] === '');
      if (missing.length) throw new KernelError('VALIDATION_ERROR', `Missing required fields for ${request.capabilityId}: ${missing.join(', ')}`, 400, context.requestId);
    }

    const branchId = typeof request.payload.branchId === 'string'
      ? request.payload.branchId
      : context.branchContext?.branchId || context.principal.branchId || undefined;

    const existingRecord = request.recordId ? await entityRecordRepository.getRecord(dbkId, request.capabilityId, request.recordId) : null;
    const currentStatus = request.payload.status ? String(request.payload.status) : (existingRecord?.status ? String(existingRecord.status) : undefined);
    const defaultStatus = workflow ? Object.keys(workflow.allowedTransitions)[0] || 'ACTIVE' : 'ACTIVE';
    const targetStatus = request.operation === 'COMPLETE_RECORD' ? 'COMPLETED' : request.operation === 'CANCEL_RECORD' ? 'CANCELLED' : (currentStatus || defaultStatus);

    if (workflow && request.operation !== 'CREATE_RECORD') {
      const from = currentStatus || defaultStatus;
      const allowed = workflow.allowedTransitions[from] || [];
      if (request.operation === 'UPDATE_RECORD' && currentStatus && !allowed.includes(targetStatus) && targetStatus !== from) {
        throw new KernelError('VALIDATION_ERROR', `Invalid ${request.capabilityId} transition: ${from} -> ${targetStatus}`, 409, context.requestId);
      }
      if (request.operation === 'COMPLETE_RECORD' && !allowed.includes('COMPLETED')) {
        throw new KernelError('VALIDATION_ERROR', `Cannot complete ${request.capabilityId} from state ${from}`, 409, context.requestId);
      }
    }

    const payload = {
      ...request.payload,
      ...(branchId ? { branchId } : {}),
      dbkId,
      capabilityId: request.capabilityId,
      updatedBy: context.principal.id,
    };

    let recordId = request.recordId || String(payload.recordId || payload.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
    let record: any;

    if (request.operation === 'CREATE_RECORD') {
      record = await entityEngine.createPersistentRecord(context, dbkId, request.capabilityId, {
        ...payload,
        id: recordId,
        primaryIdentifier: String(payload.reference || payload.code || recordId),
        secondaryIdentifier: String(payload.name || payload.title || capability.name),
        status: targetStatus,
      });
      recordId = record.id;
    } else {
      if (!request.recordId) {
        throw new KernelError('VALIDATION_ERROR', 'recordId is required for update/complete/cancel operations', 400, context.requestId);
      }
      const nextStatus = targetStatus;

      record = await entityEngine.updatePersistentRecord(
        context,
        dbkId,
        request.capabilityId,
        request.recordId,
        { ...payload, status: nextStatus },
      );
      recordId = record.id;
    }

    const event = await eventBus.publishEvent(context, 'workflow.completed.v1', {
      dbkId,
      branchId: branchId || null,
      capabilityId: request.capabilityId,
      operation: request.operation,
      recordId,
      sector: dbk.sector,
    });

    return {
      capabilityId: request.capabilityId,
      operation: request.operation,
      recordId,
      status: String(record.status || payload.status || 'ACTIVE'),
      record: { ...record.data, recordId },
      eventId: event.eventId,
    };
  }
}

export const verticalCapabilityRuntime = VerticalCapabilityRuntime.getInstance();