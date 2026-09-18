import { firestoreClient } from '../firestoreClient';
import type { DisplayHeartbeat } from '../../../platform/display/displayRuntime';
import type { DisplayNode } from '../../../platform/display/types';
export class DisplayRepository {
  private path=(tenantId:string,id:string)=>`/tenants/${tenantId}/displayNodes/${id}`;
  async getNode(tenantId:string,id:string){return firestoreClient.get<DisplayNode>(this.path(tenantId,id));}
  async saveHeartbeat(input:DisplayHeartbeat){await firestoreClient.update(this.path(input.tenantId,input.displayId),{status:input.status,lastSeenAt:input.reportedAt,networkQuality:input.networkQuality,appVersion:input.appVersion,offlineCacheVersion:input.cacheVersion,currentContentId:input.currentContentId});}
}
export const displayRepository=new DisplayRepository();
