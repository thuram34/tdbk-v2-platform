/** TDBK V2 — COMMAND EXECUTION LEDGER */
import { firestoreClient } from '../firestoreClient';
import { AgentRunResult } from '../../../platform/agent/types';

export type AgentExecutionStatus = 'PLANNED' | 'EXECUTED' | 'VERIFIED' | 'PARTIAL' | 'FAILED' | 'AUTHORIZATION_REQUIRED' | 'VERIFICATION_FAILED';

export interface AgentExecutionRecord {
  executionId: string;
  instructionId: string;
  tenantId: string | null;
  branchId: string | null;
  principalId: string;
  instruction: string;
  intent: string;
  status: AgentExecutionStatus;
  plan: AgentRunResult['plan'];
  results: AgentRunResult['results'];
  createdAt: string;
  completedAt: string;
  leaseOwner?: string;
  leaseUntil?: string;
}

export type AgentExecutionClaim =
  | { status: 'ACQUIRED'; record: AgentExecutionRecord }
  | { status: 'COMPLETED'; record: AgentExecutionRecord }
  | { status: 'IN_PROGRESS'; record: AgentExecutionRecord };

const EXECUTION_LEASE_MS = 5 * 60 * 1000;

export class AgentExecutionRepository {
  private static instance: AgentExecutionRepository;
  private constructor() {}

  public static getInstance(): AgentExecutionRepository {
    if (!AgentExecutionRepository.instance) AgentExecutionRepository.instance = new AgentExecutionRepository();
    return AgentExecutionRepository.instance;
  }

  private path(tenantId: string | null, executionId: string): string {
    return tenantId
      ? `/tenants/${tenantId}/agentExecutions/${executionId}`
      : `/system/agentExecutions/${executionId}`;
  }

  public async claim(record: AgentExecutionRecord, leaseOwner: string): Promise<AgentExecutionClaim> {
    const now = Date.now();
    const leaseUntil = new Date(now + EXECUTION_LEASE_MS).toISOString();
    const path = this.path(record.tenantId, record.executionId);

    return firestoreClient.runTransaction(async (transaction) => {
      const existing = await transaction.get<AgentExecutionRecord>(path);
      if (!existing) {
        const claimed = { ...record, status: 'PLANNED' as const, leaseOwner, leaseUntil };
        await transaction.set(path, claimed);
        return { status: 'ACQUIRED' as const, record: claimed };
      }

      if (
        existing.executionId !== record.executionId ||
        existing.instructionId !== record.instructionId ||
        existing.tenantId !== record.tenantId ||
        existing.branchId !== record.branchId ||
        existing.principalId !== record.principalId ||
        existing.instruction !== record.instruction
      ) {
        throw new Error('Agent execution identity conflict: executionId is already bound to a different principal, scope, or instruction.');
      }

      if (existing.status === 'EXECUTED' || existing.status === 'VERIFIED') {
        return { status: 'COMPLETED' as const, record: existing };
      }

      const activeLease = existing.leaseUntil ? Date.parse(existing.leaseUntil) > now : false;
      if (activeLease && existing.leaseOwner !== leaseOwner) {
        return { status: 'IN_PROGRESS' as const, record: existing };
      }

      const reclaimed = {
        ...existing,
        leaseOwner,
        leaseUntil,
      } as AgentExecutionRecord;
      await transaction.set(path, reclaimed);
      return { status: 'ACQUIRED' as const, record: reclaimed };
    });
  }

  public async save(record: AgentExecutionRecord): Promise<void> {
    await firestoreClient.runTransaction(async (transaction) => {
      const path = this.path(record.tenantId, record.executionId);
      const existing = await transaction.get<AgentExecutionRecord>(path);
      if (!existing) {
        throw new Error(`Agent execution '${record.executionId}' does not exist for completion`);
      }
      if (
        existing.principalId !== record.principalId ||
        existing.tenantId !== record.tenantId ||
        existing.branchId !== record.branchId ||
        existing.instruction !== record.instruction
      ) {
        throw new Error('Agent execution completion identity conflict.');
      }
      if (existing.status === 'EXECUTED' || existing.status === 'VERIFIED') {
        return;
      }
      if (existing.leaseOwner && record.leaseOwner && existing.leaseOwner !== record.leaseOwner) {
        throw new Error('Agent execution completion lease conflict.');
      }
      await transaction.set(path, { ...record, leaseOwner: undefined, leaseUntil: undefined });
    });
  }

  public async get(tenantId: string, executionId: string): Promise<AgentExecutionRecord | null> {
    return firestoreClient.get<AgentExecutionRecord>(this.path(tenantId, executionId));
  }

  public async getSystem(executionId: string): Promise<AgentExecutionRecord | null> {
    return firestoreClient.get<AgentExecutionRecord>(this.path(null, executionId));
  }

  public async list(tenantId: string): Promise<AgentExecutionRecord[]> {
    return firestoreClient.listCollection<AgentExecutionRecord>(`/tenants/${tenantId}/agentExecutions`);
  }
}

export const agentExecutionRepository = AgentExecutionRepository.getInstance();
