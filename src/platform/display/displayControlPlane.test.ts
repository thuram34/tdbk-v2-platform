import { describe, expect, it } from 'vitest';
import { InMemoryDisplayControlPlane } from './displayControlPlane';
import type { DisplayNode } from './types';
const node: DisplayNode={displayId:'d1',tenantId:'t1',siteId:'s1',name:'D1',nodeType:'TV_KIOSK',
 capabilities:['SIGNAGE'],status:'ONLINE',lastSeenAt:null,appVersion:'1',networkQuality:'GOOD',
 currentContentId:null,currentScheduleId:null,offlineCacheVersion:0};
describe('display control plane',()=>{it('enforces tenant isolation',async()=>{const cp=new InMemoryDisplayControlPlane(new Map([[node.displayId,node]]),()=>({tenantId:'t1',generatedAt:new Date().toISOString(),nodes:[node],content:[],schedules:[]})); await expect(cp.sync('t2','d1')).rejects.toThrow('DISPLAY_NOT_FOUND');});});
