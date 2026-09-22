import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  demoSokoniDiscoveryAdapter,
  SokoniDiscoveryResult,
  SokoniLocationContext,
} from './SokoniDiscoveryAdapter';

type View = 'HOME' | 'RESULTS' | 'PROVIDER';

const DEMO_LOCATION_OPTIONS = ['Mombasa', 'Nyali', 'Bamburi', 'Likoni'];

const DEMO_BOUNDARY_LABEL = 'DEMO / UX PROTOTYPE — NOT LIVE ENGINE STATE';

export function SokoniExperience({ onBack }: { onBack?: () => void }) {
  const [view, setView] = useState<View>('HOME');
  const [need, setNeed] = useState('My computer is slow.');
  const [location, setLocation] = useState<SokoniLocationContext>({
    label: 'Mombasa',
    consented: false,
  });
  const [locationOpen, setLocationOpen] = useState(false);
  const [result, setResult] = useState<SokoniDiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDiscover = need.trim().length > 0;

  const selectedProvider = useMemo(
    () => result?.providers[0] ?? null,
    [result],
  );

  const handleDiscover = async () => {
    if (!canDiscover) return;

    setLoading(true);
    setError(null);

    try {
      const next = await demoSokoniDiscoveryAdapter.discover({
        need: need.trim(),
        location,
      });
      setResult({
        ...next,
        intent: {
          ...next.intent,
          rawNeed: need.trim(),
        },
        location,
      });
      setView('RESULTS');
    } catch {
      setError('We could not prepare the discovery preview. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocation = (label: string) => {
    setLocation({ label, consented: true });
    setLocationOpen(false);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-neutral-950 selection:bg-neutral-900 selection:text-white">
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-[#f7f7f3]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {view !== 'HOME' && (
              <button
                type="button"
                onClick={() => setView(view === 'PROVIDER' ? 'RESULTS' : 'HOME')}
                className="rounded-full p-2 text-neutral-600 transition hover:bg-white hover:text-neutral-950"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-950 text-sm font-bold text-white">
              S
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Sokoni</div>
              <div className="hidden text-[11px] text-neutral-500 sm:block">Find what you need around you</div>
            </div>
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-white hover:text-neutral-950"
            >
              Exit Sokoni
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6">
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          <span className="mr-2 inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {DEMO_BOUNDARY_LABEL}
          </span>
          Provider, availability, trust, pricing and request status are not being represented as live Engine truth.
        </div>

        {view === 'HOME' && (
          <section className="mx-auto max-w-3xl pt-8 sm:pt-14">
            <div className="mb-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Discover · connect · act</p>
              <h1 className="max-w-2xl text-4xl font-black tracking-[-0.04em] sm:text-6xl">
                What do you need?
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-neutral-600 sm:text-lg">
                Tell Sokoni what you are trying to accomplish. You do not need to know the category or the right technical words.
              </p>
            </div>

            <div className="rounded-[28px] border border-neutral-200 bg-white p-3 shadow-[0_20px_70px_rgba(0,0,0,0.07)] sm:p-4">
              <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                <Search className="mt-1 h-5 w-5 shrink-0 text-neutral-400" />
                <textarea
                  value={need}
                  onChange={(event) => setNeed(event.target.value)}
                  rows={2}
                  aria-label="What do you need?"
                  placeholder="e.g. My computer is slow"
                  className="min-h-16 w-full resize-none bg-transparent text-base font-medium outline-none placeholder:text-neutral-400"
                />
              </div>

              <div className="relative mt-3">
                <button
                  type="button"
                  onClick={() => setLocationOpen((open) => !open)}
                  className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-neutral-400"
                  aria-expanded={locationOpen}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-neutral-500" />
                    <span className="text-sm font-semibold">{location.label}</span>
                    <span className="text-xs text-neutral-400">discovery area</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-neutral-400" />
                </button>

                {locationOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-1 shadow-xl">
                    {DEMO_LOCATION_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleLocation(option)}
                        className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-neutral-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!canDiscover || loading}
                onClick={handleDiscover}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Understanding your need…' : 'Discover help'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                {error}
              </div>
            )}

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ['Services', 'Find a technician, provider or professional'],
                ['Products', 'Discover things available around you'],
                ['Opportunities', 'Explore work and local opportunities'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-sm font-bold">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-neutral-500">{description}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === 'RESULTS' && result && (
          <section className="pt-5 sm:pt-10">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Understanding your need</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] sm:text-5xl">Computer support</h1>
              <p className="mt-3 text-sm leading-6 text-neutral-600 sm:text-base">
                You said: <span className="font-semibold text-neutral-900">“{result.intent.rawNeed}”</span>
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white">{result.intent.interpretedNeed}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">
                  <MapPin className="h-3.5 w-3.5" /> {result.location?.label}
                </span>
              </div>
            </div>

            <div className="mt-10 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Discovery</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">Possible help</h2>
              </div>
              <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 sm:inline-flex">
                Preview results
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {result.providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setView('PROVIDER')}
                  className="group rounded-[26px] border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-lg sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100">
                      <Wrench className="h-5 w-5 text-neutral-700" />
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">DEMO</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{provider.displayName}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{provider.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {provider.services.slice(0, 4).map((service) => (
                      <span key={service} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
                        {service}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4 text-sm font-bold">
                    <span>View provider</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === 'PROVIDER' && selectedProvider && (
          <section className="mx-auto max-w-3xl pt-5 sm:pt-10">
            <div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                    <Wrench className="h-7 w-7" />
                  </div>
                  <div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">REFERENCE PREVIEW</span>
                    <h1 className="mt-2 text-2xl font-black tracking-tight">{selectedProvider.displayName}</h1>
                    <p className="mt-1 text-sm text-neutral-500">Computer & IT Support</p>
                  </div>
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">What this preview represents</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  The technician reference journey only. The actual provider identity, coverage, availability, verification and commercial terms must come from the Engine public-discovery contract when it is approved.
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {selectedProvider.services.map((service) => (
                  <div key={service} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
                    <CheckCircle2 className="h-4 w-4 text-neutral-500" />
                    <span className="text-sm font-semibold">{service}</span>
                  </div>
                ))}
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    <MapPin className="h-3.5 w-3.5" /> Location
                  </div>
                  <p className="mt-2 text-sm font-semibold">{location.label}</p>
                  <p className="mt-1 text-xs text-neutral-500">User-selected discovery area; not provider coverage truth.</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    <Clock3 className="h-3.5 w-3.5" /> Availability
                  </div>
                  <p className="mt-2 text-sm font-semibold">Not connected</p>
                  <p className="mt-1 text-xs text-neutral-500">No live availability is being claimed.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHandoffOpen(true)}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800"
              >
                Request service
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="mt-3 text-center text-[11px] leading-5 text-neutral-500">
                This button demonstrates the future Engine handoff boundary. It does not create a request.
              </p>
            </div>
          </section>
        )}
      </div>

      {handoffOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/45 p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="engine-handoff-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">ENGINE HANDOFF PLACEHOLDER</span>
                <h2 id="engine-handoff-title" className="mt-3 text-2xl font-black tracking-tight">Request service</h2>
              </div>
              <button type="button" onClick={() => setHandoffOpen(false)} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {[
                ['Sokoni', 'Collects the customer intent and selected provider.'],
                ['Engine', 'Future authoritative request/workflow contract goes here.'],
                ['DBK', 'Provider receives and operates the resulting request through its authoritative workspace.'],
              ].map(([label, description]) => (
                <div key={label} className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</div>
                  <div className="mt-1 text-sm leading-6 text-neutral-700">{description}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-neutral-950 p-4 text-sm leading-6 text-white">
              <div className="font-bold">No request was created.</div>
              <div className="mt-1 text-neutral-300">GAP-10 remains MASTER REVIEW REQUIRED. This prototype intentionally stops at the handoff boundary.</div>
            </div>

            <button
              type="button"
              onClick={() => setHandoffOpen(false)}
              className="mt-5 w-full rounded-2xl border border-neutral-200 px-5 py-3.5 text-sm font-bold hover:bg-neutral-50"
            >
              Return to provider
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default SokoniExperience;
