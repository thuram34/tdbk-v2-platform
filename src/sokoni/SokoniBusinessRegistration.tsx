import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, MapPin, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { SOKONI_COMMERCIAL_OFFERINGS } from './sokoniCommercialConfig';
import {
  EMPTY_SOKONI_ORIENTATION_CONTEXT,
  SOKONI_ORIENTATION_OPTIONS,
  SOKONI_SEEK_WORK_OPTIONS,
  SOKONI_SERVICE_OPTIONS,
  SOKONI_TRANSPORT_OPTIONS,
} from './sokoniParticipationConfig';
import type { SokoniOrientationCode, SokoniOrientationContext } from './sokoniParticipationConfig';
import { saveSokoniParticipant } from './persistence/sokoniParticipantPersistence';
import type { SokoniParticipantKind } from './persistence/sokoniParticipantPersistence';

const AREAS = ['Mombasa', 'Nyali', 'Bamburi', 'Likoni'];
const CATEGORIES = ['Retail', 'Services', 'Transport', 'Delivery', 'Technology', 'Home Services', 'Beauty & Wellness', 'Construction', 'Professional Services', 'Community', 'Other'];

type Step = 1 | 2 | 3 | 4;
type SaveState = 'IDLE' | 'SAVING' | 'SUCCESS' | 'ERROR';

interface PhotoDraft { file: File; preview: string; }
interface CatalogueDraft { name: string; kind: 'PRODUCT' | 'SERVICE'; description: string; photoIndexes: number[]; }
interface Props { onExit: () => void; }

function deriveParticipantKind(orientations: SokoniOrientationCode[], context: SokoniOrientationContext): SokoniParticipantKind {
  if (context.transportTypes.includes('Boda')) return 'BODA_OPERATOR';
  if (context.transportTypes.includes('Tuk-tuk')) return 'TUKTUK_OPERATOR';
  if (orientations.includes('OFFER_DELIVERY')) return 'DELIVERY_PROVIDER';
  if (orientations.includes('OFFER_TRANSPORT')) return 'TRANSPORT_PROVIDER';
  if (context.serviceTypes.some((item) => /technician/i.test(item))) return 'TECHNICIAN';
  if (orientations.includes('OFFER_SERVICE')) return 'SERVICE_PROVIDER';
  if (orientations.includes('SELL')) return 'SELLER';
  if (orientations.includes('BUY')) return 'BUYER';
  if (orientations.includes('JOIN_COMMUNITY') || orientations.includes('CREATE_COMMUNITY')) return 'COMMUNITY';
  if (orientations.includes('SEEK_WORK')) return 'INDIVIDUAL';
  return 'INDIVIDUAL';
}

function deriveCategory(orientations: SokoniOrientationCode[], context: SokoniOrientationContext): string {
  if (context.serviceTypes.length === 1) return context.serviceTypes[0];
  if (context.serviceTypes.length > 1) return 'Services';
  if (context.transportTypes.length) return context.transportTypes.join(' & ');
  if (context.opportunityTypes.length) return 'Work & Opportunities';
  if (orientations.includes('SELL')) return 'Seller';
  if (orientations.includes('BUY')) return 'Buyer';
  if (orientations.includes('JOIN_COMMUNITY') || orientations.includes('CREATE_COMMUNITY')) return 'Community';
  if (orientations.includes('OFFER_DELIVERY')) return 'Delivery';
  return 'Sokoni participant';
}

