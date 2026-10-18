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
import type { SubscriptionTier } from '../../capability/types';

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

export function BusinessDiscovery({ onProvisioned }: BusinessDiscoveryProps) {
  const { getIdToken } = useAuth();
  const [step, setStep] = useState<'DISCOVER' | 'CAPABILITIES' | 'REVIEW'>('DISCOVER');
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [existingDbkId, setExistingDbkId] = useState<string | null>(null);
  const [existingDbkName, setExistingDbkName] = useState<string | null>(null);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('FREE');
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [branchName, setBranchName] = useState('Mombasa');
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionRequestId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = 'tdbk:onboarding:request-id';
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  });

  const selectedBlueprint = useMemo(
    () => blueprints.find((blueprint) => blueprint.id === selectedBlueprintId) || null,
    [blueprints, selectedBlueprintId]
  );

  useEffect(() => {
    const load = async () => {
      try {
        let token = await getIdToken();
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
        if (list.length === 1) {
          const onlyBlueprint = list[0];
          setSelectedBlueprintId(onlyBlueprint.id);
          setSelectedCapabilities(
            (onlyBlueprint.supportedCapabilities || [])
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
    const capability = selectedBlueprint?.supportedCapabilities?.find((item) => item.id === capabilityId);
    if (capability?.isDefault) return;

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
      let token = await getIdToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');

      const identityResponse = await fetch('/api/kernel/identity/initialize-owner', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const identityData = await identityResponse.json();
      if (!identityResponse.ok) {
        throw new Error(identityData.error?.message || 'Unable to initialize business-owner identity.');
      }

      token = await getIdToken(true);
      if (!token) throw new Error('Unable to refresh your authenticated session.');

      const provisionResponse = await fetch('/api/platform/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          legalName: businessName.trim(),
          displayName: businessName.trim(),
          blueprintId: selectedBlueprint.id,
          blueprintVersion: selectedBlueprint.version,
          // Requested tier is recorded for the subscription flow. A client selection
          // must not grant paid entitlements before payment is verified by the Engine.
          subscriptionTier: 'FREE',
          customPreferences: { requestedSubscriptionTier: selectedTier },
          primaryBranchName: branchName.trim() || 'Head Office',
          idempotencyKey: provisionRequestId,
        }),
      });

      const provisionData = await provisionResponse.json();
      if (!provisionResponse.ok) {
        throw new Error(provisionData.error?.message || 'TDBK could not provision the business.');
      }

      // Verify the newly provisioned DBK is backed by the Engine's durable Business DNA
      // before handing control to the workspace. TDBK keeps the authoritative business profile in the platform.
      const dbkId = provisionData.result?.dbkId;
      if (!dbkId) throw new Error('TDBK completed provisioning without returning an authoritative business identity.');

      const dnaResponse = await fetch(`/api/dna/${dbkId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dnaData = await dnaResponse.json().catch(() => ({}));
      if (!dnaResponse.ok || !dnaData.dna) {
        throw new Error(dnaData.error?.message || 'TDBK provisioned the business, but its authoritative Business DNA could not be verified.');
      }

      const authoritativeDna = dnaData.dna;
      if (
        authoritativeDna.dbkId !== dbkId ||
        authoritativeDna.identity?.businessName !== businessName.trim() ||
        authoritativeDna.identity?.blueprintId !== selectedBlueprint.id
      ) {
        throw new Error('TDBK provisioned the business, but the returned Business DNA does not match the onboarding selection.');
      }

      // Persist the human-authored context through the TDBK platform authority.
      const contextResponse = await fetch('/api/dna/' + dbkId + '/business-context', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ narrative }),
      });
      const contextData = await contextResponse.json().catch(() => ({}));
      if (!contextResponse.ok) {
        throw new Error(contextData.error?.message || 'TDBK could not save the Business Context.');
      }
      if (contextData.dna?.businessContextNarrative !== narrative.trim()) {
        throw new Error('TDBK saved the business, but the authoritative Business Context could not be verified.');
      }

      // A paid tier selection starts a server-priced M-Pesa checkout only after
      // the DBK and Business DNA are verified. Checkout failures never undo the
      // successfully provisioned FREE workspace or unlock paid capabilities.
      if (selectedTier !== 'FREE') {
        try {
          const checkoutResponse = await fetch(`/api/subscriptions/${dbkId}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tier: selectedTier, phoneNumber: mpesaPhoneNumber.trim(), interval: 'MONTHLY' }),
          });
          const checkoutData = await checkoutResponse.json().catch(() => ({}));
          if (!checkoutResponse.ok) {
            window.alert(checkoutData.error?.message || 'Your workspace is ready, but subscription checkout could not start. You can retry from subscription settings.');
          } else {
            window.alert(`M-Pesa payment request sent for ${checkoutData.amount} KES. Complete the prompt on your phone; your selected tier activates after payment is verified.`);
          }
        } catch {
          window.alert('Your workspace is ready, but checkout could not be reached. You can retry from subscription settings.');
        }
      }
      window.sessionStorage.removeItem('tdbk:onboarding:request-id');
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
        <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Preparing your business workspace…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-neutral-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Set up your workspace</div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-bold tracking-tight">Tell us about your business.</h1>
            <p className="mt-2 text-sm text-neutral-600 max-w-2xl">Start with the essentials. TDBK will prepare your workspace around how you operate. You can add more capabilities later.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-500">
            <span className={step === 'DISCOVER' ? 'text-emerald-700 font-bold' : ''}>01 BUSINESS</span><ArrowRight className="w-3.5 h-3.5" />
            <span className={step === 'CAPABILITIES' ? 'text-emerald-700 font-bold' : ''}>02 STARTING TOOLS</span><ArrowRight className="w-3.5 h-3.5" />
            <span className={step === 'REVIEW' ? 'text-emerald-700 font-bold' : ''}>03 READY</span><ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {existingDbkId && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div><div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Existing business found</div><div className="mt-1 text-sm text-emerald-950">{existingDbkName}</div></div>
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

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Choose your TDBK tier</div>
              <h2 className="mt-1 text-xl font-bold">What level of workspace do you need?</h2>
              <p className="mt-2 text-sm text-neutral-600">TDBK builds the complete core workspace now. Your selected tier is saved with the registration; paid capabilities are activated only after the subscription authority verifies payment.</p>
              {selectedTier !== 'FREE' && (
                <label className="mt-4 block max-w-md">
                  <span className="mb-2 block text-sm font-semibold text-neutral-700">M-Pesa phone number</span>
                  <input
                    value={mpesaPhoneNumber}
                    onChange={(event) => setMpesaPhoneNumber(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="2547XXXXXXXX"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-neutral-950"
                    aria-describedby="mpesa-checkout-help"
                  />
                  <span id="mpesa-checkout-help" className="mt-2 block text-xs text-neutral-500">Use 2547XXXXXXXX or 2541XXXXXXXX. The server determines the tier price; payment is verified before paid tools activate.</span>
                </label>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  { id: 'FREE', name: 'Free', detail: 'Core workspace and essential tools' },
                  { id: 'FOUNDATION', name: 'Foundation', detail: 'A stronger starting setup for daily operations' },
                  { id: 'GROWTH', name: 'Growth', detail: 'For expanding operations and teams' },
                  { id: 'PRO', name: 'Pro', detail: 'Advanced operational capabilities' },
                  { id: 'ENTERPRISE', name: 'Enterprise', detail: 'Multi-unit and enterprise-scale needs' },
                ] as Array<{ id: SubscriptionTier; name: string; detail: string }>).map((tier) => (
                  <button key={tier.id} type="button" onClick={() => setSelectedTier(tier.id)} className={`rounded-xl border p-4 text-left transition ${selectedTier === tier.id ? 'border-neutral-950 bg-neutral-950 text-white shadow-md' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}>
                    <div className="flex items-center justify-between gap-2"><span className="font-bold">{tier.name}</span>{selectedTier === tier.id && <Check className="h-4 w-4" />}</div>
                    <p className="mt-2 text-xs leading-relaxed opacity-75">{tier.detail}</p>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3"><div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Your business</div><h2 className="text-xl font-bold mt-1">What kind of business do you run?</h2></div>
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
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7 shadow-sm">
              <div className="flex items-center gap-3"><Store className="w-5 h-5" /><div><div className="text-xs uppercase tracking-wider text-neutral-500">Business type</div><h2 className="text-xl font-bold">{selectedBlueprint.name}</h2></div></div>
              <p className="mt-3 text-sm text-neutral-600">Here are the starting tools available for this business. Included tools are part of the business model. Optional tools can be activated after the workspace has the required subscription tier.</p>
            </section>
            <div className="grid md:grid-cols-2 gap-3">
              {(selectedBlueprint.supportedCapabilities || []).map((capability) => {
                const selected = selectedCapabilities.includes(capability.id);
                return <button key={capability.id} type="button" disabled={capability.isDefault} onClick={() => toggleCapability(capability.id)} className={`text-left rounded-2xl border p-5 transition ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200 bg-white'} ${capability.isDefault ? 'cursor-default' : 'hover:border-neutral-400'}`}><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-mono uppercase text-neutral-500">{capability.category}</div><div className="mt-1 font-bold text-sm">{capability.name}</div></div><span className={`w-6 h-6 rounded-full border flex items-center justify-center ${selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-neutral-300 text-transparent'}`}><Check className="w-4 h-4" /></span></div><p className="mt-2 text-xs text-neutral-600 leading-relaxed">{capability.description}</p>{capability.isDefault ? <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Included by Engine blueprint</div> : <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Requested for activation</div>}</button>;
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
              <div className="mt-5 grid md:grid-cols-3 gap-4 text-sm"><div className="rounded-xl bg-neutral-50 p-4"><div className="text-[10px] uppercase text-neutral-500">Business type</div><div className="font-semibold mt-1">{selectedBlueprint.name}</div></div><div className="rounded-xl bg-neutral-50 p-4"><div className="text-[10px] uppercase text-neutral-500">Primary location</div><div className="font-semibold mt-1">{branchName || 'Head Office'}</div></div><div className="rounded-xl bg-neutral-50 p-4"><div className="text-[10px] uppercase text-neutral-500">Selected tier</div><div className="font-semibold mt-1">{selectedTier}</div></div></div>
              {narrative && <p className="mt-5 text-sm text-neutral-600 leading-relaxed">{narrative}</p>}
              <div className="mt-6"><div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Starting tools</div><div className="flex flex-wrap gap-2">{selectedCapabilities.map((id) => <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs"><WalletCards className="w-3.5 h-3.5" />{selectedBlueprint.supportedCapabilities?.find((capability) => capability.id === id)?.name || id}</span>)}</div><p className="mt-3 text-xs text-neutral-500">Included tools are part of your starting business setup. Optional tools are not activated during free provisioning; they become available after the required subscription tier is activated.</p></div>
            </section>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">TDBK will provision the complete core DBK workspace now and save your selected tier ({selectedTier}). {selectedTier === 'FREE' ? 'No payment is required.' : 'An M-Pesa checkout request will be started for the selected tier. Paid capabilities remain locked until the subscription authority confirms payment.'}</div>
            <div className="flex justify-between"><button disabled={provisioning} onClick={() => setStep('CAPABILITIES')} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"><ChevronLeft className="w-4 h-4" /> Back</button><button disabled={provisioning} onClick={handleProvision} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{provisioning ? <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning your workspace…</> : <>Create my workspace <ArrowRight className="w-4 h-4" /></>}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
