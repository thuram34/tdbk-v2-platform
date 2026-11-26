import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, ArrowLeft, Blocks, Bot, Box, CheckCircle2, ChevronRight,
  CircleAlert, Code2, Database, ExternalLink, FlaskConical, GitBranch,
  HardDrive, Layers3, LockKeyhole, MonitorCheck, RefreshCw, Rocket,
  ShieldCheck, Terminal, Workflow, XCircle,
} from 'lucide-react';
import { getLabStatus, type LabStatusResponse } from '../../client/labApi';

type LabSection = 'overview' | 'projects' | 'build' | 'browser' | 'security' | 'operations' | 'agents';

const sections: Array<{ id: LabSection; label: string; icon: React.ElementType; description: string }> = [
  { id: 'overview', label: 'Command centre', icon: Activity, description: 'Engineering health and active capabilities' },
  { id: 'projects', label: 'Project workspaces', icon: Blocks, description: 'Canonical products and repositories' },
  { id: 'build', label: 'Build & test', icon: Terminal, description: 'Reproducible verification workflow' },
  { id: 'browser', label: 'Browser laboratory', icon: MonitorCheck, description: 'Isolated Playwright worker' },
  { id: 'security', label: 'Security laboratory', icon: ShieldCheck, description: 'Authority, isolation and release controls' },
  { id: 'operations', label: 'Operations', icon: HardDrive, description: 'Runtime, health and infrastructure' },
  { id: 'agents', label: 'AI engineering', icon: Bot, description: 'Governed engineering agents' },
];

const project = {
  id: 'tdbk-v2-platform',
  name: 'TDBK V2 Platform',
  repository: 'https://github.com/thuram34/tdbk-v2-platform',
  branch: 'feat/tdbk-browser-lab-v1',
  state: 'ACTIVE',
  stack: ['React', 'TypeScript', 'Express', 'Firebase', 'Vitest', 'Playwright'],
};

