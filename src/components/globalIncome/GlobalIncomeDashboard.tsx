import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, Clock3, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import type { Opportunity } from '../../platform/globalIncome/types';
import type { ApplicationRecord } from '../../platform/globalIncome/applicationTypes';

interface Props { tenantId: string; idToken: string; onBack: () => void; }
type Approval = { approvalId: string; action: string; targetId: string; summary: string; termsOrCost: string | null; status: string; };

const api = async <T,>(path: string, token: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || `Request failed (${response.status})`);
  return body.data as T;
};

const emptyOpportunity = {
  title: '', employerOrClient: '', roleOrProject: '', sourceUrl: '', channel: 'remote_job_board',
  kind: 'EMPLOYMENT', geography: 'Remote / Global', descriptionSnapshot: '',
  compensationAmount: '', compensationCurrency: 'USD',
};

export const GlobalIncomeDashboard: React.FC<Props> = ({ tenantId, idToken, onBack }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [form, setForm] = useState(emptyOpportunity);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const qs = `tenantId=${encodeURIComponent(tenantId)}`;
      const [o, a, p] = await Promise.all([
        api<Opportunity[]>(`/api/global-income/opportunities?${qs}`, idToken),
        api<ApplicationRecord[]>(`/api/global-income/applications?${qs}`, idToken),
        api<Approval[]>(`/api/global-income/approvals?${qs}`, idToken),
      ]);
      setOpportunities(o); setApplications(a); setApprovals(p);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the income workspace.'); }
    finally { setBusy(false); }
  }, [tenantId, idToken]);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null); setNotice(null);
    try {
      const source = new URL(form.sourceUrl);
      if (!['https:', 'http:'].includes(source.protocol)) throw new Error('Only HTTP or HTTPS source links are accepted.');
      source.hash = '';
      for (const key of Array.from(source.searchParams.keys())) {
        if (/^(utm_.+|ref|referrer|source|campaign|tracking|fbclid|gclid)$/i.test(key)) source.searchParams.delete(key);
      }
      source.searchParams.sort();
      source.hostname = source.hostname.toLowerCase();
      source.pathname = source.pathname.replace(/\/+$/, '') || '/';
      const canonicalUrl = source.toString();
      const normalizeLabel = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
      const canonical = [normalizeLabel(form.employerOrClient), normalizeLabel(form.roleOrProject), canonicalUrl].join('\n');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
      const deduplicationKey = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      const now = new Date().toISOString();
      const item = {
        opportunityId: crypto.randomUUID(), ownerId: tenantId, kind: form.kind, channel: form.channel,
        stage: 'DISCOVERED', verificationStatus: 'UNVERIFIED',
        identity: { employerOrClient: form.employerOrClient, roleOrProject: form.roleOrProject, sourceUrl: canonicalUrl },
        deduplicationKey, title: form.title, descriptionSnapshot: form.descriptionSnapshot,
        geography: form.geography || null,
        compensationAmount: form.compensationAmount ? Number(form.compensationAmount) : null,
        compensationCurrency: form.compensationCurrency || null, compensationPeriod: 'UNSPECIFIED',
        applicationCostAmount: null, applicationCostCurrency: null, evidence: [], hardExclusionReasons: [],
        score: null, nextAction: 'Verify source and eligibility', discoveredAt: now, lastVerifiedAt: null,
        expiresAt: null, createdAt: now, updatedAt: now,
      } as Opportunity;
      await api<Opportunity>('/api/global-income/opportunities', idToken, {
        method: 'POST', body: JSON.stringify({ tenantId, opportunity: item }),
      });
      setForm(emptyOpportunity); setShowForm(false); setNotice('Opportunity saved to the acquisition pipeline.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save opportunity.'); }
    finally { setBusy(false); }
  };

  const decide = async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
    setBusy(true); setError(null);
    try {
      await api<Approval>(`/api/global-income/approvals/${approvalId}/decision`, idToken, {
        method: 'POST', body: JSON.stringify({ tenantId, decision }),
      });
      setNotice(`Approval ${decision.toLowerCase()}.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Approval decision failed.'); }
    finally { setBusy(false); }
  };

  const createApplicationDraft = async (item: Opportunity) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const requiresApproval = item.channel === 'upwork' || item.channel === 'direct_b2b' || (item.applicationCostAmount ?? 0) > 0;
      let approvalId: string | null = null;
      if (requiresApproval) {
        const action = item.channel === 'upwork' ? 'CONFIRM_UPWORK_PROPOSAL' : item.channel === 'direct_b2b' ? 'SEND_DIRECT_OUTREACH' : 'SUBMIT_PAID_APPLICATION';
        const termsOrCost = item.channel === 'direct_b2b' ? 'Review target, message and outreach terms before sending.' : window.prompt('Enter the exact application fee / Connects cost and terms. This will be shown in the approval request.');
        if (item.channel !== 'direct_b2b' && !termsOrCost?.trim()) return;
        const approval = await api<Approval>('/api/global-income/approvals', idToken, {
          method: 'POST',
          body: JSON.stringify({ tenantId, approval: {
            approvalId: crypto.randomUUID(), action, targetId: item.opportunityId,
            summary: `${action.replaceAll('_', ' ')} — ${item.title}`, termsOrCost,
          } }),
        });
        approvalId = approval.approvalId;
      }
      const application = await api<ApplicationRecord>('/api/global-income/applications', idToken, {
        method: 'POST',
        body: JSON.stringify({ tenantId, application: {
          applicationId: crypto.randomUUID(), opportunityId: item.opportunityId, channel: item.channel,
          kind: item.kind, status: 'READY', submittedAt: null, externalReference: null,
          evidenceUrls: [], notes: 'Draft prepared in TDBK. No external submission has been made.',
          requiresApproval, approvalId,
        } }),
      });
      setNotice(requiresApproval ? 'Application draft created. Its approval request is waiting in the queue.' : 'Application draft created. Submit it on the source platform, then record the submission here.');
      await load();
      return application;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create application draft.'); }
    finally { setBusy(false); }
  };

  const recordSubmission = async (applicationId: string) => {
    if (!window.confirm('Have you already submitted this application on the external platform? This only records the event in TDBK.')) return;
    setBusy(true); setError(null);
    try {
      await api<ApplicationRecord>(`/api/global-income/applications/${applicationId}/transition`, idToken, {
        method: 'POST', body: JSON.stringify({ tenantId, status: 'SUBMITTED' }),
      });
      setNotice('External submission recorded in the application ledger.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record submission.'); }
    finally { setBusy(false); }
  };

  const pending = approvals.filter((a) => a.status === 'PENDING').length;
  const active = opportunities.filter((o) => !['WON', 'LOST', 'WITHDRAWN', 'EXCLUDED'].includes(o.stage)).length;

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="rounded-xl border border-neutral-200 p-2 hover:bg-neutral-50" aria-label="Back to portfolio"><ArrowLeft className="h-4 w-4" /></button>
            <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">TDBK · CONTROL PLANE</p><h1 className="text-lg font-bold">Global Income Engine</h1></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh</button>
            <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-3 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4" /> Add opportunity</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <p className="max-w-3xl text-sm leading-6 text-neutral-600">One pipeline for verified work opportunities, applications, approval gates and evidence. This workspace is tenant-scoped; external applications are not submitted by creating a record here.</p>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {notice && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
        {showForm && <form onSubmit={create} className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><h2 className="font-bold">Capture an opportunity</h2><p className="mt-1 text-xs text-neutral-500">Add the source first. Verification and scoring happen before an application can progress.</p></div>
          <input required placeholder="Opportunity title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          <input required placeholder="Employer / client" value={form.employerOrClient} onChange={(e) => setForm({ ...form, employerOrClient: e.target.value })} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          <input required placeholder="Role / project" value={form.roleOrProject} onChange={(e) => setForm({ ...form, roleOrProject: e.target.value })} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          <input required type="url" placeholder="Source URL (https://…)" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"><option value="remote_job_board">Remote job board</option><option value="upwork">Upwork</option><option value="freelancer_com">Freelancer.com</option><option value="contra">Contra</option><option value="fiverr">Fiverr</option><option value="direct_b2b">Direct B2B</option><option value="referral">Referral</option></select>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"><option value="EMPLOYMENT">Employment</option><option value="FREELANCE">Freelance</option><option value="DIRECT_B2B">Direct B2B</option><option value="REFERRAL">Referral</option></select>
          <input placeholder="Geography" value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          <input type="number" min="0" placeholder="Compensation amount (optional)" value={form.compensationAmount} onChange={(e) => setForm({ ...form, compensationAmount: e.target.value })} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          <textarea placeholder="Description / evidence notes" value={form.descriptionSnapshot} onChange={(e) => setForm({ ...form, descriptionSnapshot: e.target.value })} className="min-h-20 rounded-xl border border-neutral-300 px-3 py-2 text-sm sm:col-span-2" />
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">Cancel</button><button disabled={busy} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save opportunity</button></div>
        </form>}
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {[[ 'Active opportunities', active, BriefcaseBusiness ], ['Applications tracked', applications.length, CheckCircle2], ['Approvals pending', pending, ShieldAlert ]] .map(([label, value, Icon]) => <div key={String(label)} className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-neutral-500"><span>{label}</span>{React.createElement(Icon as React.ElementType, { className: 'h-4 w-4' })}</div><p className="mt-3 text-3xl font-bold">{value as number}</p></div>)}
        </section>
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between"><div><h2 className="font-bold">Application ledger</h2><p className="mt-1 text-xs text-neutral-500">Drafts and verified external submissions; no revenue is booked here.</p></div><span className="text-xs text-neutral-500">{applications.length} records</span></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {applications.length === 0 ? <p className="text-sm text-neutral-500">No application records yet.</p> : applications.map((application) => <article key={application.applicationId} className="rounded-xl border border-neutral-200 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{opportunities.find((o) => o.opportunityId === application.opportunityId)?.title || application.opportunityId}</p><p className="mt-1 text-xs text-neutral-500">{application.channel.replaceAll('_',' ')}</p></div><span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold">{application.status}</span></div>{application.status === 'READY' && <button disabled={busy} onClick={() => void recordSubmission(application.applicationId)} className="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold disabled:opacity-50">Record external submission</button>}</article>)}
          </div>
        </section>
        <div className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between"><div><h2 className="font-bold">Acquisition pipeline</h2><p className="mt-1 text-xs text-neutral-500">Newest opportunities first</p></div><span className="text-xs text-neutral-500">{opportunities.length} records</span></div>
            <div className="mt-4 space-y-3">{opportunities.length === 0 ? <p className="rounded-xl bg-neutral-50 p-5 text-sm text-neutral-500">No opportunities yet. Capture one to begin.</p> : [...opportunities].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((item) => <article key={item.opportunityId} className="rounded-xl border border-neutral-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-neutral-500">{item.identity.employerOrClient} · {item.identity.roleOrProject}</p></div><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase">{item.stage}</span></div><div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500"><span>{item.channel.replaceAll('_',' ')}</span><span>{item.verificationStatus.replaceAll('_',' ')}</span>{item.score && <span className="font-bold text-neutral-800">Score {item.score.total}/100</span>}<a className="underline" href={item.identity.sourceUrl} target="_blank" rel="noreferrer">Open source</a></div><button disabled={busy} onClick={() => void createApplicationDraft(item)} className="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold disabled:opacity-50">Create application draft</button></article>)}</div>
          </section>
          <div className="space-y-6">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5"><h2 className="font-bold">Approval queue</h2><p className="mt-1 text-xs text-neutral-500">Human decisions required before gated actions.</p><div className="mt-4 space-y-3">{approvals.filter((a) => a.status === 'PENDING').length === 0 ? <p className="text-sm text-neutral-500">No pending approvals.</p> : approvals.filter((a) => a.status === 'PENDING').map((a) => <article key={a.approvalId} className="rounded-xl border border-neutral-200 p-3"><p className="text-sm font-semibold">{a.summary}</p><p className="mt-1 text-xs text-neutral-500">{a.action.replaceAll('_',' ')} · {a.termsOrCost || 'No cost details supplied'}</p><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void decide(a.approvalId,'APPROVED')} className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white">Approve</button><button disabled={busy} onClick={() => void decide(a.approvalId,'REJECTED')} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold">Reject</button></div></article>)}</div></section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-5"><h2 className="font-bold">Execution safeguards</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-neutral-600"><li className="flex gap-2"><ShieldAlert className="h-4 w-4 shrink-0" /> Paid applications and Upwork proposal confirmation require approval.</li><li className="flex gap-2"><ShieldAlert className="h-4 w-4 shrink-0" /> CRM writes, direct outreach, contracts and legal declarations remain gated.</li><li className="flex gap-2"><Clock3 className="h-4 w-4 shrink-0" /> External connector credentials must be configured on the deployed TDBK server.</li></ul></section>
          </div>
        </div>
      </main>
    </div>
  );
};
