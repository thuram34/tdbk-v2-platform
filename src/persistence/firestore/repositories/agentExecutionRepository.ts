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

  /**
   * Agent execution identity is global, not tenant-scoped. The executionId
   * must never be rebound to another tenant, branch, or principal merely by
   * changing the collection path.
   */
  private path(executionId: string): string {
    return `/system/agentExecutions/${executionId}`;
  }

  public async claim(record: AgentExecutionRecord, leaseOwner: string): Promise<AgentExecutionClaim> {
    const now = Date.now();
    const leaseUntil = new Date(now + EXECUTION_LEASE_MS).toISOString();
    const path = this.path(record.executionId);

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
      // A live durable lease is exclusive even to the current owner. Reclaim
      // is only legal after the recorded lease has expired.
      if (activeLease) {
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
      const path = this.path(record.executionId);
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
    const record = await firestoreClient.get<AgentExecutionRecord>(this.path(executionId));
    if (!record || record.tenantId !== tenantId) return null;
    return record;
  }

  public async getSystem(executionId: string): Promise<AgentExecutionRecord | null> {
    return firestoreClient.get<AgentExecutionRecord>(this.path(executionId));
  }

  public async list(tenantId: string): Promise<AgentExecutionRecord[]> {
    const records = await firestoreClient.listCollection<AgentExecutionRecord>('/system/agentExecutions');
    return records.filter((record) => record.tenantId === tenantId);
  }
}

export const agentExecutionRepository = AgentExecutionRepository.getInstance();
