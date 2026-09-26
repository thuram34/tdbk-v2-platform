import {beforeEach,describe,expect,it} from 'vitest';
import {firestoreClient} from '../firestoreClient';
import {agentActionExecutionRepository} from '../repositories/agentActionExecutionRepository';
describe('durable agent action execution',()=>{
 beforeEach(()=>firestoreClient.clearAllForTesting());
 it('returns completed action after restart',async()=>{
  const base={executionId:'agent_exec_1:action_1',instructionId:'agent_exec_1',actionId:'action_1',tenantId:'tenant_a',branchId:'branch_a',principalId:'principal_a',actionKind:'ENABLE_CAPABILITY',targetFingerprint:'tenant_a|pos',leaseOwner:'worker_a'};
  const first=await agentActionExecutionRepository.claim(base); expect(first.status).toBe('ACQUIRED');
  await agentActionExecutionRepository.complete(base.executionId,base.leaseOwner,{actionId:base.actionId,status:'COMPLETED',data:{state:'ENABLED'}});
  firestoreClient.simulateServerRestart();
  const recovered=await agentActionExecutionRepository.claim({...base,leaseOwner:'worker_b'});
  expect(recovered.status).toBe('COMPLETED'); expect(recovered.record.result?.data).toEqual({state:'ENABLED'});
 });
 it('rejects concurrent active claim',async()=>{
  const base={executionId:'agent_exec_2:action_1',instructionId:'agent_exec_2',actionId:'action_1',tenantId:'tenant_a',branchId:null,principalId:'principal_a',actionKind:'COMPOSE_BUSINESS',targetFingerprint:'tenant_a',leaseOwner:'worker_a'};
  const first=await agentActionExecutionRepository.claim(base), second=await agentActionExecutionRepository.claim(base);
  expect(first.status).toBe('ACQUIRED'); expect(second.status).toBe('IN_PROGRESS');
 });
 it('prevents identity rebinding',async()=>{
  const base={executionId:'agent_exec_3:action_1',instructionId:'agent_exec_3',actionId:'action_1',tenantId:'tenant_a',branchId:null,principalId:'principal_a',actionKind:'DISABLE_CAPABILITY',targetFingerprint:'tenant_a|pos',leaseOwner:'worker_a'};
  await agentActionExecutionRepository.claim(base); await expect(agentActionExecutionRepository.claim({...base,principalId:'principal_b'})).rejects.toThrow('identity conflict');
 });
});