function StatePill({ state }: { state: string }) {
  const good = ['ONLINE', 'SUCCESS', 'AVAILABLE', 'IMPLEMENTED', 'ACTIVE'].includes(state);
  const warning = ['NOT_CONFIGURED', 'PLANNED', 'UNREACHABLE'].includes(state);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${good ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : warning ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${good ? 'bg-emerald-400' : warning ? 'bg-amber-300' : 'bg-rose-400'}`} />
      {state.replaceAll('_', ' ')}
    </span>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between text-slate-400"><span className="text-xs">{label}</span><Icon className="h-4 w-4" /></div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

export function LabWorkbench({ idToken, onExit, onSignOut }: { idToken: string; onExit: () => void; onSignOut: () => Promise<void> }) {
  const [section, setSection] = useState<LabSection>('overview');
  const [status, setStatus] = useState<LabStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!idToken) return;
    setRefreshing(true);
    setError(null);
    try {
      setStatus(await getLabStatus(idToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retrieve LAB status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const worker = status?.browserWorker.status || 'NOT_CONFIGURED';
  const health = status?.platform.health;
  const healthLabel = typeof health === 'object' && health !== null && 'status' in health
    ? String((health as { status: unknown }).status)
    : status ? 'REPORTED' : 'UNKNOWN';

  const capabilityCards = [
    { key: 'projectRegistry', label: 'Project registry', icon: Blocks, description: 'Canonical project inventory and verification commands' },
    { key: 'browserAutomation', label: 'Browser automation', icon: MonitorCheck, description: 'Isolated Chromium worker with approved browser tasks' },
    { key: 'buildAndTestOrchestration', label: 'Build & test jobs', icon: FlaskConical, description: 'Queued, isolated build and test execution' },
    { key: 'durableJobHistory', label: 'Job history', icon: Database, description: 'Persistent job records, logs and evidence' },
    { key: 'artifactStore', label: 'Artifact store', icon: HardDrive, description: 'Versioned test reports, screenshots and build outputs' },
    { key: 'releaseOperations', label: 'Release operations', icon: Rocket, description: 'Approval-gated deployment, verification and rollback' },
  ];

  return (
    <div className="min-h-screen bg-[#080D18] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-[#0B1220] lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300"><FlaskConical className="h-5 w-5" /></div>
          <div><p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">TDBK</p><p className="text-sm font-bold text-white">LAB <span className="text-slate-500">/ 01</span></p></div>
        </div>
        <div className="px-4 py-5">
          <p className="px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Engineering environment</p>
          <nav className="mt-3 space-y-1">
            {sections.map(item => {
              const Icon = item.icon;
              const active = section === item.id;
              return <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition ${active ? 'border border-cyan-300/20 bg-cyan-300/10 text-cyan-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon className="h-4 w-4" />{item.label}{active && <ChevronRight className="ml-auto h-3.5 w-3.5" />}</button>;
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-300"><LockKeyhole className="h-3.5 w-3.5" /> Master authority verified</div><p className="mt-1 text-[10px] text-slate-500">Protected engineering workspace</p></div>
          <button type="button" onClick={onExit} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-4 w-4" /> Return to TDBK</button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-white/10 bg-[#080D18]/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300 lg:hidden"><FlaskConical className="h-4 w-4" /></div>
            <div><p className="text-xs font-bold text-white">{sections.find(item => item.id === section)?.label}</p><p className="hidden text-[10px] text-slate-500 sm:block">Sovereign engineering environment · local-first</p></div>
          </div>
          <div className="flex items-center gap-2">
            <StatePill state={loading ? 'CHECKING' : error ? 'DEGRADED' : 'MASTER VERIFIED'} />
            <button type="button" onClick={() => void refresh()} disabled={refreshing || loading} aria-label="Refresh LAB status" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={() => void onSignOut()} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:bg-white/5">Sign out</button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">TDBK / Engineering</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Build everything here.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">One protected environment to engineer, verify and operate every TDBK product. No paid development-platform dependency.</p></div>
            <div className="text-left sm:text-right"><p className="text-[10px] uppercase tracking-wider text-slate-600">Last verified</p><p className="mt-1 text-xs font-medium text-slate-300">{status?.checkedAt ? new Date(status.checkedAt).toLocaleString() : 'Not yet checked'}</p></div>
          </div>

          {error && <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">LAB status unavailable</p><p className="mt-1 text-xs text-rose-200/70">{error}</p></div></div>}

          {section === 'overview' && <>
            <div className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.12] via-[#101D31] to-[#101827] p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div className="max-w-xl"><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> LAB foundation online</div><h2 className="mt-4 text-2xl font-semibold text-white">The engineering control room.</h2><p className="mt-2 text-sm leading-6 text-slate-400">Projects share a governed control plane. Execution workers stay isolated. Production changes remain approval-gated.</p></div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:min-w-52"><p className="text-[10px] uppercase tracking-wider text-slate-500">Browser worker</p><div className="mt-2 flex items-center gap-2"><span className="text-xl font-semibold text-white">{worker === 'ONLINE' ? 'Online' : worker === 'UNREACHABLE' ? 'Offline' : 'Not linked'}</span><StatePill state={worker} /></div><p className="mt-2 text-[10px] text-slate-500">Private worker health probe</p></div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Registered projects" value="01" detail="TDBK V2 registered" icon={Blocks} />
              <Metric label="Browser worker" value={worker === 'ONLINE' ? 'Online' : '—'} detail={worker === 'ONLINE' ? 'Health endpoint responding' : 'Requires private worker configuration'} icon={MonitorCheck} />
              <Metric label="Runtime" value={status?.platform.nodeVersion || '—'} detail={status?.platform.environment || 'Environment unknown'} icon={Code2} />
              <Metric label="Platform health" value={healthLabel} detail="Server health snapshot" icon={Activity} />
            </div>
            <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-base font-semibold text-white">LAB capability map</h2><p className="mt-1 text-xs text-slate-500">Current implementation state, not aspirational status</p></div><span className="text-[10px] text-slate-500">M0 foundation</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{capabilityCards.map(item => { const Icon = item.icon; const state = status?.capabilities[item.key] || 'PLANNED'; return <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="flex items-start justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-cyan-200"><Icon className="h-4 w-4" /></div><StatePill state={state} /></div><h3 className="mt-4 text-sm font-semibold text-white">{item.label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p></div>; })}</div></section>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-2 text-sm font-semibold text-white"><GitBranch className="h-4 w-4 text-cyan-300" /> Current canonical project</div><div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-white">{project.name}</p><p className="mt-1 text-xs text-slate-500">{project.repository}</p></div><a href="https://github.com/thuram34/tdbk-v2-platform/pull/661" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-white">Open implementation PR <ExternalLink className="h-3.5 w-3.5" /></a></div></section>
          </>}

          {section === 'projects' && <section><div className="mb-5"><h2 className="text-xl font-semibold text-white">Project workspaces</h2><p className="mt-1 text-sm text-slate-500">A project enters the registry only after its canonical repository and owner are verified.</p></div><div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex items-center gap-2"><Blocks className="h-4 w-4 text-cyan-300" /><h3 className="font-semibold text-white">{project.name}</h3><StatePill state="ACTIVE" /></div><p className="mt-2 text-xs text-slate-400">{project.repository}</p><p className="mt-2 text-xs text-slate-500">Branch: {project.branch}</p><div className="mt-4 flex flex-wrap gap-2">{project.stack.map(item => <span key={item} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">{item}</span>)}</div></div><a href={project.repository} target="_blank" rel="noreferrer" className="inline-flex h-fit items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5">Repository <ExternalLink className="h-3.5 w-3.5" /></a></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-dashed border-white/15 p-4"><p className="text-sm font-semibold text-white">Pride Industries</p><p className="mt-1 text-xs text-slate-500">Awaiting canonical repository verification before registration.</p></div><div className="rounded-xl border border-dashed border-white/15 p-4"><p className="text-sm font-semibold text-white">Chemist Pro / Drip District / TUMOS</p><p className="mt-1 text-xs text-slate-500">Onboarding queue — avoid duplicate or guessed repository entries.</p></div></div></section>}

          {section === 'build' && <section><h2 className="text-xl font-semibold text-white">Build & test laboratory</h2><p className="mt-1 text-sm text-slate-500">Reproduce the canonical TDBK checks locally without purchasing a hosted development environment.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{[['Install dependencies','npm ci'],['TypeScript validation','npm run typecheck'],['Lint','npm run lint'],['Unit and integration tests','npm test'],['Production frontend + server build','npm run build']].map(([label,command]) => <div key={command} className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs font-semibold text-slate-300">{label}</p><code className="mt-2 block overflow-x-auto rounded-lg bg-black/30 px-3 py-2 text-xs text-cyan-200">{command}</code></div>)}</div><div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Verified CI on current foundation revision</div><p className="mt-1 text-xs leading-5 text-slate-400">LAB Core registry validation, Browser Lab worker tests and the full TDBK V2 CI plus Experience Studio validation passed for the previous foundation revision. This workbench commit will trigger fresh validation.</p><a href="https://github.com/thuram34/tdbk-v2-platform/actions" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyan-200">View repository Actions <ExternalLink className="h-3.5 w-3.5" /></a></div></section>}

          {section === 'browser' && <section><h2 className="text-xl font-semibold text-white">Browser laboratory</h2><p className="mt-1 text-sm text-slate-500">Playwright worker for isolated inspection and approved web QA.</p><div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><MonitorCheck className="h-5 w-5 text-cyan-300" /><div><p className="text-sm font-semibold text-white">TDBK Browser Automation v1.0</p><p className="text-xs text-slate-500">Private worker · bounded browser jobs · screenshot evidence</p></div></div><StatePill state={worker} /></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Active jobs" value={String(status?.browserWorker.details.activeJobs ?? '—')} detail="Worker-reported count" icon={Workflow} /><Metric label="Browser" value={status?.browserWorker.details.browser || '—'} detail="Lazy Chromium runtime" icon={MonitorCheck} /><Metric label="Host allowlist" value={status?.browserWorker.details.allowlistConfigured ? 'Ready' : 'Missing'} detail="Exact host allowlist required" icon={ShieldCheck} /></div>{worker !== 'ONLINE' && <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-xs leading-5 text-amber-100">Worker is not reachable from the TDBK server. Configure TDBK_BROWSER_LAB_URL and TDBK_BROWSER_LAB_TOKEN on the private server, and keep the worker on a private network. Do not expose the worker publicly.</div>}</div></section>}

          {section === 'security' && <section><h2 className="text-xl font-semibold text-white">Security laboratory</h2><p className="mt-1 text-sm text-slate-500">Platform-wide security boundaries for every engineering workspace.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{[['Master authority','Workbench and status API require TDBK_MASTER_ADMIN.'],['Project isolation','Workers receive project-scoped jobs, not unrestricted host access.'],['Environment separation','Synthetic test data by default; production credentials never enter test jobs.'],['Approval gates','Production deploys, migrations, destructive and financial actions require approval.'],['Network egress','Private/metadata IP ranges must be blocked at the network boundary.'],['Audit evidence','Actor, project, job, approval, timestamps and evidence must be recorded.']].map(([title,description]) => <div key={title} className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-cyan-300" />{title}</div><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p></div>)}</div></section>}

          {section === 'operations' && <section><h2 className="text-xl font-semibold text-white">Operations centre</h2><p className="mt-1 text-sm text-slate-500">Runtime status visible to the TDBK Master Administrator.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Environment" value={status?.platform.environment || '—'} detail="Server process environment" icon={Activity} /><Metric label="Node runtime" value={status?.platform.nodeVersion || '—'} detail="Backend runtime version" icon={Code2} /><Metric label="Browser worker" value={worker} detail="Private health endpoint" icon={MonitorCheck} /><Metric label="Application health" value={healthLabel} detail="Kernel health snapshot" icon={CheckCircle2} /></div><div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs font-semibold text-white">Self-hosted operations roadmap</p><ul className="mt-3 space-y-2 text-xs text-slate-400"><li>• Persistent job queue and worker heartbeat</li><li>• Artifact storage with retention and integrity checks</li><li>• Backup and restore drills</li><li>• OpenTelemetry traces, Prometheus metrics and Grafana dashboards</li><li>• Release health checks and rollback adapters</li></ul></div></section>}

          {section === 'agents' && <section><h2 className="text-xl font-semibold text-white">AI engineering</h2><p className="mt-1 text-sm text-slate-500">The existing TDBK Agent Runtime remains the sole orchestration and authority engine.</p><div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5"><div className="flex items-center gap-3"><Bot className="h-6 w-6 text-cyan-300" /><div><p className="font-semibold text-white">Governed engineering agent team</p><p className="text-xs text-slate-500">Plan → propose code → run checks → review → approve → release</p></div></div><p className="mt-4 text-xs leading-6 text-slate-400">Local model inference (Ollama / llama.cpp) will be an optional provider. The LAB core must remain usable without a paid model API. Agents may inspect and propose changes; production mutations remain subject to explicit policy and human approval.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300">Engineering</span><span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300">QA</span><span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300">Security</span><span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300">Release reviewer</span></div></div></section>}
        </main>
        <footer className="border-t border-white/10 px-4 py-5 text-center text-[10px] text-slate-600 sm:px-7">TDBK LAB · Sovereign Engineering Environment · Local-first by design</footer>
      </div>
    </div>
  );
}
