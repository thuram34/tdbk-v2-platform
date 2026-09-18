import { describe, expect, it } from 'vitest';
import { buildSyncPlan, capabilitiesForNodeType, isNodeEligibleForContent, scheduleTargetsNode } from '../displayEngine';
import type { DisplayContent, DisplayEngineSnapshot, DisplayNode, DisplayScheduleEntry } from '../types';
const signageNode: DisplayNode={displayId:'hallway-a',tenantId:'school-1',siteId:'main',roomId:'hallway-a',name:'Hallway A',
 nodeType:'RASPBERRY_PI',capabilities:capabilitiesForNodeType('RASPBERRY_PI'),status:'ONLINE',lastSeenAt:new Date().toISOString(),
 appVersion:'1.0.0',networkQuality:'GOOD',currentContentId:null,currentScheduleId:null,offlineCacheVersion:2};
const classroomNode: DisplayNode={...signageNode,displayId:'class-6a',roomId:'6A',name:'Classroom 6A',nodeType:'IDEAHUB',capabilities:capabilitiesForNodeType('IDEAHUB')};
const announcement: DisplayContent={contentId:'announcement-1',tenantId:'school-1',title:'Morning Welcome',kind:'ANNOUNCEMENT',published:true,version:1,updatedAt:new Date().toISOString()};
const lesson: DisplayContent={contentId:'lesson-1',tenantId:'school-1',title:'Grade 6 Fractions',kind:'LESSON',requiredCapabilities:['LESSON_CONTENT','INTERACTIVE'],published:true,version:1,updatedAt:new Date().toISOString()};
describe('TDBK Unified Display Engine',()=>{it('allows common signage content on a Pi',()=>expect(isNodeEligibleForContent(signageNode,announcement)).toBe(true));
it('keeps interactive lesson content off signage-only nodes',()=>{expect(isNodeEligibleForContent(signageNode,lesson)).toBe(false);expect(isNodeEligibleForContent(classroomNode,lesson)).toBe(true);});
it('matches capability and room targeting',()=>{const schedule:DisplayScheduleEntry={scheduleId:'s1',tenantId:'school-1',title:'Classroom lesson',contentId:'lesson-1',startsAt:new Date().toISOString(),endsAt:null,targetRoomIds:['6A'],targetCapabilities:['INTERACTIVE'],enabled:true};expect(scheduleTargetsNode(classroomNode,schedule)).toBe(true);expect(scheduleTargetsNode(signageNode,schedule)).toBe(false);});
it('builds an offline-capable sync plan from one control plane',()=>{const snapshot:DisplayEngineSnapshot={tenantId:'school-1',generatedAt:new Date().toISOString(),nodes:[signageNode,classroomNode],content:[announcement,lesson],schedules:[]};const plan=buildSyncPlan(classroomNode,snapshot);expect(plan.content.map(x=>x.contentId)).toEqual(['announcement-1','lesson-1']);expect(plan.cacheVersion).toBe(3);});
});
