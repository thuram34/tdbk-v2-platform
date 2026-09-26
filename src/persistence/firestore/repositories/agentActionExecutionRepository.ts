/** TDBK V2 — DURABLE COMMAND-AGENT ACTION EXECUTION */
import { firestoreClient } from '../firestoreClient';
import { AgentActionResult } from '../../../platform/agent/types';

export type AgentActionExecutionStatus = 'EXECUTING' | 'COMPLETED' | 'FAILED';
export interface AgentActionExecutionRecord { executionId:string; instructionId:string; actionId:string; tenantId:string|null; branchId:string|null; principalId:string; actionKind:string; targetFingerprint:string; status:AgentActionExecutionStatus; result?:AgentActionResult; createdAt:string; updatedAt:string; leaseOwner:string; leaseUntil:string; }
export type AgentActionExecutionClaim = {status:'ACQUIRED'|'COMPLETED'|'IN_PROGRESS'; record:AgentActionExecutionRecord};
const LEASE_MS = 5 * 60 * 1000;
export class AgentActionExecutionRepository {
  private path(executionId:string):string { return '/system/agentActionExecutions/' + executionId; }
  public async claim(record:Omit<AgentActionExecutionRecord,'status'|'createdAt'|'updatedAt'|'leaseUntil'>):Promise<AgentActionExecutionClaim>{
    const now=Date.now(), timestamp=new Date(now).toISOString(), path=this.path(record.executionId);
    return firestoreClient.runTransaction(async transaction=>{
      const existing=await transaction.get<AgentActionExecutionRecord>(path);
      if(!existing){ const claimed={...record,status:'EXECUTING' as const,createdAt:timestamp,updatedAt:timestamp,leaseUntil:new Date(now+LEASE_MS).toISOString()}; await transaction.set(path,claimed); return {status:'ACQUIRED' as const,record:claimed}; }
      if(existing.executionId!==record.executionId||existing.instructionId!==record.instructionId||existing.actionId!==record.actionId||existing.tenantId!==record.tenantId||existing.branchId!==record.branchId||existing.principalId!==record.principalId||existing.actionKind!==record.actionKind||existing.targetFingerprint!==record.targetFingerprint) throw new Error('Agent action execution identity conflict.');
      if(existing.status==='COMPLETED') return {status:'COMPLETED' as const,record:existing};
      if(existing.leaseUntil && Date.parse(existing.leaseUntil)>now) return {status:'IN_PROGRESS' as const,record:existing};
      const reclaimed={...existing,status:'EXECUTING' as const,leaseOwner:record.leaseOwner,leaseUntil:new Date(now+LEASE_MS).toISOString(),updatedAt:timestamp,result:undefined};
      await transaction.set(path,reclaimed); return {status:'ACQUIRED' as const,record:reclaimed};
    });
  }
  public async complete(executionId:string,leaseOwner:string,result:AgentActionResult){ return this.finish(executionId,leaseOwner,'COMPLETED',result); }
  public async fail(executionId:string,leaseOwner:string,result:AgentActionResult){ return this.finish(executionId,leaseOwner,'FAILED',result); }
  private async finish(executionId:string,leaseOwner:string,status:AgentActionExecutionStatus,result:AgentActionResult){
    await firestoreClient.runTransaction(async transaction=>{
      const path=this.path(executionId), existing=await transaction.get<AgentActionExecutionRecord>(path);
      if(!existing) throw new Error('Agent action execution does not exist.');
      if(existing.status!=='EXECUTING'||existing.leaseOwner!==leaseOwner) throw new Error('Agent action execution lease conflict.');
      if(existing.leaseUntil && Date.parse(existing.leaseUntil)<=Date.now()) throw new Error('Agent action execution lease expired.');
      await transaction.set(path,{...existing,status,result,updatedAt:new Date().toISOString(),leaseUntil:new Date(0).toISOString()});
    });
  }
}
export const agentActionExecutionRepository=new AgentActionExecutionRepository();