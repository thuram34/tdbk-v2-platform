import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  GraduationCap,
  HeartPulse,
  Hotel,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wrench,
} from 'lucide-react';

export type DbkIntent =
  | 'START_BUSINESS'
  | 'DIGITIZE_OPERATIONS'
  | 'MANAGE_SALES'
  | 'MANAGE_INSTITUTION'
  | 'MANAGE_SERVICES';

type Props = {
  onSignIn?: () => void;
  onLaunchWorkspace?: () => void;
};

const INTENTS: Array<{ id: DbkIntent; title: string; description: string; icon: React.ElementType }> = [
  { id: 'START_BUSINESS', title: 'Set up my organization', description: 'Create an organization workspace and tell TDBK how you operate.', icon: Building2 },
  { id: 'DIGITIZE_OPERATIONS', title: 'Digitize my operations', description: 'Bring everyday work, records and processes into one organization experience.', icon: Sparkles },
  { id: 'MANAGE_SALES', title: 'Manage sales and stock', description: 'Explore ways to organize selling, inventory and customer activity.', icon: ShoppingBag },
  { id: 'MANAGE_INSTITUTION', title: 'Manage an institution', description: 'Explore organization experiences for schools, clinics and other institutions.', icon: GraduationCap },
  { id: 'MANAGE_SERVICES', title: 'Manage a service business', description: 'Explore an organization experience for professional and field services.', icon: Wrench },
];

const INDUSTRIES = [
  { title: 'Business & Retail', description: 'Sales, stock, customers and day-to-day operations.', icon: ShoppingBag },
  { title: 'Education', description: 'School and academy organization experiences.', icon: GraduationCap },
  { title: 'Healthcare', description: 'Clinic and healthcare organization experiences.', icon: HeartPulse },
  { title: 'Hospitality', description: 'Hotel, lodge and guest-service operations.', icon: Hotel },
  { title: 'Professional Services', description: 'Service businesses, technicians and operators.', icon: Wrench },
  { title: 'Organizations & Institutions', description: 'Structured work, people, projects and reporting.', icon: Building2 },
];

const CAPABILITY_EXAMPLES = [
  { title: 'Sales & POS', description: 'Organize selling and transaction workflows.', icon: ShoppingBag },
  { title: 'Inventory', description: 'Keep visibility over products and stock activity.', icon: Package },
  { title: 'People & Roles', description: 'Organize people and responsibilities through the Engine.', icon: ShieldCheck },
  { title: 'Documents & Records', description: 'Work with organization records through supported capabilities.', icon: CheckCircle2 },
];

