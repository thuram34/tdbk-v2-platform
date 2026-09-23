import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, MapPin, Plus, ShieldCheck, Store, Trash2, X } from 'lucide-react';

export type SokoniPresenceAmount = 100 | 500;
export type SokoniPaymentBoundaryState = 'PAYMENT_REQUIRED' | 'PAYMENT_INTEGRATION_REQUIRED';

export interface SokoniBusinessCatalogueDraft {
  name: string;
  kind: 'PRODUCT' | 'SERVICE';
  description: string;
  photoPreview?: string;
}

/**
 * UX-only registration draft.
 *
 * This is intentionally not a persisted business master and does not create a
 * DBK, Engine tenant, entitlement, payment transaction, or publication record.
 * The field shape is deliberately portable so an approved future authority can
 * adopt the supplied business information without forcing re-entry.
 */
export interface SokoniBusinessRegistrationDraft {
  businessName: string;
  category: string;
  description: string;
  area: string;
  publicPhone: string;
  publicContact: string;
  photos: string[];
  catalogue: SokoniBusinessCatalogueDraft[];
  presenceAmount: SokoniPresenceAmount | null;
  tdbkAdoptionStatus: 'NOT_ENROLLED';
}

const CATEGORIES = ['Retail', 'Services', 'Food & Hospitality', 'Beauty & Wellness', 'Education', 'Health', 'Hardware & Commerce', 'Professional Services', 'Other'];
const AREAS = ['Mombasa', 'Nyali', 'Bamburi', 'Likoni'];
const PRESENCE_OPTIONS: Array<{ amount: SokoniPresenceAmount; label: string }> = [
  { amount: 100, label: 'KSh 100' },
  { amount: 500, label: 'KSh 500' },
];

interface Props {
  onExit: () => void;
}

