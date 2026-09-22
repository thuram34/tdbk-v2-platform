import React from 'react';
import { ArrowRight, BriefcaseBusiness, Building2, MapPin, Package, Sparkles, Wrench } from 'lucide-react';

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

function CardFrame({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="w-full rounded-[22px] border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:border-neutral-400 hover:shadow-md">{children}</Tag>;
}

export function ProductCard({ item, onSelect }: { item: ProductCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Package className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.name}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{item.category}</p></CardFrame>;
}

export function ServiceCard({ item, onSelect }: { item: ServiceCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Wrench className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.name}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{item.category}</p></CardFrame>;
}

export function ProviderCard({ item, onSelect }: { item: ProviderCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-950 text-white"><Wrench className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.displayName}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><div className="mt-3 flex flex-wrap gap-1.5">{item.services.slice(0, 4).map((service) => <span key={service} className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">{service}</span>)}</div>{item.locationLabel && <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500"><MapPin className="h-3.5 w-3.5" />{item.locationLabel}</p>}</CardFrame>;
}

export function BusinessCard({ item, onSelect }: { item: BusinessCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Building2 className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.name}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{item.category}</p>{item.locationLabel && <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500"><MapPin className="h-3.5 w-3.5" />{item.locationLabel}</p>}</CardFrame>;
}

export function JobCard({ item, onSelect }: { item: JobCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><BriefcaseBusiness className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p>{item.locationLabel && <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500"><MapPin className="h-3.5 w-3.5" />{item.locationLabel}</p>}</CardFrame>;
}

export function OpportunityCard({ item, onSelect }: { item: OpportunityCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Sparkles className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p><p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">{item.category}</p></CardFrame>;
}

export function OfferCard({ item, onSelect }: { item: OfferCardData; onSelect?: () => void }) {
  return <CardFrame onClick={onSelect}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100"><Sparkles className="h-5 w-5" /></div><Badge stage={item.stage} /></div><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p>{item.merchantLabel && <p className="mt-3 text-xs font-semibold text-neutral-500">{item.merchantLabel}</p>}</CardFrame>;
}

export function SectionLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-bold text-neutral-500 hover:text-neutral-950">{label}<ArrowRight className="h-3.5 w-3.5" /></button>;
}
