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
}

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

  public async save(record: AgentExecutionRecord): Promise<void> {
    await firestoreClient.set(this.path(record.tenantId, record.executionId), record as unknown as Record<string, unknown>);
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
