import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../client/AuthContext';
import type { DbkExperienceResolved } from '../../experience/types';
import type {
  CustomActionButton, CustomQuestionnaireField, ExperienceCustomization,
} from '../../experience/customization/types';
import { Plus, Save, Trash2, Eye, Menu, MousePointerClick, ClipboardList, Workflow } from 'lucide-react';

interface Props {
  experience: DbkExperienceResolved;
  onRefresh: () => Promise<void>;
}

const emptyConfig = (dbkId: string): ExperienceCustomization => ({
  dbkId, version: 0, menuItems: [], buttons: [], questionnaires: [], workflows: [],
  updatedAt: new Date(0).toISOString(), updatedBy: 'SYSTEM',
});
const input = 'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-500';
const button = 'inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold hover:bg-neutral-50';

export const ExperienceStudio: React.FC<Props> = ({ experience, onRefresh }) => {
  const { getIdToken } = useAuth();
  const [config, setConfig] = useState<ExperienceCustomization>(() => emptyConfig(experience.dbkId));
  const [tab, setTab] = useState<'menus' | 'buttons' | 'forms' | 'workflows' | 'preview'>('menus');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const capabilities = useMemo(() => {
    const fromNavigation = experience.navigation.filter(item => item.capabilityId).map(item => ({
      capabilityId: item.capabilityId!, label: item.label, iconName: item.iconName, category: item.category,
    }));
    const fromDiscovery = experience.discoveryItems.filter(item => item.isEnabled).map(item => ({
      capabilityId: item.capabilityId, label: item.name, iconName: item.iconName, category: 'CORE_OPERATIONS' as const,
    }));
    return Array.from(new Map([...fromNavigation, ...fromDiscovery].map(item => [item.capabilityId, item])).values());
  }, [experience.navigation, experience.discoveryItems]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const token = await getIdToken();
        if (!token) throw new Error('Your session has expired.');
        const response = await fetch(`/api/experience/customization/${encodeURIComponent(experience.dbkId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error?.message || 'Could not load workspace configuration.');
        if (!cancelled) {
          const loaded = data.customization || emptyConfig(experience.dbkId);
          if (loaded.version === 0 && !loaded.menuItems?.length) {
            loaded.menuItems = experience.navigation.filter(item => item.capabilityId).map((item, index) => ({
              id: `menu_${item.capabilityId}`, label: item.label, iconName: item.iconName,
              category: item.category, capabilityId: item.capabilityId!, displayOrder: index + 1, enabled: true,
            }));
          }
          setConfig(loaded);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load configuration.');
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [experience.dbkId, getIdToken]);

  const update = (patch: Partial<ExperienceCustomization>) => setConfig(current => ({ ...current, ...patch }));
  const save = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Your session has expired.');
      const response = await fetch(`/api/experience/customization/${encodeURIComponent(experience.dbkId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          expectedVersion: config.version,
          menuItems: config.menuItems,
          buttons: config.buttons,
          questionnaires: config.questionnaires,
          workflows: config.workflows,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || 'Configuration could not be saved.');
      setConfig(data.customization);
      setSuccess(`Published configuration version ${data.customization.version}.`);
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Configuration could not be saved.'); }
    finally { setSaving(false); }
  };

  const addMenu = () => {
    const cap = capabilities.find(item => !config.menuItems.some(existing => existing.capabilityId === item.capabilityId));
    if (!cap?.capabilityId) { setError('All currently enabled capabilities are already represented in the menu. Enable another capability in Discovery first.'); return; }
    const id = crypto.randomUUID();
    update({ menuItems: [...config.menuItems, { id, label: cap.label, iconName: cap.iconName, category: cap.category, capabilityId: cap.capabilityId, displayOrder: config.menuItems.length + 1, enabled: true }] });
  };
  const addButton = () => update({ buttons: [...config.buttons, { id: crypto.randomUUID(), label: 'New action', variant: 'PRIMARY', action: { type: 'NAVIGATE_CAPABILITY', targetId: capabilities[0]?.capabilityId || '' }, enabled: true }] });
  const addForm = () => {
    const cap = capabilities[0];
    if (!cap?.capabilityId) { setError('Enable a capability to receive questionnaire submissions.'); return; }
    update({ questionnaires: [...config.questionnaires, { id: crypto.randomUUID(), title: 'New questionnaire', description: '', targetCapabilityId: cap.capabilityId, submitLabel: 'Submit', enabled: true, fields: [{ id: crypto.randomUUID(), key: 'fullName', label: 'Full name', type: 'TEXT', required: true }] }] });
  };
  const addWorkflow = () => update({ workflows: [...config.workflows, { id: crypto.randomUUID(), name: 'New workflow', description: '', enabled: true, steps: [{ id: crypto.randomUUID(), title: 'Capture request', description: 'Collect the required information.' }] }] });

  const tabs = [
    { id: 'menus', label: 'Menu items', icon: Menu },
    { id: 'buttons', label: 'Custom buttons', icon: MousePointerClick },
    { id: 'forms', label: 'Questionnaires', icon: ClipboardList },
    { id: 'workflows', label: 'Structured flows', icon: Workflow },
    { id: 'preview', label: 'Preview', icon: Eye },
  ] as const;

  return <div className="space-y-5">
    <header className="rounded-3xl bg-neutral-950 p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">TDBK · Experience Studio</p><h1 className="mt-2 text-2xl font-bold">Configure this workspace</h1><p className="mt-1 max-w-2xl text-sm text-neutral-300">Build the menu, action buttons, data-capture questionnaires and guided operating flows for this DBK.</p></div>
        <button type="button" onClick={save} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-neutral-950 disabled:opacity-50"><Save size={15}/>{saving ? 'Saving…' : 'Save configuration'}</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-neutral-300"><span className="rounded-full bg-white/10 px-2.5 py-1">Workspace: {experience.displayName}</span><span className="rounded-full bg-white/10 px-2.5 py-1">Version: {config.version}</span><span className="rounded-full bg-white/10 px-2.5 py-1">{capabilities.length} enabled capabilities available</span></div>
    </header>

    <div className="flex flex-wrap gap-2">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${tab === item.id ? 'bg-neutral-950 text-white' : 'border border-neutral-200 bg-white text-neutral-600'}`}><Icon size={15}/>{item.label}</button>; })}</div>
    {loading && <p className="text-sm text-neutral-500">Loading saved workspace configuration…</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

    {tab === 'menus' && <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Menu designer</h2><p className="text-xs text-neutral-500">Add, rename, order and show or hide capability destinations.</p></div><button type="button" className={button} onClick={addMenu}><Plus size={14}/>Add menu item</button></div>
      {config.menuItems.map((item,index) => <div key={item.id} className="grid gap-2 rounded-xl border border-neutral-200 p-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-center">
        <input className={input} aria-label="Menu label" value={item.label} onChange={e => update({ menuItems: config.menuItems.map(x => x.id === item.id ? {...x,label:e.target.value} : x) })}/>
        <select className={input} aria-label="Menu capability" value={item.capabilityId} onChange={e => { const target=capabilities.find(x=>x.capabilityId===e.target.value); update({menuItems:config.menuItems.map(x=>x.id===item.id?{...x,capabilityId:e.target.value,iconName:target?.iconName||x.iconName,category:target?.category||x.category}:x)}); }}>{capabilities.map(x=><option key={x.capabilityId} value={x.capabilityId}>{x.label}</option>)}</select>
        <input className={input} aria-label="Display order" type="number" min="0" value={item.displayOrder} onChange={e => update({menuItems:config.menuItems.map(x=>x.id===item.id?{...x,displayOrder:Number(e.target.value)}:x)})}/>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.enabled} onChange={e=>update({menuItems:config.menuItems.map(x=>x.id===item.id?{...x,enabled:e.target.checked}:x)})}/>Visible</label>
        <button type="button" aria-label="Remove menu item" onClick={()=>update({menuItems:config.menuItems.filter(x=>x.id!==item.id)})} className="p-2 text-rose-600"><Trash2 size={15}/></button>
        <p className="text-[10px] text-neutral-400 md:col-span-5">Position {index+1} · {item.category} · {item.capabilityId}</p>
      </div>)}
      {config.menuItems.length===0 && <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">No custom menu entries. The default capability menu remains active.</p>}
    </section>}

    {tab === 'buttons' && <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Action button designer</h2><p className="text-xs text-neutral-500">Bind buttons to registered navigation, questionnaire or workflow actions.</p></div><button type="button" className={button} onClick={addButton}><Plus size={14}/>Add button</button></div>
      {config.buttons.map(item => <div key={item.id} className="grid gap-2 rounded-xl border border-neutral-200 p-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-center">
        <input className={input} aria-label="Button label" value={item.label} onChange={e=>update({buttons:config.buttons.map(x=>x.id===item.id?{...x,label:e.target.value}:x)})}/>
        <select className={input} aria-label="Action type" value={item.action.type} onChange={e=>{const type=e.target.value as CustomActionButton['action']['type']; const target=type==='NAVIGATE_CAPABILITY'?capabilities[0]?.capabilityId||'':type==='OPEN_QUESTIONNAIRE'?config.questionnaires[0]?.id||'':config.workflows[0]?.id||'';update({buttons:config.buttons.map(x=>x.id===item.id?{...x,action:{type,targetId:target}}:x)});}}>
          <option value="NAVIGATE_CAPABILITY">Open capability</option><option value="OPEN_QUESTIONNAIRE">Open questionnaire</option><option value="START_WORKFLOW">Start workflow</option>
        </select>
        <select className={input} aria-label="Action target" value={item.action.targetId} onChange={e=>update({buttons:config.buttons.map(x=>x.id===item.id?{...x,action:{...x.action,targetId:e.target.value}}:x)})}>
          {item.action.type==='NAVIGATE_CAPABILITY'?capabilities.map(x=><option key={x.capabilityId} value={x.capabilityId}>{x.label}</option>):item.action.type==='OPEN_QUESTIONNAIRE'?config.questionnaires.map(x=><option key={x.id} value={x.id}>{x.title}</option>):config.workflows.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.enabled} onChange={e=>update({buttons:config.buttons.map(x=>x.id===item.id?{...x,enabled:e.target.checked}:x)})}/>Enabled</label>
        <button type="button" aria-label="Remove button" onClick={()=>update({buttons:config.buttons.filter(x=>x.id!==item.id)})} className="p-2 text-rose-600"><Trash2 size={15}/></button>
        <p className="text-[10px] text-neutral-400 md:col-span-5">Action: {item.action.type} → {item.action.targetId || 'Choose a target'}</p>
      </div>)}
    </section>}

    {tab === 'forms' && <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Questionnaire builder</h2><p className="text-xs text-neutral-500">Design the structured forms that capture records for an enabled capability.</p></div><button type="button" className={button} onClick={addForm}><Plus size={14}/>Add questionnaire</button></div>
      {config.questionnaires.map(form=><div key={form.id} className="space-y-3 rounded-xl border border-neutral-200 p-4">
        <div className="grid gap-2 md:grid-cols-2"><input className={input} value={form.title} aria-label="Questionnaire title" onChange={e=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,title:e.target.value}:x)})}/><select className={input} value={form.targetCapabilityId} onChange={e=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,targetCapabilityId:e.target.value}:x)})}>{capabilities.map(x=><option key={x.capabilityId} value={x.capabilityId}>{x.label}</option>)}</select></div>
        <textarea className={input} rows={2} placeholder="What information does this questionnaire collect?" value={form.description||''} onChange={e=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,description:e.target.value}:x)})}/>
        <input className={input} aria-label="Submit button label" value={form.submitLabel} onChange={e=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,submitLabel:e.target.value}:x)})}/>
        {form.fields.map(field=><div key={field.id} className="grid gap-2 rounded-lg bg-neutral-50 p-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-center">
          <input className={input} aria-label="Question label" value={field.label} onChange={e=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,fields:x.fields.map(y=>y.id===field.id?{...y,label:e.target.value,key:e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}:y)}:x)})}/>
          <select className={input} value={field.type} onChange={e=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,fields:x.fields.map(y=>y.id===field.id?{...y,type:e.target.value as CustomQuestionnaireField['type'],options:['SELECT','MULTI_SELECT'].includes(e.target.value)?[{label:'Option 1',value:'option_1'}]:undefined}:y)}:x)})}>
            {['TEXT','TEXTAREA','NUMBER','DATE','SELECT','MULTI_SELECT','CHECKBOX'].map(type=><option key={type} value={type}>{type.replace('_',' ')}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={field.required} onChange={e=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,fields:x.fields.map(y=>y.id===field.id?{...y,required:e.target.checked}:y)}:x)})}/>Required</label>
          <button type="button" aria-label="Remove question" onClick={()=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,fields:x.fields.filter(y=>y.id!==field.id)}:x)})} className="p-2 text-rose-600"><Trash2 size={15}/></button>
          {['SELECT','MULTI_SELECT'].includes(field.type) && <input className={input+' md:col-span-2'} placeholder="Option labels, comma separated" value={(field.options||[]).map(x=>x.label).join(', ')} onChange={e=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,fields:x.fields.map(y=>y.id===field.id?{...y,options:e.target.value.split(',').map(v=>v.trim()).filter(Boolean).map(v=>({label:v,value:v.toLowerCase().replace(/[^a-z0-9]+/g,'_')}))}:y)}:x)})}/>}
        </div>)}
        <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>update({questionnaires:config.questionnaires.map(x=>x.id===form.id?{...x,fields:[...x.fields,{id:crypto.randomUUID(),key:`field_${x.fields.length+1}`,label:'New question',type:'TEXT',required:false}]}:x)})}><Plus size={14}/>Add question</button><button type="button" className="text-xs font-bold text-rose-600" onClick={()=>update({questionnaires:config.questionnaires.filter(x=>x.id!==form.id)})}>Delete questionnaire</button></div>
      </div>)}
    </section>}

    {tab === 'workflows' && <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Structured workflow builder</h2><p className="text-xs text-neutral-500">Define the ordered steps, responsible role and questionnaire at each stage.</p></div><button type="button" className={button} onClick={addWorkflow}><Plus size={14}/>Add workflow</button></div>
      {config.workflows.map(flow=><div key={flow.id} className="space-y-3 rounded-xl border border-neutral-200 p-4">
        <input className={input} value={flow.name} onChange={e=>update({workflows:config.workflows.map(x=>x.id===flow.id?{...x,name:e.target.value}:x)})}/>
        <textarea className={input} rows={2} placeholder="Workflow purpose" value={flow.description||''} onChange={e=>update({workflows:config.workflows.map(x=>x.id===flow.id?{...x,description:e.target.value}:x)})}/>
        {flow.steps.map((step,index)=><div key={step.id} className="grid gap-2 rounded-lg bg-neutral-50 p-3 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold">{index+1}</span>
          <input className={input} value={step.title} aria-label="Workflow step" onChange={e=>update({workflows:config.workflows.map(x=>x.id===flow.id?{...x,steps:x.steps.map(y=>y.id===step.id?{...y,title:e.target.value}:y)}:x)})}/>
          <input className={input} placeholder="Responsible role" value={step.assigneeRole||''} onChange={e=>update({workflows:config.workflows.map(x=>x.id===flow.id?{...x,steps:x.steps.map(y=>y.id===step.id?{...y,assigneeRole:e.target.value}:y)}:x)})}/>
          <select className={input} value={step.questionnaireId||''} onChange={e=>update({workflows:config.workflows.map(x=>x.id===flow.id?{...x,steps:x.steps.map(y=>y.id===step.id?{...y,questionnaireId:e.target.value||undefined}:y)}:x)})}><option value="">No questionnaire</option>{config.questionnaires.map(q=><option key={q.id} value={q.id}>{q.title}</option>)}</select>
          <button type="button" aria-label="Remove workflow step" onClick={()=>update({workflows:config.workflows.map(x=>x.id===flow.id?{...x,steps:x.steps.filter(y=>y.id!==step.id)}:x)})} className="p-2 text-rose-600"><Trash2 size={15}/></button>
        </div>)}
        <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>update({workflows:config.workflows.map(x=>x.id===flow.id?{...x,steps:[...x.steps,{id:crypto.randomUUID(),title:'New step'}]}:x)})}><Plus size={14}/>Add step</button><button type="button" className="text-xs font-bold text-rose-600" onClick={()=>update({workflows:config.workflows.filter(x=>x.id!==flow.id)})}>Delete workflow</button></div>
      </div>)}
    </section>}

    {tab === 'preview' && <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div><h2 className="font-bold">Workspace preview</h2><p className="text-xs text-neutral-500">Review the configured navigation and available actions before saving.</p></div>
      <div className="flex flex-wrap gap-2">{experience.navigation.map(item=><span key={item.id} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs">{item.label}</span>)}{config.menuItems.filter(x=>x.enabled).map(item=><span key={item.id} className="rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs">{item.label}</span>)}</div>
      <div className="grid gap-3 sm:grid-cols-2">{config.buttons.filter(x=>x.enabled).map(item=><div key={item.id} className="rounded-xl border border-neutral-200 p-3"><span className={`inline-flex rounded-lg px-3 py-2 text-xs font-bold ${item.variant==='PRIMARY'?'bg-neutral-950 text-white':'bg-neutral-100 text-neutral-800'}`}>{item.label}</span><p className="mt-2 text-[10px] text-neutral-500">{item.action.type} · {item.action.targetId}</p></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-2">{config.questionnaires.map(form=><div key={form.id} className="rounded-xl border border-neutral-200 p-3"><p className="font-semibold text-sm">{form.title}</p><p className="mt-1 text-xs text-neutral-500">{form.fields.length} questions · saves to {form.targetCapabilityId}</p></div>)}</div>
      <div className="space-y-2">{config.workflows.map(flow=><div key={flow.id} className="rounded-xl border border-neutral-200 p-3"><p className="font-semibold text-sm">{flow.name}</p><p className="mt-1 text-xs text-neutral-500">{flow.steps.length} ordered steps</p><div className="mt-2 flex flex-wrap gap-1">{flow.steps.map((step,index)=><span key={step.id} className="rounded bg-neutral-100 px-2 py-1 text-[10px]">{index+1}. {step.title}</span>)}</div></div>)}</div>
    </section>}
    <footer className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-neutral-500">Draft changes are local until saved. Saving creates a new tenant-scoped configuration version.</div><button type="button" onClick={save} disabled={loading||saving} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black text-white disabled:opacity-50"><Save size={14}/>{saving?'Saving…':'Save configuration'}</button></footer>
  </div>;
};
