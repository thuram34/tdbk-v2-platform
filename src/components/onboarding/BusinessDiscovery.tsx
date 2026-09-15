import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  Loader2,
  MapPin,
  Sparkles,
  Store,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../../client/AuthContext';

type Blueprint = {
  id: string;
  name: string;
  version: string;
  sector: string;
  description: string;
  supportedCapabilities?: Array<{
    id: string;
    name: string;
    category: string;
    isDefault: boolean;
    description: string;
  }>;
};

type BusinessDiscoveryProps = {
  onProvisioned: (dbkId: string) => void;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

export function BusinessDiscovery({ onProvisioned }: BusinessDiscoveryProps) {
  const { getIdToken } = useAuth();
  const [step, setStep] = useState<'DISCOVER' | 'CAPABILITIES' | 'REVIEW'>('DISCOVER');
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [existingDbkId, setExistingDbkId] = useState<string | null>(null);
  const [existingDbkName, setExistingDbkName] = useState<string | null>(null);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('hardware_v1');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [branchName, setBranchName] = useState('Mombasa');
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBlueprint = useMemo(
    () => blueprints.find((blueprint) => blueprint.id === selectedBlueprintId) || null,
    [blueprints, selectedBlueprintId]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error('Your session has expired. Please sign in again.');
        const headers = { Authorization: `Bearer ${token}` };

        const [blueprintResponse, dbkResponse] = await Promise.all([
          fetch('/api/blueprints', { headers }),
          fetch('/api/platform/dbks', { headers }),
        ]);

        const blueprintData = await blueprintResponse.json();
        if (!blueprintResponse.ok) throw new Error(blueprintData.error?.message || 'Unable to load business blueprints.');

        const list: Blueprint[] = blueprintData.blueprints || [];
        setBlueprints(list);
        const preferred = list.find((blueprint) => blueprint.id === 'hardware_v1') || list[0];
        if (preferred) {
          setSelectedBlueprintId(preferred.id);
          setSelectedCapabilities(
            (preferred.supportedCapabilities || [])
              .filter((capability) => capability.isDefault)
              .map((capability) => capability.id)
          );
        }

        if (dbkResponse.ok) {
          const dbkData = await dbkResponse.json();
          const firstDbk = (dbkData.dbks || [])[0];
          if (firstDbk?.dbkId) {
            setExistingDbkId(firstDbk.dbkId);
            setExistingDbkName(firstDbk.displayName || firstDbk.legalName || firstDbk.dbkId);
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Unable to load TDBK business discovery.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getIdToken]);

  const chooseBlueprint = (blueprint: Blueprint) => {
    setSelectedBlueprintId(blueprint.id);
    setSelectedCapabilities(
      (blueprint.supportedCapabilities || [])
        .filter((capability) => capability.isDefault)
        .map((capability) => capability.id)
    );
  };

  const toggleCapability = (capabilityId: string) => {
    setSelectedCapabilities((current) =>
      current.includes(capabilityId)
        ? current.filter((id) => id !== capabilityId)
        : [...current, capabilityId]
    );
  };

  const handleProvision = async () => {
    if (!selectedBlueprint || !businessName.trim()) {
      setError('Business name and business type are required.');
      return;
    }

    setProvisioning(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');

      const identityResponse = await fetch('/api/kernel/identity/initialize-owner', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const identityData = await identityResponse.json();
      if (!identityResponse.ok) {
        throw new Error(identityData.error?.message || 'Unable to initialize business-owner identity.');
      }

      const dbkId = `dbk-${slugify(businessName)}-${Date.now().toString(36)}`;
      const provisionResponse = await fetch('/api/platform/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dbkId,
          legalName: businessName.trim(),
          displayName: businessName.trim(),
          blueprintId: selectedBlueprint.id,
          blueprintVersion: selectedBlueprint.version,
          subscriptionTier: 'PROFESSIONAL',
          primaryBranchName: branchName.trim() || 'Head Office',
        }),
      });

      const provisionData = await provisionResponse.json();
      if (!provisionResponse.ok) {
        throw new Error(provisionData.error?.message || 'TDBK could not provision the business.');
      }

      const defaultCapabilityIds = new Set(
        (selectedBlueprint.supportedCapabilities || [])
          .filter((capability) => capability.isDefault)
          .map((capability) => capability.id)
      );

      for (const capabilityId of selectedCapabilities) {
        if (defaultCapabilityIds.has(capabilityId)) continue;
        const enableResponse = await fetch('/api/capability/enable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ dbkId, capabilityId }),
        });
        if (!enableResponse.ok) {
          const enableData = await enableResponse.json().catch(() => ({}));
          throw new Error(enableData.error?.message || `Capability '${capabilityId}' could not be enabled.`);
        }
      }

      onProvisioned(dbkId);
    } catch (err: any) {
      setError(err?.message || 'Business provisioning failed.');
    } finally {
      setProvisioning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center text-neutral-600">
        <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Understanding TDBK business blueprints…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-neutral-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">TDBK Business Discovery</div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-bold tracking-tight">Let TDBK understand your business.</h1>
            <p className="mt-2 text-sm text-neutral-600 max-w-2xl">Tell us what you operate. TDBK resolves the business blueprint and capabilities before provisioning your Digital Business.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-500">
            <span className={step === 'DISCOVER' ? 'text-emerald-700 font-bold' : ''}>01 DISCOVER</span><ArrowRight className="w-3.5 h-3.5" />
            <span className={step === 'CAPABILITIES' ? 'text-emerald-700 font-bold' : ''}>02 COMPOSE</span><ArrowRight className="w-3.5 h-3.5" />
            <span className={step === 'REVIEW' ? 'text-emerald-700 font-bold' : ''}>03 REVIEW</span>
          </div>
        </div>

        {existingDbkId && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div><div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Existing Digital Business found</div><div className="mt-1 text-sm text-emerald-950">{existingDbkName}</div></div>
            <button onClick={() => onProvisioned(existingDbkId)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Continue to my business <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        {step === 'DISCOVER' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold"><Building2 className="w-4 h-4" /> Your business</div>
              <div className="grid md:grid-cols-2 gap-5 mt-5">
                <label className="block"><span className="block text-xs font-semibold text-neutral-600 mb-2">Business / Organization Name</span><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Jamal Hardware" className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-neutral-950" /></label>
                <label className="block"><span className="block text-xs font-semibold text-neutral-600 mb-2">Primary Location / Branch</span><div className="relative"><MapPin className="absolute left-3 top-3.5 w-4 h-4 text-neutral-400" /><input value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Mombasa" className="w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-neutral-950" /></div></label>
              </div>
              <label className="block mt-5"><span className="block text-xs font-semibold text-neutral-600 mb-2">What do you do?</span><textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={3} placeholder="Briefly describe what you sell, provide or operate…" className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-neutral-950" /></label>
            </section>

            <section>
              <div className="mb-3"><div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Business type</div><h2 className="text-xl font-bold mt-1">Choose the closest operating model</h2></div>
              <div className="grid md:grid-cols-2 gap-3">
                {blueprints.map((blueprint) => (
                  <button key={blueprint.id} onClick={() => chooseBlueprint(blueprint)} className={`text-left rounded-2xl border p-5 transition ${selectedBlueprintId === blueprint.id ? 'border-neutral-950 bg-neutral-950 text-white shadow-lg' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}>
                    <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-wider opacity-60 font-mono">{blueprint.sector}</div><div className="mt-1 font-bold">{blueprint.name}</div></div>{selectedBlueprintId === blueprint.id && <Check className="w-5 h-5 shrink-0" />}</div>
                    <p className="mt-3 text-xs leading-relaxed opacity-75">{blueprint.description}</p>
                  </button>
                ))}
              </div>
            </section>

            <div className="flex justify-end"><button disabled={!businessName.trim() || !selectedBlueprint} onClick={() => setStep('CAPABILITIES')} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Continue <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {step === 'CAPABILITIES' && selectedBlueprint && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7 shadow-sm"><div className="flex items-center gap-3"><Store className="w-5 h-5" /><div><div className="text-xs uppercase tracking-wider text-neutral-500">Resolved blueprint</div><h2 className="text-xl font-bold">{selectedBlueprint.name}</h2></div></div><p className="mt-3 text-sm text-neutral-600">TDBK has mapped this business to the capabilities below. Core capabilities marked Included are initialized by the provisioning engine.</p></section>
            <div className="grid md:grid-cols-2 gap-3">
              {(selectedBlueprint.supportedCapabilities || []).map((capability) => {
                const selected = selectedCapabilities.includes(capability.id);
                return <button key={capability.id} onClick={() => toggleCapability(capability.id)} className={`text-left rounded-2xl border p-5 transition ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200 bg-white'}`}><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-mono uppercase text-neutral-500">{capability.category}</div><div className="mt-1 font-bold text-sm">{capability.name}</div></div><span className={`w-6 h-6 rounded-full border flex items-center justify-center ${selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-neutral-300 text-transparent'}`}><Check className="w-4 h-4" /></span></div><p className="mt-2 text-xs text-neutral-600 leading-relaxed">{capability.description}</p>{capability.isDefault && <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Included by blueprint</div>}</button>;
              })}
            </div>
            <div className="flex justify-between"><button onClick={() => setStep('DISCOVER')} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"><ChevronLeft className="w-4 h-4" /> Back</button><button onClick={() => setStep('REVIEW')} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white">Review <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {step === 'REVIEW' && selectedBlueprint && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider"><Sparkles className="w-4 h-4" /> This is what TDBK understands</div>
              <h2 className="mt-3 text-2xl font-serif font-bold">{businessName}</h2>
              <div className="mt-5 grid md:grid-cols-3 gap-4 text-sm"><div className="rounded-xl bg-neutral-50 p-4"><div className="text-[10px] uppercase text-neutral-500">Operating model</div><div className="font-semibold mt-1">{selectedBlueprint.name}</div></div><div className="rounded-xl bg-neutral-50 p-4"><div className="text-[10px] uppercase text-neutral-500">Primary location</div><div className="font-semibold mt-1">{branchName || 'Head Office'}</div></div><div className="rounded-xl bg-neutral-50 p-4"><div className="text-[10px] uppercase text-neutral-500">Subscription</div><div className="font-semibold mt-1">Professional</div></div></div>
              {narrative && <p className="mt-5 text-sm text-neutral-600 leading-relaxed">{narrative}</p>}
              <div className="mt-6"><div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Selected capabilities</div><div className="flex flex-wrap gap-2">{selectedCapabilities.map((id) => <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs"><WalletCards className="w-3.5 h-3.5" />{selectedBlueprint.supportedCapabilities?.find((capability) => capability.id === id)?.name || id}</span>)}</div></div>
            </section>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Your Firebase identity will be linked to the business owner identity, then TDBK's existing provisioning engine will create the DBK, branch topology, capabilities and workspace.</div>
            <div className="flex justify-between"><button disabled={provisioning} onClick={() => setStep('CAPABILITIES')} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"><ChevronLeft className="w-4 h-4" /> Back</button><button disabled={provisioning} onClick={handleProvision} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{provisioning ? <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning Digital Business…</> : <>Provision Digital Business <ArrowRight className="w-4 h-4" /></>}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