function ToggleChoice({ selected, label, description, onClick }: { selected: boolean; label: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-neutral-950 bg-neutral-950 text-white shadow-md' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}>
    <div className="flex items-start justify-between gap-3"><span className="text-sm font-black">{label}</span><span className={`mt-0.5 h-4 w-4 rounded-full border ${selected ? 'border-white bg-white' : 'border-neutral-300'}`}>{selected && <span className="mx-auto mt-1 block h-2 w-2 rounded-full bg-neutral-950" />}</span></div>
    <p className={`mt-2 text-xs leading-5 ${selected ? 'text-neutral-300' : 'text-neutral-500'}`}>{description}</p>
  </button>;
}

function MultiSelect({ values, options, onChange }: { values: string[]; options: readonly string[]; onChange: (next: string[]) => void }) {
  return <div className="mt-3 flex flex-wrap gap-2">{options.map((option) => {
    const selected = values.includes(option);
    return <button key={option} type="button" onClick={() => onChange(selected ? values.filter((item) => item !== option) : [...values, option])} className={`rounded-full border px-3 py-2 text-xs font-semibold ${selected ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}>{option}</button>;
  })}</div>;
}

export function SokoniBusinessRegistration({ onExit }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [orientations, setOrientations] = useState<SokoniOrientationCode[]>([]);
  const [orientationContext, setOrientationContext] = useState<SokoniOrientationContext>(EMPTY_SOKONI_ORIENTATION_CONTEXT);
  const [publicName, setPublicName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('Mombasa');
  const [publicPhone, setPublicPhone] = useState('');
  const [publicContact, setPublicContact] = useState('');
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueDraft[]>([]);
  const [catalogueName, setCatalogueName] = useState('');
  const [catalogueKind, setCatalogueKind] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [catalogueDescription, setCatalogueDescription] = useState('');
  const [cataloguePhotos, setCataloguePhotos] = useState<number[]>([]);
  const [offeringCode, setOfferingCode] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('IDLE');
  const [saveError, setSaveError] = useState('');
  const [savedId, setSavedId] = useState('');

  const hasDynamicContext = orientations.some((item) => ['OFFER_SERVICE', 'OFFER_TRANSPORT', 'SEEK_WORK', 'JOIN_COMMUNITY', 'CREATE_COMMUNITY'].includes(item));

  const canContinue = useMemo(() => {
    if (step === 1) return orientations.length > 0;
    if (step === 2) return Boolean(publicName.trim() && area && publicPhone.trim());
    if (step === 3) return Boolean(description.trim());
    return true;
  }, [step, orientations, publicName, area, publicPhone, description]);

  const toggleOrientation = (code: SokoniOrientationCode) => {
    const removing = orientations.includes(code);
    setOrientations((current) => removing ? current.filter((item) => item !== code) : [...current, code]);
    if (removing) {
      setOrientationContext((current) => ({
        ...current,
        serviceTypes: code === 'OFFER_SERVICE' ? [] : current.serviceTypes,
        transportTypes: code === 'OFFER_TRANSPORT' ? [] : current.transportTypes,
        opportunityTypes: code === 'SEEK_WORK' ? [] : current.opportunityTypes,
        communityMode: code === 'JOIN_COMMUNITY' || code === 'CREATE_COMMUNITY' ? null : current.communityMode,
      }));
    }
  };

  const addPhotos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 8 - photos.length));
    if (!files.length) return;
    setPhotos((current) => [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    event.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
    setCatalogue((current) => current.map((item) => ({ ...item, photoIndexes: item.photoIndexes.filter((photoIndex) => photoIndex !== index).map((photoIndex) => photoIndex > index ? photoIndex - 1 : photoIndex) })));
    setCataloguePhotos((current) => current.filter((photoIndex) => photoIndex !== index).map((photoIndex) => photoIndex > index ? photoIndex - 1 : photoIndex));
  };

  const addCatalogueItem = () => {
    if (!catalogueName.trim()) return;
    setCatalogue((current) => [...current, { name: catalogueName.trim(), kind: catalogueKind, description: catalogueDescription.trim(), photoIndexes: cataloguePhotos }]);
    setCatalogueName('');
    setCatalogueDescription('');
    setCataloguePhotos([]);
  };

  const next = () => { if (step < 4 && canContinue) setStep((value) => (value + 1) as Step); };
  const back = () => { if (step === 1) onExit(); else setStep((value) => (value - 1) as Step); };

  const publish = async () => {
    setSaveState('SAVING');
    setSaveError('');
    try {
      const participant = await saveSokoniParticipant({
        participantKind: deriveParticipantKind(orientations, orientationContext),
        orientations,
        orientationContext,
        publicName,
        category: category.trim() || deriveCategory(orientations, orientationContext),
        description,
        county: 'Mombasa',
        area,
        publicPhone,
        publicContact,
        offeringCode,
        photos: photos.map((item) => item.file),
        listings: catalogue,
      });
      setSavedId(participant.id);
      setSaveState('SUCCESS');
    } catch (error) {
      setSaveState('ERROR');
      setSaveError(error instanceof Error ? error.message : 'Sokoni could not save this participant yet.');
    }
  };

  const dynamicPrompts = orientations.includes('OFFER_SERVICE') || orientations.includes('OFFER_TRANSPORT') || orientations.includes('OFFER_DELIVERY')
    ? 'What can you provide?'
    : orientations.includes('SEEK_WORK')
      ? 'What kind of work or opportunity interests you?'
      : orientations.includes('JOIN_COMMUNITY') || orientations.includes('CREATE_COMMUNITY')
        ? 'What community direction fits you?'
        : 'What should people know about your Sokoni presence?';

  return <main className="min-h-screen bg-[#f7f7f3] text-neutral-950">
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-[#f7f7f3]/95 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6"><button type="button" onClick={back} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-white"><ArrowLeft className="h-4 w-4" /> Back</button><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-950 text-xs font-black text-white">S</div><span className="text-sm font-black">Join Sokoni</span></div><span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800 sm:block">SOKONI · NOT TDBK ENROLLMENT</span></div></header>

    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10"><div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Participation first.</strong> Sokoni is for people and local activity—not only formal businesses. You can select more than one reason for being here. This creates a Sokoni participant only.</div>
      <section className="mt-5 grid gap-6 lg:grid-cols-[1fr_300px]"><div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">{step === 1 ? 'Orientation' : step === 2 ? 'Context' : step === 3 ? 'Public presence' : 'Optional commercial'}</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">{step === 1 ? 'What brings you to Sokoni?' : step === 2 ? 'Tell Sokoni where and how to find you' : step === 3 ? dynamicPrompts : 'Optional Sokoni commercial offering'}</h1></div><span className="text-xs font-black text-neutral-400">{step}/4</span></div>
        <div className="mt-6 grid grid-cols-4 gap-2">{['Orient', 'Context', 'Presence', 'Commercial'].map((label, index) => <div key={label}><div className={`h-1.5 rounded-full ${index + 1 <= step ? 'bg-neutral-950' : 'bg-neutral-200'}`} /><p className="mt-2 text-[10px] font-bold text-neutral-400">{label}</p></div>)}</div>

        {step === 1 && <div className="mt-8 grid gap-3 sm:grid-cols-2">{SOKONI_ORIENTATION_OPTIONS.map((option) => <ToggleChoice key={option.code} selected={orientations.includes(option.code)} label={option.label} description={option.description} onClick={() => toggleOrientation(option.code)} />)}<div className="sm:col-span-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600"><strong className="text-neutral-900">Multiple orientations are normal.</strong> A person can buy, sell and offer a service at the same time. Sokoni stores these orientations separately from the participant's primary presentation kind.</div></div>}

        {step === 2 && <div className="mt-8 space-y-5">
          {hasDynamicContext && <div className="space-y-5 rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
            {orientations.includes('OFFER_SERVICE') && <div><p className="text-sm font-black">Services you offer</p><p className="mt-1 text-xs text-neutral-500">Choose relevant options; Sokoni is not limited to this list.</p><MultiSelect values={orientationContext.serviceTypes} options={SOKONI_SERVICE_OPTIONS} onChange={(serviceTypes) => setOrientationContext((current) => ({ ...current, serviceTypes }))} /></div>}
            {orientations.includes('OFFER_TRANSPORT') && <div><p className="text-sm font-black">Transport you offer</p><MultiSelect values={orientationContext.transportTypes} options={SOKONI_TRANSPORT_OPTIONS} onChange={(transportTypes) => setOrientationContext((current) => ({ ...current, transportTypes }))} /></div>}
            {orientations.includes('SEEK_WORK') && <div><p className="text-sm font-black">Work / opportunity interests</p><MultiSelect values={orientationContext.opportunityTypes} options={SOKONI_SEEK_WORK_OPTIONS} onChange={(opportunityTypes) => setOrientationContext((current) => ({ ...current, opportunityTypes }))} /></div>}
            {(orientations.includes('JOIN_COMMUNITY') || orientations.includes('CREATE_COMMUNITY')) && <div><p className="text-sm font-black">Community direction</p><div className="mt-3 flex flex-wrap gap-2">{(['JOIN','CREATE','BOTH'] as const).map((mode) => <button key={mode} type="button" onClick={() => setOrientationContext((current) => ({ ...current, communityMode: mode }))} className={`rounded-full border px-3 py-2 text-xs font-semibold ${orientationContext.communityMode === mode ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}>{mode}</button>)}</div></div>}
          </div>}
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Public name"><input value={publicName} onChange={(event) => setPublicName(event.target.value)} placeholder="Your name, service name, shop name, or public identity" /></Field><Field label="Discovery area"><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" /><select className="pl-9" value={area} onChange={(event) => setArea(event.target.value)}>{AREAS.map((item) => <option key={item}>{item}</option>)}</select></div></Field></div>
          <Field label="Optional public category"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Let Sokoni derive from your orientation</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Public phone"><input value={publicPhone} onChange={(event) => setPublicPhone(event.target.value)} placeholder="e.g. 07xx xxx xxx" /></Field>
          <Field label="Other public contact (optional)"><input value={publicContact} onChange={(event) => setPublicContact(event.target.value)} placeholder="WhatsApp, email, website or another public contact" /></Field>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-xs leading-5 text-neutral-600"><strong className="text-neutral-900">Location is a discovery dimension.</strong> You choose the area you want your public presence associated with. Sokoni does not expose precise coordinates or claim live proximity, routing, coverage or availability.</div>
        </div>}

        {step === 3 && <div className="mt-8 space-y-7">
          <Field label="Public description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Tell people what you want, sell, offer, provide, promote or are looking for." /></Field>
          <div><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Participant photos</p><p className="mt-1 text-xs text-neutral-500">Reusable Sokoni media can represent you, an item, a service or work evidence.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-neutral-950 px-3 py-2 text-xs font-bold text-white"><Camera className="h-4 w-4" /> Add photos<input type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} /></label></div>{photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((photo, index) => <div key={`${photo.preview}-${index}`} className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100"><img src={photo.preview} alt="Sokoni participant preview" className="aspect-square w-full object-cover" /><button type="button" onClick={() => removePhoto(index)} className="absolute right-2 top-2 rounded-full bg-white/90 p-2 shadow-sm" aria-label="Remove photo"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}</div>
          <div className="border-t border-neutral-100 pt-6"><p className="text-sm font-black">Products & services</p><p className="mt-1 text-xs text-neutral-500">Add only what you want people to discover. No stock, price, delivery, payment or availability is created.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px]"><input value={catalogueName} onChange={(event) => setCatalogueName(event.target.value)} placeholder="Product or service name" /><select value={catalogueKind} onChange={(event) => setCatalogueKind(event.target.value as 'PRODUCT' | 'SERVICE')}><option value="PRODUCT">Product</option><option value="SERVICE">Service</option></select></div><textarea value={catalogueDescription} onChange={(event) => setCatalogueDescription(event.target.value)} rows={3} className="mt-3" placeholder="Short public description" />{photos.length > 0 && <div className="mt-3"><p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">Reuse participant photos</p><div className="mt-2 flex flex-wrap gap-2">{photos.map((photo, index) => <button key={photo.preview} type="button" onClick={() => setCataloguePhotos((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} className={`overflow-hidden rounded-xl border-2 ${cataloguePhotos.includes(index) ? 'border-neutral-950' : 'border-neutral-200'}`}><img src={photo.preview} alt="Select catalogue media" className="h-14 w-14 object-cover" /></button>)}</div></div>}<button type="button" onClick={addCatalogueItem} disabled={!catalogueName.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold disabled:opacity-40"><Plus className="h-4 w-4" /> Add item</button>{catalogue.length > 0 && <div className="mt-4 space-y-2">{catalogue.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-2xl border border-neutral-200 p-4"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-black">{item.kind}</span><p className="mt-2 text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-neutral-500">{item.description || 'No description supplied.'}</p>{item.photoIndexes.length > 0 && <p className="mt-2 text-[10px] font-bold text-neutral-400">{item.photoIndexes.length} reusable photo reference{item.photoIndexes.length === 1 ? '' : 's'}</p>}</div><button type="button" onClick={() => setCatalogue((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Remove catalogue item"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>}</div>
        </div>}

        {step === 4 && <div className="mt-8 space-y-5"><div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><p className="text-sm font-black">Commercial options are optional</p><p className="mt-1 text-xs leading-5 text-neutral-500">Sokoni participation does not depend on choosing a paid offering. If you choose one, its price is configuration data and its payment remains a separate boundary.</p></div><div className="grid gap-3 sm:grid-cols-2">{SOKONI_COMMERCIAL_OFFERINGS.filter((item) => item.enabled).map((offer) => <button key={offer.code} type="button" onClick={() => setOfferingCode((current) => current === offer.code ? null : offer.code)} className={`rounded-2xl border p-5 text-left ${offeringCode === offer.code ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}><span className="text-2xl font-black">{offer.currency === 'KES' ? 'KSh ' : ''}{offer.amount}</span><p className={`mt-2 text-xs leading-5 ${offeringCode === offer.code ? 'text-neutral-300' : 'text-neutral-500'}`}>{offer.name}</p></button>)}</div><div className="rounded-3xl border border-neutral-200 bg-white p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-neutral-500" /><div><p className="text-sm font-black">Publication and payment are separate</p><p className="mt-1 text-xs leading-5 text-neutral-500">Publishing creates only the Sokoni participant record. No payment is initiated or confirmed here.</p></div></div><div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-neutral-500">TDBK relationship</p><p className="mt-1 text-sm font-bold">NOT ENROLLED</p><p className="mt-1 text-xs leading-5 text-neutral-500">No DBK, Business DNA or Engine enrollment is created.</p></div></div></div>}

        {saveState === 'ERROR' && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Could not save.</strong><p className="mt-1 text-xs leading-5">{saveError}</p></div>}
        {saveState === 'SUCCESS' && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><div className="flex items-center gap-2 text-sm font-black"><Check className="h-5 w-5" /> {offeringCode ? 'Sokoni participant saved as a draft — payment required before public activation' : 'Sokoni participant saved and publicly discoverable'}</div><p className="mt-2 text-xs leading-5">Participant ID: <span className="font-mono">{savedId}</span>. The record is Sokoni-owned, retains multiple orientations and is NOT ENROLLED with TDBK.</p></div>}
        <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-5"><button type="button" onClick={back} className="rounded-xl px-3 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-50">{step === 1 ? 'Cancel' : 'Back'}</button>{step < 4 ? <button type="button" onClick={next} disabled={!canContinue} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Continue <ArrowRight className="h-4 w-4" /></button> : saveState === 'SUCCESS' ? <button type="button" onClick={onExit} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-3 text-xs font-black hover:bg-neutral-50">Return to Sokoni <X className="h-4 w-4" /></button> : <button type="button" onClick={publish} disabled={saveState === 'SAVING'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">{saveState === 'SAVING' ? 'Saving participant…' : 'Join Sokoni'} <ArrowRight className="h-4 w-4" /></button>}</div>
      </div>
      <aside className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:h-fit"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Sokoni participation</p><ul className="mt-4 space-y-3 text-xs leading-5 text-neutral-600"><li>✓ Multiple orientations</li><li>✓ Area-aware public presence</li><li>✓ Reusable participant media</li><li>✓ Product/service discovery</li><li>✓ Optional commercial offerings</li><li>✓ Future TDBK adoption input</li></ul><div className="mt-5 rounded-2xl bg-neutral-950 p-4 text-xs leading-5 text-white"><strong>Not created:</strong> DBK, Business DNA, TDBK subscription, payment transaction, workflow, receipt or Engine capability.</div></aside>
      </section>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">{label}</span>{React.cloneElement(children, { className: `w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500 ${children.props.className || ''}` })}</label>;
}