export function DbkExperienceFlow({ onSignIn, onLaunchWorkspace }: Props) {
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<DbkIntent | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);

  const steps = ['Start', 'Intent', 'Solutions', 'Industry', 'Capabilities', 'Enter'];
  const progress = useMemo(() => `${Math.round(((step + 1) / steps.length) * 100)}%`, [step]);

  const next = () => setStep((current) => Math.min(current + 1, steps.length - 1));
  const back = () => setStep((current) => Math.max(current - 1, 0));

  return (
    <main className="min-h-screen bg-[#FBFBF9] text-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-950 text-sm font-bold text-white">T</div>
            <div>
              <div className="font-serif text-sm font-bold">Thuram Digital Bridge Kenya</div>
              <div className="hidden text-[11px] text-neutral-500 sm:block">Organization experience</div>
            </div>
          </div>
          <button onClick={onSignIn} className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:border-neutral-400">
            Sign in
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            <span>Build your organization experience</span>
            <span>{progress}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-neutral-950 transition-all" style={{ width: progress }} />
          </div>
        </div>

        {step === 0 && (
          <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Your organization, your way</p>
              <h1 className="mt-3 max-w-3xl font-serif text-4xl font-bold tracking-tight sm:text-6xl">Tell TDBK what you need.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg">Start with what you are trying to accomplish. TDBK can then take you into the organization setup and Engine-backed capabilities that apply to your context.</p>
              <button onClick={next} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800">Get started <ArrowRight className="h-4 w-4" /></button>
            </div>
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Examples</div>
              <div className="mt-4 space-y-3">
                {['I run a school.', 'I need POS and inventory.', 'I manage a clinic.', 'I provide technical services.'].map((example) => (
                  <div key={example} className="rounded-2xl bg-neutral-50 px-4 py-4 text-sm font-semibold">“{example}”</div>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-emerald-700">01 · Intent</p>
              <h1 className="mt-2 font-serif text-3xl font-bold sm:text-5xl">What are you trying to accomplish?</h1>
              <p className="mt-4 text-neutral-600">This is a presentation step. It does not create an organization or change Engine authority.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {INTENTS.map((item) => {
                const Icon = item.icon;
                const selected = intent === item.id;
                return (
                  <button key={item.id} onClick={() => setIntent(item.id)} className={`rounded-2xl border p-5 text-left transition ${selected ? 'border-neutral-950 bg-neutral-950 text-white shadow-lg' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}>
                    <Icon className="h-5 w-5" />
                    <div className="mt-4 font-bold">{item.title}</div>
                    <p className={`mt-2 text-sm leading-6 ${selected ? 'text-neutral-300' : 'text-neutral-600'}`}>{item.description}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex justify-between"><button onClick={back} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> Back</button><button disabled={!intent} onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Continue <ArrowRight className="h-4 w-4" /></button></div>
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="text-sm font-semibold text-emerald-700">02 · Solutions</p>
            <h1 className="mt-2 font-serif text-3xl font-bold sm:text-5xl">Explore what an organization experience can cover.</h1>
            <p className="mt-4 max-w-2xl text-neutral-600">These are presentation examples, not an entitlement decision. Your actual capabilities are determined by the TDBK Engine after your organization context is established.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {['Run daily operations', 'Manage customers and people', 'Connect supported business services'].map((title) => (
                <div key={title} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"><Sparkles className="h-5 w-5" /><h2 className="mt-5 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-neutral-600">A simple organization-facing experience over Engine-backed operations and capabilities.</p></div>
              ))}
            </div>
            <div className="mt-8 flex justify-between"><button onClick={back} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> Back</button><button onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white">Continue <ArrowRight className="h-4 w-4" /></button></div>
          </section>
        )}

        {step === 3 && (
          <section>
            <p className="text-sm font-semibold text-emerald-700">03 · Industry</p>
            <h1 className="mt-2 font-serif text-3xl font-bold sm:text-5xl">Where does your organization operate?</h1>
            <p className="mt-4 max-w-2xl text-neutral-600">Choose the closest presentation context. The Engine remains authoritative for the actual business blueprint and context.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {INDUSTRIES.map((item) => {
                const Icon = item.icon;
                const selected = industry === item.title;
                return <button key={item.title} onClick={() => setIndustry(item.title)} className={`rounded-2xl border p-5 text-left ${selected ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}><Icon className="h-5 w-5" /><div className="mt-4 font-bold">{item.title}</div><p className={`mt-2 text-sm ${selected ? 'text-neutral-300' : 'text-neutral-600'}`}>{item.description}</p></button>;
              })}
            </div>
            <div className="mt-8 flex justify-between"><button onClick={back} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> Back</button><button disabled={!industry} onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Continue <ArrowRight className="h-4 w-4" /></button></div>
          </section>
        )}

        {step === 4 && (
          <section>
            <p className="text-sm font-semibold text-emerald-700">04 · Capabilities</p>
            <h1 className="mt-2 font-serif text-3xl font-bold sm:text-5xl">See the kinds of capabilities TDBK can support.</h1>
            <p className="mt-4 max-w-2xl text-neutral-600">These cards are informational only. No selection here grants access or creates entitlement. After registration, the Engine determines the authoritative capability state for your organization.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {CAPABILITY_EXAMPLES.map((item) => { const Icon = item.icon; return <div key={item.title} className="rounded-2xl border border-neutral-200 bg-white p-6"><Icon className="h-5 w-5" /><div className="mt-4 font-bold">{item.title}</div><p className="mt-2 text-sm leading-6 text-neutral-600">{item.description}</p></div>; })}
            </div>
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><strong>What happens after registration?</strong><p className="mt-1">Your organization context is established first. Any recommendation or capability activation shown later must come from the authoritative Engine contract.</p></div>
            <div className="mt-8 flex justify-between"><button onClick={back} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> Back</button><button onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white">Continue to registration <ArrowRight className="h-4 w-4" /></button></div>
          </section>
        )}

        {step === 5 && (
          <section className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-950 text-white"><Building2 className="h-6 w-6" /></div>
            <p className="mt-6 text-sm font-semibold text-emerald-700">05 · Registration</p>
            <h1 className="mt-2 font-serif text-3xl font-bold sm:text-5xl">Ready to tell TDBK about your organization?</h1>
            <p className="mt-4 text-neutral-600">Sign in or create your account to continue into the Engine-backed organization setup. Your business context, capabilities and workspace remain under Engine authority.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><button onClick={onSignIn} className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 py-3 text-sm font-semibold text-white">Register / Sign in <ArrowRight className="h-4 w-4" /></button><button onClick={onLaunchWorkspace} className="rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold">I already have an organization</button></div>
          </section>
        )}
      </div>
    </main>
  );
}
