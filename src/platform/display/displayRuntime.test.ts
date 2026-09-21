import { describe, expect, it } from 'vitest';
import { BrowserDisplayRuntime, createHeartbeat } from './displayRuntime';
import type { DisplayNode } from './types';
const node: DisplayNode = { displayId:'d1', tenantId:'t1', siteId:'s1', name:'Display', nodeType:'BROWSER_KIOSK',
  capabilities:['SIGNAGE'], status:'ONLINE', lastSeenAt:null, appVersion:'1.2.0', networkQuality:'GOOD',
  currentContentId:null, currentScheduleId:null, offlineCacheVersion:4 };
describe('display runtime', () => {
  it('creates tenant-scoped heartbeat', () => expect(createHeartbeat(node,'ONLINE')).toMatchObject({displayId:'d1',tenantId:'t1',appVersion:'1.2.0',cacheVersion:4}));
  it('falls back to last sync plan offline', async () => {
    let calls=0;
    const plan:any={displayId:'d1',generatedAt:new Date().toISOString(),content:[],schedules:[],commands:[],cacheVersion:5};
    const runtime=new BrowserDisplayRuntime(node,{heartbeat:async()=>{},sync:async()=>{calls++; if(calls===1)return plan; throw new Error('offline')},command:async()=>{}});
    expect(await runtime.sync()).toBe(plan); expect(await runtime.sync()).toBe(plan);
  });
});
