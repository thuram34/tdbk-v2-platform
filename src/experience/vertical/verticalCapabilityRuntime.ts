import { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { dbkRegistry } from '../../platform/dbkRegistry';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { capabilityRegistry } from '../../capability/registry';
import { entityEngine } from '../entity/entityEngine';
import { eventBus } from '../../orchestration/events/eventBus';

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

    const capability = capabilityRegistry.getCapability(request.capabilityId);
    if (!capability) {
      throw new KernelError('NOT_FOUND', `Capability '${request.capabilityId}' not found`, 404, context.requestId);
    }

    await dbkCapabilityManager.assertCapabilityOperational(context, dbkId, request.capabilityId);

    const branchId = typeof request.payload.branchId === 'string'
      ? request.payload.branchId
      : context.branchContext?.branchId || context.principal.branchId || undefined;

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
        status: String(payload.status || 'ACTIVE'),
      });
      recordId = record.id;
    } else {
      if (!request.recordId) {
        throw new KernelError('VALIDATION_ERROR', 'recordId is required for update/complete/cancel operations', 400, context.requestId);
      }
      const nextStatus =
        request.operation === 'COMPLETE_RECORD' ? 'COMPLETED' :
        request.operation === 'CANCEL_RECORD' ? 'CANCELLED' :
        String(payload.status || 'ACTIVE');

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