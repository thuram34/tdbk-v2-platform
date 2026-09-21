import React, { useMemo, useState } from 'react';
import { Monitor, Radio, RefreshCw, ScreenShare, Wifi, WifiOff } from 'lucide-react';
import { buildSyncPlan, capabilitiesForNodeType, createDisplayCommand } from '../../platform/display/displayEngine';
import type { DisplayContent, DisplayEngineSnapshot, DisplayNode } from '../../platform/display/types';

export const DisplayControlCenter: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const now = new Date().toISOString();
  const [nodes, setNodes] = useState<DisplayNode[]>(() => [
    {displayId:'reception-tv',tenantId,siteId:'main',roomId:'reception',name:'Reception Display',nodeType:'RASPBERRY_PI',capabilities:capabilitiesForNodeType('RASPBERRY_PI'),status:'ONLINE',lastSeenAt:now,appVersion:'1.0.0',networkQuality:'GOOD',currentContentId:'welcome',currentScheduleId:null,offlineCacheVersion:12},
    {displayId:'class-6a',tenantId,siteId:'main',buildingId:'academic',roomId:'6A',name:'Classroom 6A',nodeType:'IDEAHUB',capabilities:capabilitiesForNodeType('IDEAHUB'),status:'ONLINE',lastSeenAt:now,appVersion:'1.0.0',networkQuality:'GOOD',currentContentId:'fractions',currentScheduleId:'math',offlineCacheVersion:27},
    {displayId:'auditorium-led',tenantId,siteId:'main',roomId:'auditorium',name:'Auditorium LED',nodeType:'LED_CONTROLLER',capabilities:capabilitiesForNodeType('LED_CONTROLLER'),status:'DEGRADED',lastSeenAt:now,appVersion:'1.0.0',networkQuality:'FAIR',currentContentId:'welcome',currentScheduleId:null,offlineCacheVersion:4},
  ]);
  const [selectedId,setSelectedId]=useState(nodes[0].displayId);
  const [message,setMessage]=useState('Display control plane ready');
  const snapshot: DisplayEngineSnapshot=useMemo(()=>({tenantId,generatedAt:now,nodes,content:[
    {contentId:'welcome',tenantId,title:'School Welcome',kind:'ANNOUNCEMENT',published:true,version:3,updatedAt:now},
    {contentId:'fractions',tenantId,title:'Grade 6 — Fractions',kind:'LESSON',requiredCapabilities:['LESSON_CONTENT','INTERACTIVE'],published:true,version:7,updatedAt:now},
  ],schedules:[]}),[tenantId,nodes]);
  const selected=nodes.find(n=>n.displayId===selectedId)??nodes[0];
  if(!selected)return null;
  const plan=buildSyncPlan(selected,snapshot);
  const command=(type: Parameters<typeof createDisplayCommand>[2])=>{
    const c=createDisplayCommand(tenantId,selected.displayId,type);
    setMessage(type.replaceAll('_',' ')+' queued · '+c.commandId.slice(0,8));
  };
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-indigo-300"><ScreenShare className="h-4 w-4"/>Unified Display Engine</div><h1 className="mt-2 text-2xl font-semibold text-white">Display Control Center</h1><p className="text-sm text-neutral-400">One TDBK control plane for signage, classrooms and LED surfaces.</p></div><button onClick={()=>setMessage('Heartbeat refresh requested')} className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-300"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-4 py-3 text-xs text-indigo-200">{message}</div>
    <div className="grid gap-4 lg:grid-cols-[1.3fr_.9fr]">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70"><div className="border-b border-neutral-800 px-4 py-3 text-xs font-semibold text-neutral-300">Display nodes</div>{nodes.map(n=><button key={n.displayId} onClick={()=>setSelectedId(n.displayId)} className={`w-full border-b border-neutral-800 p-4 text-left hover:bg-neutral-800/60 ${n.displayId===selectedId?'bg-indigo-950/30':''}`}><div className="flex items-center gap-3"><div className="rounded-xl border border-neutral-700 bg-neutral-950 p-2">{n.nodeType==='LED_CONTROLLER'?<Radio className="h-5 w-5"/>:<Monitor className="h-5 w-5"/>}</div><div className="min-w-0 flex-1"><div className="font-medium text-white">{n.name}</div><div className="mt-1 text-[11px] text-neutral-500">{n.nodeType.replaceAll('_',' ')} · {n.roomId??'unassigned'} · cache v{n.offlineCacheVersion}</div></div>{n.status==='ONLINE'?<Wifi className="h-4 w-4 text-emerald-400"/>:<WifiOff className="h-4 w-4 text-amber-400" />}</div></button>)}</section>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5"><div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Selected node</div><h2 className="mt-1 text-lg font-semibold text-white">{selected.name}</h2><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Status" value={selected.status}/><Metric label="Network" value={selected.networkQuality}/><Metric label="Cache" value={`v${selected.offlineCacheVersion}`}/><Metric label="App" value={selected.appVersion??'—'}/></div><div className="mt-4 flex flex-wrap gap-1.5">{selected.capabilities.map(c=><span key={c} className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[10px] text-neutral-300">{c.replaceAll('_',' ')}</span>)}</div><div className="mt-4 grid grid-cols-2 gap-2">{(['SYNC','REFRESH','ENTER_INTERACTIVE_MODE','CLEAR_CONTENT'] as const).map(t=><button key={t} onClick={()=>command(t)} className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-[11px] text-neutral-200 hover:bg-neutral-700">{t.replaceAll('_',' ')}</button>)}</div><div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-[11px] text-neutral-500">{plan.content.length} content items · {plan.schedules.length} schedules · next cache v{plan.cacheVersion}</div></section>
    </div>
  </div>;
};
const Metric=({label,value}:{label:string;value:string})=><div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"><div className="text-[9px] uppercase tracking-wider text-neutral-600">{label}</div><div className="mt-1 text-xs font-semibold text-neutral-200">{value}</div></div>;
