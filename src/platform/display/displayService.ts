import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { buildSyncPlan, capabilitiesForNodeType, createDisplayCommand } from './displayEngine';
import type { DisplayCommand, DisplayContent, DisplayNode, DisplayNodeType, DisplayScheduleEntry, DisplaySyncPlan } from './types';

export interface DisplayRegistrationInput {
  tenantId: string; siteId: string; name: string; nodeType: DisplayNodeType;
  buildingId?: string | null; roomId?: string | null; capabilities?: DisplayNode['capabilities'];
}
export interface DisplayRegistrationResult { node: DisplayNode; pairingCode: string; expiresAt: string; }
export interface DisplayPairResult { displayId: string; deviceToken: string; }
export interface DisplayAuthRecord { displayId: string; tenantId: string; tokenHash: string; }

const nodePath=(tenantId:string,id:string)=>`/tenants/${tenantId}/displayNodes/${id}`;
const contentPath=(tenantId:string,id:string)=>`/tenants/${tenantId}/displayContent/${id}`;
const schedulePath=(tenantId:string,id:string)=>`/tenants/${tenantId}/displaySchedules/${id}`;
const pairingPath=(tenantId:string,code:string)=>`/tenants/${tenantId}/displayPairings/${code}`;
const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');

export class DisplayService {
  async register(input:DisplayRegistrationInput):Promise<DisplayRegistrationResult>{
    const displayId=`display_${randomUUID().replaceAll('-','').slice(0,20)}`;
    const pairingCode=String(Math.floor(100000+Math.random()*900000));
    const expiresAt=new Date(Date.now()+15*60_000).toISOString();
    const node:DisplayNode={displayId,tenantId:input.tenantId,siteId:input.siteId,buildingId:input.buildingId??null,roomId:input.roomId??null,
      name:input.name,nodeType:input.nodeType,capabilities:input.capabilities?.length?input.capabilities:capabilitiesForNodeType(input.nodeType),
      status:'UNKNOWN',lastSeenAt:null,appVersion:null,networkQuality:'UNKNOWN',currentContentId:null,currentScheduleId:null,offlineCacheVersion:0};
    await firestoreClient.runTransaction(async tx=>{ await tx.set(nodePath(input.tenantId,displayId),node); await tx.set(pairingPath(input.tenantId,pairingCode),{displayId,tenantId:input.tenantId,expiresAt,used:false}); });
    return {node,pairingCode,expiresAt};
  }
  async pair(tenantId:string,code:string):Promise<DisplayPairResult>{
    return firestoreClient.runTransaction(async tx=>{
      const pair=await tx.get<{displayId:string;tenantId:string;expiresAt:string;used:boolean}>(pairingPath(tenantId,code));
      if(!pair||pair.tenantId!==tenantId||pair.used||new Date(pair.expiresAt).getTime()<Date.now()) throw new Error('DISPLAY_PAIRING_INVALID');
      const deviceToken=randomBytes(32).toString('hex');
      await tx.update(pairingPath(tenantId,code),{used:true});
      await tx.set(`${nodePath(tenantId,pair.displayId)}/auth/device`,{displayId:pair.displayId,tenantId,tokenHash:tokenHash(deviceToken)});
      return {displayId:pair.displayId,deviceToken};
    });
  }
  async authenticateDevice(deviceToken:string):Promise<DisplayAuthRecord|null>{
    const hash=tokenHash(deviceToken);
    const tenants=await firestoreClient.listCollection<{displayId:string;tenantId:string;tokenHash:string}>('/system/displayDeviceAuth');
    return tenants.find(x=>x.tokenHash===hash)??null;
  }
  async heartbeat(heartbeat:{displayId:string;tenantId:string;status:DisplayNode['status'];networkQuality:DisplayNode['networkQuality'];appVersion:string;cacheVersion:number;currentContentId:string|null;reportedAt:string}):Promise<DisplayNode>{
    const path=nodePath(heartbeat.tenantId,heartbeat.displayId); const node=await firestoreClient.get<DisplayNode>(path);
    if(!node) throw new Error('DISPLAY_NOT_FOUND');
    const updated={...node,status:heartbeat.status,lastSeenAt:heartbeat.reportedAt,networkQuality:heartbeat.networkQuality,appVersion:heartbeat.appVersion,
      offlineCacheVersion:Math.max(node.offlineCacheVersion,heartbeat.cacheVersion),currentContentId:heartbeat.currentContentId};
    await firestoreClient.set(path,updated); return updated;
  }
  async getNode(tenantId:string,id:string){return firestoreClient.get<DisplayNode>(nodePath(tenantId,id));}
  async sync(tenantId:string,id:string):Promise<DisplaySyncPlan>{
    const node=await this.getNode(tenantId,id); if(!node) throw new Error('DISPLAY_NOT_FOUND');
    const [content,schedules]=await Promise.all([
      firestoreClient.listCollection<DisplayContent>(`/tenants/${tenantId}/displayContent`),
      firestoreClient.listCollection<DisplayScheduleEntry>(`/tenants/${tenantId}/displaySchedules`)
    ]);
    return buildSyncPlan(node,{tenantId,generatedAt:new Date().toISOString(),nodes:[node],content,schedules});
  }
  async issueCommand(tenantId:string,id:string,type:DisplayCommand['type'],payload:Record<string,unknown>={}):Promise<DisplayCommand>{
    const node=await this.getNode(tenantId,id); if(!node) throw new Error('DISPLAY_NOT_FOUND');
    const command=createDisplayCommand(tenantId,id,type,payload);
    await firestoreClient.set(`/tenants/${tenantId}/displayCommands/${command.commandId}`,command);
    return command;
  }
}
export const displayService=new DisplayService();