export function SokoniBusinessRegistration({ onExit }: Props) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<SokoniBusinessRegistrationDraft>({
    businessName: '',
    category: '',
    description: '',
    area: 'Mombasa',
    publicPhone: '',
    publicContact: '',
    photos: [],
    catalogue: [],
    presenceAmount: null,
    tdbkAdoptionStatus: 'NOT_ENROLLED',
  });
  const [catalogueName, setCatalogueName] = useState('');
  const [catalogueKind, setCatalogueKind] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [catalogueDescription, setCatalogueDescription] = useState('');
  const [paymentState, setPaymentState] = useState<SokoniPaymentBoundaryState>('PAYMENT_REQUIRED');
  const [photoNotice, setPhotoNotice] = useState('');

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(draft.businessName.trim() && draft.category && draft.area);
    if (step === 2) return Boolean(draft.description.trim() && draft.publicPhone.trim());
    if (step === 3) return draft.catalogue.length > 0 || draft.photos.length > 0;
    return draft.presenceAmount !== null;
  }, [draft, step]);

  const addPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const previews = files.map(file => URL.createObjectURL(file));
    setDraft(current => ({ ...current, photos: [...current.photos, ...previews] }));
    setPhotoNotice('Photo preview added locally. No media has been uploaded or published.');
    event.target.value = '';
  };

  const addCatalogueItem = () => {
    if (!catalogueName.trim()) return;
    setDraft(current => ({
      ...current,
      catalogue: [...current.catalogue, {
        name: catalogueName.trim(),
        kind: catalogueKind,
        description: catalogueDescription.trim(),
      }],
    }));
    setCatalogueName('');
    setCatalogueDescription('');
  };

  const removePhoto = (index: number) => {
    setDraft(current => ({ ...current, photos: current.photos.filter((_, i) => i !== index) }));
  };

  const removeCatalogueItem = (index: number) => {
    setDraft(current => ({ ...current, catalogue: current.catalogue.filter((_, i) => i !== index) }));
  };

  const next = () => {
    if (step < 4 && canContinue) setStep(value => value + 1);
  };

  const back = () => {
    if (step === 1) onExit();
    else setStep(value => value - 1);
  };

  const requestPayment = () => {
    setPaymentState('PAYMENT_INTEGRATION_REQUIRED');
  };

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-[#f7f7f3]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={back} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-950 text-xs font-black text-white">S</div><span className="text-sm font-black">List your business on Sokoni</span></div>
          <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800 sm:block">SOKONI · NOT TDBK ENROLLMENT</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          <strong>Registration preview.</strong> This flow collects a portable Sokoni business draft. It does not create a TDBK business, DBK, payment transaction, entitlement, or publication record.
        </div>

        <section className="mt-5 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Business presence</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">{step === 1 ? 'Tell customers who you are' : step === 2 ? 'Make your public presence useful' : step === 3 ? 'Add photos & catalogue' : 'Choose your Sokoni presence'}</h1></div>
              <span className="text-xs font-black text-neutral-400">{step}/4</span>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-2">{['Business', 'Public', 'Catalogue', 'Presence'].map((label, index) => <div key={label}><div className={`h-1.5 rounded-full ${index + 1 <= step ? 'bg-neutral-950' : 'bg-neutral-200'}`} /><p className="mt-2 text-[10px] font-bold text-neutral-400">{label}</p></div>)}</div>

            {step === 1 && <div className="mt-8 space-y-4">
              <Field label="Business name"><input value={draft.businessName} onChange={e => setDraft({ ...draft, businessName: e.target.value })} placeholder="e.g. Coastline Computers" /></Field>
              <Field label="Category"><select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}><option value="">Choose a category</option>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></Field>
              <Field label="Discovery area"><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" /><select className="pl-9" value={draft.area} onChange={e => setDraft({ ...draft, area: e.target.value })}>{AREAS.map(area => <option key={area}>{area}</option>)}</select></div></Field>
            </div>}

            {step === 2 && <div className="mt-8 space-y-4">
              <Field label="Public description"><textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={5} placeholder="Tell customers what your business does and what you offer." /></Field>
              <Field label="Public phone"><input value={draft.publicPhone} onChange={e => setDraft({ ...draft, publicPhone: e.target.value })} placeholder="e.g. 07xx xxx xxx" /></Field>
              <Field label="Other public contact (optional)"><input value={draft.publicContact} onChange={e => setDraft({ ...draft, publicContact: e.target.value })} placeholder="WhatsApp, email, website or other public contact" /></Field>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600"><strong className="text-neutral-900">Public by design.</strong> Customers do not need a TDBK account, Sokoni business account or payment to discover a public business.</div>
            </div>}

            {step === 3 && <div className="mt-8 space-y-7">
              <div><div className="flex items-center justify-between"><div><p className="text-sm font-black">Business photos</p><p className="mt-1 text-xs text-neutral-500">Local previews only until Sokoni media storage is connected.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-neutral-950 px-3 py-2 text-xs font-bold text-white"><Camera className="h-4 w-4" /> Add photos<input type="file" accept="image/*" multiple className="hidden" onChange={addPhoto} /></label></div>{photoNotice && <p className="mt-3 text-xs text-amber-700">{photoNotice}</p>}{draft.photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{draft.photos.map((src, index) => <div key={`${src}-${index}`} className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100"><img src={src} alt="Business preview" className="aspect-square w-full object-cover" /><button type="button" onClick={() => removePhoto(index)} className="absolute right-2 top-2 rounded-full bg-white/90 p-2 shadow-sm" aria-label="Remove photo"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}</div>

              <div className="border-t border-neutral-100 pt-6"><p className="text-sm font-black">Catalogue items</p><p className="mt-1 text-xs text-neutral-500">Add products or services customers may discover. No prices or availability are assumed.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px]"><input value={catalogueName} onChange={e => setCatalogueName(e.target.value)} placeholder="Product or service name" /><select value={catalogueKind} onChange={e => setCatalogueKind(e.target.value as 'PRODUCT' | 'SERVICE')}><option value="PRODUCT">Product</option><option value="SERVICE">Service</option></select></div><textarea value={catalogueDescription} onChange={e => setCatalogueDescription(e.target.value)} rows={3} className="mt-3" placeholder="Short public description" /><button type="button" onClick={addCatalogueItem} disabled={!catalogueName.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold disabled:opacity-40"><Plus className="h-4 w-4" /> Add to catalogue</button>{draft.catalogue.length > 0 && <div className="mt-4 space-y-2">{draft.catalogue.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 rounded-2xl border border-neutral-200 p-4"><div><span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-black">{item.kind}</span><p className="mt-2 text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-neutral-500">{item.description || 'No description supplied.'}</p></div><button type="button" onClick={() => removeCatalogueItem(index)} className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Remove catalogue item"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</div>
            </div>}

            {step === 4 && <div className="mt-8 space-y-5">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><p className="text-sm font-black">Sokoni paid presence</p><p className="mt-1 text-xs leading-5 text-neutral-500">Choose the applicable Sokoni presence amount. This is a Sokoni service fee—not TDBK enrollment, activation or entitlement.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">{PRESENCE_OPTIONS.map(option => <button key={option.amount} type="button" onClick={() => { setDraft({ ...draft, presenceAmount: option.amount }); setPaymentState('PAYMENT_REQUIRED'); }} className={`rounded-2xl border p-5 text-left ${draft.presenceAmount === option.amount ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}><span className="text-2xl font-black">{option.label}</span><p className={`mt-2 text-xs leading-5 ${draft.presenceAmount === option.amount ? 'text-neutral-300' : 'text-neutral-500'}`}>Sokoni business presence</p></button>)}</div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-neutral-500" /><div><p className="text-sm font-black">Payment boundary</p><p className="mt-1 text-xs leading-5 text-neutral-500">The current repository does not expose a Sokoni-specific payment contract. Existing TDBK subscription payment authority is intentionally not reused for this Sokoni fee.</p></div></div><div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-amber-800">{paymentState === 'PAYMENT_REQUIRED' ? 'Payment required' : 'Payment integration required'}</p><p className="mt-1 text-xs leading-5 text-amber-900">{paymentState === 'PAYMENT_REQUIRED' ? 'No payment has been initiated or confirmed.' : 'No transaction was created. A Sokoni payment authority must be connected before a payment can be initiated or a presence can be marked paid.'}</p></div><button type="button" disabled={!draft.presenceAmount} onClick={requestPayment} className="mt-4 w-full rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Continue to payment boundary</button></div>
            </div>}

            <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-5"><button type="button" onClick={back} className="rounded-xl px-3 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-50">{step === 1 ? 'Cancel' : 'Back'}</button>{step < 4 ? <button type="button" onClick={next} disabled={!canContinue} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Continue <ArrowRight className="h-4 w-4" /></button> : <button type="button" onClick={onExit} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-3 text-xs font-black hover:bg-neutral-50">Save draft preview & return <X className="h-4 w-4" /></button>}</div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-950 p-5 text-white"><Store className="h-5 w-5 text-neutral-400" /><p className="mt-4 text-xs font-black uppercase tracking-wide text-neutral-400">What you are building</p><h2 className="mt-2 text-xl font-black">A public Sokoni presence.</h2><p className="mt-2 text-sm leading-6 text-neutral-300">Discovery stays open to everyone. TDBK is a later progression, not a prerequisite.</p></div>
            <div className="rounded-3xl border border-neutral-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Future-ready fields</p><ul className="mt-3 space-y-2 text-xs text-neutral-600"><li>Business identity & category</li><li>Public description & contacts</li><li>Area/location context</li><li>Photos & catalogue</li><li>Sokoni presence selection</li><li>Explicit NOT_ENROLLED boundary</li></ul></div>
            <div className="rounded-3xl border border-neutral-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-wide text-neutral-400">Not created here</p><ul className="mt-3 space-y-2 text-xs text-neutral-600"><li>DBK / TDBK business</li><li>Payment transaction</li><li>Entitlement</li><li>Publication authority</li><li>Search index</li><li>Engine workflow</li></ul></div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-400">{label}</span>{React.cloneElement(children as React.ReactElement<{ className?: string }>, { className: `w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950 ${((children as React.ReactElement).props as { className?: string }).className || ''}` })}</label>;
}
