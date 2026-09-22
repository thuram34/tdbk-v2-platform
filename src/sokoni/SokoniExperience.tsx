import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, ChevronDown, Clock3, Compass, MapPin, Search, Sparkles, UserRound, Wrench, X } from 'lucide-react';
import { demoSokoniDiscoveryAdapter, SokoniDiscoveryResult, SokoniLocationContext } from './SokoniDiscoveryAdapter';
import { BusinessCard, JobCard, OfferCard, OpportunityCard, ProductCard, ProviderCard, ServiceCard } from './SokoniPresentationCards';

type View = 'HOME' | 'SEARCH' | 'RESULTS' | 'PROVIDER' | 'ACTIVITY' | 'ACCOUNT';
const LOCATIONS = ['Mombasa', 'Nyali', 'Bamburi', 'Likoni'];
const CATEGORIES = [
  ['Services', 'Find people who can help'], ['Products', 'Find things around you'], ['Businesses', 'Discover local businesses'],
  ['Jobs', 'Find work opportunities'], ['Opportunities', 'Explore ways to act'], ['Offers', 'See local offers'],
];
const SUGGESTIONS = ['My printer isn\'t working.', 'I need CCTV installed.', 'I need a laptop.', 'I need a plumber.', 'I am looking for work.'];
const DEMO = 'DEMO / UX PROTOTYPE — NOT LIVE ENGINE STATE';

