import React, { useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Building2, MapPin, Package, Sparkles, Wrench, X } from 'lucide-react';

export interface ProductCardData { id: string; name: string; summary: string; category: string; stage?: 'DEMO' | 'AUTHORITATIVE_PENDING' | 'AUTHORITATIVE'; }
export interface ServiceCardData { id: string; name: string; summary: string; category: string; stage?: 'DEMO' | 'AUTHORITATIVE_PENDING' | 'AUTHORITATIVE'; }
export interface ProviderCardData { id: string; displayName: string; summary: string; services: string[]; locationLabel?: string; stage?: 'DEMO' | 'AUTHORITATIVE_PENDING' | 'AUTHORITATIVE'; }
export interface BusinessCardData { id: string; name: string; summary: string; category: string; locationLabel?: string; stage?: 'DEMO' | 'AUTHORITATIVE_PENDING' | 'AUTHORITATIVE'; }
export interface JobCardData { id: string; title: string; summary: string; locationLabel?: string; stage?: 'DEMO' | 'AUTHORITATIVE_PENDING' | 'AUTHORITATIVE'; }
export interface OpportunityCardData { id: string; title: string; summary: string; category: string; stage?: 'DEMO' | 'AUTHORITATIVE_PENDING' | 'AUTHORITATIVE'; }
export interface OfferCardData { id: string; title: string; summary: string; merchantLabel?: string; stage?: 'DEMO' | 'AUTHORITATIVE_PENDING' | 'AUTHORITATIVE'; }

const demoLabel = (stage?: string) => stage && stage !== 'AUTHORITATIVE' ? stage === 'DEMO' ? 'DEMO' : 'PENDING' : null;
const Badge = ({ stage }: { stage?: string }) => {
  const label = demoLabel(stage);
  if (!label) return null;
  return <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black tracking-wide text-amber-800">{label}</span>;
};

function CardFrame({ children, onClick, detail }: { children: React.ReactNode; onClick?: () => void; detail?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const interactive = Boolean(onClick || detail);
  const Tag = interactive ? 'button' : 'div';
  const handleClick = onClick ?? (() => setOpen(true));
  return <>
    <Tag type={interactive ? 'button' : undefined} onClick={handleClick} className="w-full rounded-[22px] border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:border-neutral-400 hover:shadow-md">{children}</Tag>
    {open && detail && <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Discovery detail" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-8" onClick={event => event.stopPropagation()}>
        <div className="flex justify-end"><button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Close detail"><X className="h-4 w-4" /></button></div>
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>DEMO / UX DETAIL.</strong> This presentation is not an authoritative Engine record.</div>
        {detail}
      </div>
    </div>}
  </>;
}

export function ProductCard({ item, onSelect }: { item: ProductCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect} detail={<><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Product</p><h2 className="mt-2 text-2xl font-black">{item.name}</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{item.summary}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">{item.category}</p><p className="mt-5 text-sm text-neutral-500">Price, stock, seller identity and purchase actions are not connected until approved Engine contracts exist.</p></>}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Package className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.name}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{item.category}</p></CardFrame>;
}

export function ServiceCard({ item, onSelect }: { item: ServiceCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect} detail={<><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Service</p><h2 className="mt-2 text-2xl font-black">{item.name}</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{item.summary}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">{item.category}</p><p className="mt-5 text-sm text-neutral-500">Provider identity, availability, coverage and commercial terms are not inferred by Sokoni.</p></>}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Wrench className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.name}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{item.category}</p></CardFrame>;
}

export function ProviderCard({ item, onSelect }: { item: ProviderCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-950 text-white"><Wrench className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.displayName}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><div className="mt-3 flex flex-wrap gap-1.5">{item.services.slice(0, 4).map(service => <span key={service} className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">{service}</span>)}</div>{item.locationLabel && <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500"><MapPin className="h-3.5 w-3.5" />{item.locationLabel}</p>}</CardFrame>;
}

export function BusinessCard({ item, onSelect }: { item: BusinessCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect} detail={<><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Business</p><h2 className="mt-2 text-2xl font-black">{item.name}</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{item.summary}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">{item.category}</p>{item.locationLabel && <p className="mt-3 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" />{item.locationLabel}</p>}<p className="mt-5 text-sm text-neutral-500">Public identity, publication state and DBK handoff are not assumed by this demo detail.</p></>}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Building2 className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.name}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{item.category}</p>{item.locationLabel && <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500"><MapPin className="h-3.5 w-3.5" />{item.locationLabel}</p>}</CardFrame>;
}

export function JobCard({ item, onSelect }: { item: JobCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect} detail={<><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Job</p><h2 className="mt-2 text-2xl font-black">{item.title}</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{item.summary}</p>{item.locationLabel && <p className="mt-4 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" />{item.locationLabel}</p>}<p className="mt-5 text-sm text-neutral-500">Application and opportunity status remain outside this presentation layer.</p></>}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><BriefcaseBusiness className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p>{item.locationLabel && <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500"><MapPin className="h-3.5 w-3.5" />{item.locationLabel}</p>}</CardFrame>;
}

export function OpportunityCard({ item, onSelect }: { item: OpportunityCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect} detail={<><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Opportunity</p><h2 className="mt-2 text-2xl font-black">{item.title}</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{item.summary}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">{item.category}</p><p className="mt-5 text-sm text-neutral-500">Availability, eligibility and action status require authoritative Engine contracts.</p></>}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Sparkles className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{item.category}</p></CardFrame>;
}

export function OfferCard({ item, onSelect }: { item: OfferCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect} detail={<><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Offer</p><h2 className="mt-2 text-2xl font-black">{item.title}</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{item.summary}</p>{item.merchantLabel && <p className="mt-4 text-sm font-semibold text-neutral-500">{item.merchantLabel}</p>}<p className="mt-5 text-sm text-neutral-500">Price, validity, eligibility and redemption remain authoritative Engine concerns.</p></>}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Sparkles className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p>{item.merchantLabel && <p className="mt-3 text-xs font-semibold text-neutral-500">{item.merchantLabel}</p>}</CardFrame>;
}

export function SectionLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-bold text-neutral-500 hover:text-neutral-950">{label}<ArrowRight className="h-3.5 w-3.5" /></button>;
}