export function SokoniExperience({ onBack }: { onBack?: () => void }) {
  const [view, setView] = useState<View>('HOME');
  const [need, setNeed] = useState('');
  const [location, setLocation] = useState<SokoniLocationContext>({ label: 'Mombasa', consented: false });
  const [locationOpen, setLocationOpen] = useState(false);
  const [result, setResult] = useState<SokoniDiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const provider = useMemo(() => result?.providers[0] ?? null, [result]);

  const discover = async () => {
    if (!need.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const next = await demoSokoniDiscoveryAdapter.discover({ need: need.trim(), location });
      setResult({ ...next, intent: { ...next.intent, rawNeed: need.trim() }, location });
      setView('RESULTS');
    } catch { setError('We could not prepare this discovery preview. Try again.'); }
    finally { setLoading(false); }
  };

  const chooseNeed = (value: string) => { setNeed(value); setView('SEARCH'); };
  const selectLocation = (label: string) => { setLocation({ label, consented: true }); setLocationOpen(false); };
  const back = () => setView(view === 'PROVIDER' ? 'RESULTS' : view === 'RESULTS' ? 'SEARCH' : 'HOME');

  const DemoBanner = () => <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900"><span className="inline-flex items-center gap-1.5 font-black"><Sparkles className="h-3.5 w-3.5" />{DEMO}</span><span className="ml-2">Demo presentation is separated from authoritative Engine state.</span></div>;

  return <main className="min-h-screen bg-[#f7f7f3] text-neutral-950 selection:bg-neutral-950 selection:text-white">
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-[#f7f7f3]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {view !== 'HOME' && <button type="button" onClick={back} className="rounded-full p-2 text-neutral-600 hover:bg-white" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-950 text-sm font-black text-white">S</div>
          <div><div className="text-sm font-bold">Sokoni</div><div className="hidden text-[11px] text-neutral-500 sm:block">Find what you need around you</div></div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setView('ACCOUNT')} className="rounded-full p-2 text-neutral-500 hover:bg-white" aria-label="Account"><UserRound className="h-4 w-4" /></button>
          {onBack && <button type="button" onClick={onBack} className="hidden rounded-full px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-white sm:block">Exit Sokoni</button>}
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
      <DemoBanner />

      {view === 'HOME' && <section className="pt-8 sm:pt-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Discover · understand · act</p>
            <h1 className="max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">What do you need?</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg">Say it naturally. Sokoni is designed around the thing you are trying to accomplish—not around technical categories.</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Nearby discovery</p><p className="mt-2 text-lg font-bold">Start around {location.label}</p><p className="mt-1 text-sm text-neutral-500">Location is user-controlled and only presented here as a discovery preference.</p></div>
        </div>

        <div className="mt-8 rounded-[30px] border border-neutral-200 bg-white p-3 shadow-[0_24px_80px_rgba(0,0,0,.07)] sm:p-4">
          <button type="button" onClick={() => setView('SEARCH')} className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-left hover:border-neutral-400"><Search className="h-5 w-5 text-neutral-400" /><span className="text-base text-neutral-400">e.g. My printer isn't working</span></button>
          <div className="relative mt-3">
            <button type="button" onClick={() => setLocationOpen(v => !v)} className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-left hover:border-neutral-400"><span className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-neutral-500" />{location.label}<span className="text-xs font-normal text-neutral-400">discovery area</span></span><ChevronDown className="h-4 w-4 text-neutral-400" /></button>
            {locationOpen && <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-neutral-200 bg-white p-1 shadow-xl">{LOCATIONS.map(x => <button key={x} type="button" onClick={() => selectLocation(x)} className="w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-neutral-50">{x}</button>)}</div>}
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Explore</p><h2 className="mt-1 text-2xl font-black">What people come to Sokoni for</h2></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{CATEGORIES.map(([title, desc], i) => <button key={title} type="button" onClick={() => chooseNeed(title)} className="rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-400"><div className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100">{i < 3 ? <Compass className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</div><div className="text-sm font-bold">{title}</div><div className="mt-1 text-[11px] leading-4 text-neutral-500">{desc}</div></button>)}</div>

        <div className="mt-10 grid gap-4 md:grid-cols-2"><div className="rounded-3xl border border-neutral-200 bg-neutral-950 p-6 text-white"><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Need help?</p><h3 className="mt-2 text-2xl font-black">Tell us the problem, not the category.</h3><button type="button" onClick={() => chooseNeed('My printer isn\'t working.')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-neutral-950">Try the technician journey <ArrowRight className="h-4 w-4" /></button></div><div className="rounded-3xl border border-neutral-200 bg-white p-6"><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Opportunities & offers</p><h3 className="mt-2 text-2xl font-black">Work, local opportunities and useful offers.</h3><p className="mt-2 text-sm leading-6 text-neutral-500">These are presentation destinations now; authoritative opportunity and offer contracts remain Engine-owned.</p></div></div>
      </section>}

      {view === 'SEARCH' && <section className="mx-auto max-w-4xl pt-8 sm:pt-12">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">Natural-language discovery</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">What are you trying to do?</h1>
        <div className="mt-7 rounded-[28px] border border-neutral-200 bg-white p-3 shadow-sm"><div className="flex items-start gap-3 rounded-2xl bg-neutral-50 px-4 py-4"><Search className="mt-1 h-5 w-5 text-neutral-400" /><textarea autoFocus value={need} onChange={e => setNeed(e.target.value)} rows={3} placeholder="My printer isn't working." className="w-full resize-none bg-transparent text-base outline-none placeholder:text-neutral-400" /></div><div className="relative mt-3"><button type="button" onClick={() => setLocationOpen(v => !v)} className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-left"><span className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" />{location.label}</span><ChevronDown className="h-4 w-4" /></button>{locationOpen && <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border bg-white p-1 shadow-xl">{LOCATIONS.map(x => <button key={x} type="button" onClick={() => selectLocation(x)} className="w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-neutral-50">{x}</button>)}</div>}</div><button type="button" disabled={!need.trim() || loading} onClick={discover} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white disabled:opacity-40">{loading ? 'Understanding your need…' : 'Discover'}{!loading && <ArrowRight className="h-4 w-4" />}</button></div>
        <div className="mt-8"><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Try a phrase</p><div className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map(x => <button key={x} type="button" onClick={() => setNeed(x)} className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold hover:border-neutral-400">{x}</button>)}</div></div>
        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      </section>}

      {view === 'RESULTS' && result && <section className="pt-8 sm:pt-12"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">Need understood</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">{result.intent.interpretedNeed}</h1><p className="mt-3 text-sm text-neutral-600">“{result.intent.rawNeed}”</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white">{result.intent.category}</span><span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold"><MapPin className="mr-1 inline h-3.5 w-3.5" />{location.label}</span></div></div><div className="mt-10 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Discovery</p><h2 className="mt-1 text-2xl font-black">Relevant possibilities</h2></div><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-800">DEMO RESULTS</span></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{result.providers.map(p => <ProviderCard key={p.id} item={{ ...p, locationLabel: location.label }} onSelect={() => setView('PROVIDER')} />)}</div><div className="mt-10 rounded-3xl border border-dashed border-neutral-300 bg-white/60 p-6"><p className="text-sm font-bold">Other discovery types</p><p className="mt-1 text-sm text-neutral-500">Products, businesses, jobs, opportunities and offers share this presentation layer. Their authoritative projections are intentionally not assumed here.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><ServiceCard item={{ id:'demo-service', name:'Printer repair', summary:'A service presentation example.', category:'Services', stage:'DEMO' }} /><ProductCard item={{ id:'demo-product', name:'Laptop', summary:'A product presentation example.', category:'Products', stage:'DEMO' }} /><BusinessCard item={{ id:'demo-business', name:'Local business', summary:'A business presentation example.', category:'Businesses', locationLabel: location.label, stage:'DEMO' }} /><JobCard item={{ id:'demo-job', title:'Technician role', summary:'A job presentation example.', locationLabel: location.label, stage:'DEMO' }} /><OpportunityCard item={{ id:'demo-opportunity', title:'Local opportunity', summary:'An opportunity presentation example.', category:'Opportunities', stage:'DEMO' }} /><OfferCard item={{ id:'demo-offer', title:'Local offer', summary:'An offer presentation example.', merchantLabel:'Presentation only', stage:'DEMO' }} /></div></div></section>}

      {view === 'PROVIDER' && provider && <section className="mx-auto max-w-3xl pt-8 sm:pt-12"><div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-8"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-950 text-white"><Wrench className="h-7 w-7" /></div><div><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800">REFERENCE PREVIEW</span><h1 className="mt-2 text-2xl font-black">{provider.displayName}</h1><p className="mt-1 text-sm text-neutral-500">Computer & IT Support</p></div></div></div><div className="mt-7 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Experience boundary</p><p className="mt-2 text-sm leading-6 text-neutral-700">This is a UX reference provider. Identity, publication, coverage, availability, trust and commercial terms must come from approved Engine public-discovery contracts.</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{provider.services.map(s => <div key={s} className="rounded-2xl border border-neutral-200 p-4 text-sm font-semibold">{s}</div>)}</div><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-neutral-200 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-400"><MapPin className="h-3.5 w-3.5" />Discovery area</p><p className="mt-2 text-sm font-semibold">{location.label}</p><p className="mt-1 text-xs text-neutral-500">Not provider coverage truth.</p></div><div className="rounded-2xl border border-neutral-200 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-400"><Clock3 className="h-3.5 w-3.5" />Availability</p><p className="mt-2 text-sm font-semibold">Not connected</p><p className="mt-1 text-xs text-neutral-500">No live availability is claimed.</p></div></div><button type="button" onClick={() => setHandoffOpen(true)} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white">Request service <ArrowRight className="h-4 w-4" /></button></div></section>}

      {view === 'ACTIVITY' && <section className="mx-auto max-w-3xl pt-10"><h1 className="text-3xl font-black">Activity</h1><div className="mt-5 rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center"><Clock3 className="mx-auto h-7 w-7 text-neutral-400" /><p className="mt-3 font-bold">No authoritative activity connected</p><p className="mt-1 text-sm text-neutral-500">Requests, purchases, applications and service status will appear here only when backed by Engine contracts.</p></div></section>}
      {view === 'ACCOUNT' && <section className="mx-auto max-w-3xl pt-10"><h1 className="text-3xl font-black">Account</h1><div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6"><p className="text-sm font-bold">Discovery preferences</p><p className="mt-2 text-sm text-neutral-500">Your selected discovery area is currently local UX state only. Identity and account authority remain outside Sokoni.</p><div className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm font-semibold">{location.label}</div></div></section>}
    </div>

    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-xl sm:hidden"><div className="mx-auto grid max-w-lg grid-cols-4 px-2 py-2"><NavButton active={view === 'HOME'} label="Home" icon={<Compass className="h-4 w-4" />} onClick={() => setView('HOME')} /><NavButton active={view === 'SEARCH' || view === 'RESULTS'} label="Search" icon={<Search className="h-4 w-4" />} onClick={() => setView('SEARCH')} /><NavButton active={view === 'ACTIVITY'} label="Activity" icon={<Clock3 className="h-4 w-4" />} onClick={() => setView('ACTIVITY')} /><NavButton active={view === 'ACCOUNT'} label="Account" icon={<UserRound className="h-4 w-4" />} onClick={() => setView('ACCOUNT')} /></div></nav>

    {handoffOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-black"><ArrowRight className="h-4 w-4" />Engine handoff boundary</div><button type="button" onClick={() => setHandoffOpen(false)} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Close"><X className="h-4 w-4" /></button></div><p className="mt-4 text-sm leading-6 text-neutral-600">The Request Service action is ready for the approved Engine contract. No request record has been created by Sokoni.</p><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>DEMO / UX ONLY.</strong> Request, workflow, quote, approval, payment, receipt and completion remain Engine-owned.</div><button type="button" onClick={() => setHandoffOpen(false)} className="mt-5 w-full rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-bold text-white">Return to Sokoni</button></div></div>}
  </main>;
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold ${active ? 'text-neutral-950' : 'text-neutral-400'}`}>{icon}{label}</button>; }
