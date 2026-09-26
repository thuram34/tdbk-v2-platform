import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, CircleAlert } from 'lucide-react';
import { DbkApp } from './components/experience/DbkApp';
import { BusinessDiscovery } from './components/onboarding/BusinessDiscovery';
import { LoginScreen } from './components/auth/LoginScreen';
import { DbkExperienceFlow } from './public/DbkExperienceFlow';
import { SokoniExperience } from './sokoni/SokoniExperience';
import { SokoniBusinessRegistration } from './sokoni/SokoniBusinessRegistration';
import LegacyApp from './AppLegacy';
import { useAuth } from './client/AuthContext';
import { listDbks } from './client/masterControlApi';

type DbkSummary = {
  dbkId: string;
  status?: string;
  displayName?: string;
  legalName?: string;
  sector?: string;
  [key: string]: unknown;
};

const statusMeta = (status?: string) => {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 };
    case 'PROVISIONING':
    case 'PENDING':
      return { label: 'Setting up', tone: 'text-amber-700 bg-amber-50 border-amber-200', icon: Clock3 };
    case 'ERROR':
    case 'FAILED':
      return { label: 'Needs attention', tone: 'text-red-700 bg-red-50 border-red-200', icon: CircleAlert };
    case 'INACTIVE':
      return { label: 'Inactive', tone: 'text-neutral-600 bg-neutral-100 border-neutral-200', icon: Clock3 };
    default:
      return { label: status || 'Status unavailable', tone: 'text-neutral-600 bg-neutral-100 border-neutral-200', icon: Clock3 };
  }
};

export default function App() {
  const { user, loading } = useAuth();
  const [publicView, setPublicView] = useState<'FLOW' | 'LOGIN'>('FLOW');
  const [showPublicFlow, setShowPublicFlow] = useState(true);
  const [dbkId, setDbkId] = useState<string | null>(null);
  const [dbksLoading, setDbksLoading] = useState(true);
  const [dbks, setDbks] = useState<DbkSummary[]>([]);
  const [dbksError, setDbksError] = useState<string | null>(null);
  const [showSokoni, setShowSokoni] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sokoni') === '1');
  const [showSokoniBusiness, setShowSokoniBusiness] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sokoniBusiness') === '1');
  const [engineeringMode, setEngineeringMode] = useState(false);

  useEffect(() => {
    if (!user) {
      setDbks([]);
      setDbkId(null);
      setDbksLoading(false);
      return;
    }

    let cancelled = false;

    const loadDbks = async () => {
      setDbksLoading(true);
      setDbksError(null);

      try {
        const token = await user.getIdToken();
        const result = await listDbks(token);
        if (cancelled) return;

        const summaries: DbkSummary[] = result.map((dbk) => ({
          dbkId: dbk.dbkId,
          status: dbk.status,
          displayName: dbk.displayName,
          legalName: dbk.legalName,
          sector: dbk.sector,
        }));
        setDbks(summaries);
        const active = summaries.filter((dbk) => dbk.status === 'ACTIVE');
        if (active.length === 1 && result.length === 1) {
          setDbkId(active[0].dbkId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load organizations:', error);
          setDbksError('We could not load your organizations. Please try again.');
        }
      } finally {
        if (!cancelled) setDbksLoading(false);
      }
    };

    loadDbks();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const enterSokoni = () => {
    setShowSokoniBusiness(false);
    setShowSokoni(true);
    window.history.pushState({}, '', '?sokoni=1');
  };

  const enterSokoniBusiness = () => {
    setShowSokoni(true);
    setShowSokoniBusiness(true);
    window.history.pushState({}, '', '?sokoni=1&sokoniBusiness=1');
  };

  const exitSokoniBusiness = () => {
    setShowSokoniBusiness(false);
    setShowSokoni(true);
    window.history.pushState({}, '', '?sokoni=1');
  };

  const exitSokoni = () => {
    setShowSokoniBusiness(false);
    setShowSokoni(false);
    window.history.pushState({}, '', window.location.pathname);
  };

  if (engineeringMode) return <LegacyApp />;

  if (showSokoni) {
    if (showSokoniBusiness) return <SokoniBusinessRegistration onExit={exitSokoniBusiness} />;
    return (
      <>
        <SokoniExperience onBack={exitSokoni} />
        <button
          type="button"
          onClick={enterSokoniBusiness}
          className="fixed bottom-20 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-3 text-xs font-black text-white shadow-xl transition hover:-translate-y-0.5 sm:bottom-5 sm:right-5"
        >
          List your presence on Sokoni →
        </button>
      </>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center text-sm text-neutral-500">Opening TDBK…</div>;
  }

  if (showPublicFlow) {
    return (
      <div className="relative">
        <DbkExperienceFlow
        onSignIn={() => {
          setShowPublicFlow(false);
          if (!user) setPublicView('LOGIN');
        }}
        onLaunchWorkspace={() => {
          setShowPublicFlow(false);
          if (!user) setPublicView('LOGIN');
        }}
        />
        <button
          type="button"
          onClick={enterSokoni}
          className="fixed bottom-4 left-4 z-50 rounded-full border border-neutral-300 bg-white/95 px-4 py-2.5 text-xs font-bold text-neutral-900 shadow-lg backdrop-blur"
        >
          Discover with Sokoni →
        </button>
      </div>
    );
  }

  if (!user) {
    return publicView === 'LOGIN' ? (
      <div className="min-h-screen bg-[#FBFBF9] text-neutral-900">
        <header className="h-16 flex items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
          <button onClick={() => { setPublicView('FLOW'); setShowPublicFlow(true); }} className="text-sm font-semibold text-neutral-600">← Return to TDBK</button>
          <div className="font-serif font-bold text-sm">Thuram Digital Bridge Kenya</div>
        </header>
        <LoginScreen onBackToGateway={() => { setPublicView('FLOW'); setShowPublicFlow(true); }} />
      </div>
    ) : (
      <div className="relative">
        <DbkExperienceFlow onSignIn={() => setPublicView('LOGIN')} onLaunchWorkspace={() => setPublicView('LOGIN')} />
        <button
          type="button"
          onClick={enterSokoni}
          className="fixed bottom-4 left-4 z-50 rounded-full border border-neutral-300 bg-white/95 px-4 py-2.5 text-xs font-bold text-neutral-900 shadow-lg backdrop-blur"
        >
          Discover with Sokoni →
        </button>
      </div>
    );
  }

  if (dbksLoading) {
    return <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center text-sm text-neutral-500">Loading your organizations…</div>;
  }

  if (dbksError) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] px-4 py-12 text-neutral-900">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <CircleAlert className="mx-auto h-8 w-8 text-red-600" />
          <h1 className="mt-4 text-xl font-bold">Your organizations could not be loaded</h1>
          <p className="mt-2 text-sm text-neutral-600">{dbksError}</p>
          <button onClick={() => setShowPublicFlow(true)} className="mt-6 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white">Return to TDBK</button>
        </div>
      </div>
    );
  }

  if (dbks.length === 0) {
    return (
      <>
        <BusinessDiscovery
          onProvisioned={(id) => {
            setDbkId(id);
            setDbks([{ dbkId: id, status: 'PROVISIONING' }]);
          }}
        />
        <button
          onClick={() => setEngineeringMode(true)}
          className="fixed bottom-4 left-4 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[10px] font-semibold text-neutral-500 shadow-sm"
        >
          Engineering
        </button>
      </>
    );
  }

  if (!dbkId) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] px-4 py-8 text-neutral-900 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Owner / Operator</p>
              <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">My Organizations</h1>
              <p className="mt-2 text-sm text-neutral-600">Choose an organization to continue. Every status below comes from TDBK.</p>
            </div>
            <button onClick={() => { setDbks([]); setShowPublicFlow(false); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white">Add organization <ArrowRight className="h-4 w-4" /></button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {dbks.map((dbk) => {
              const meta = statusMeta(dbk.status);
              const Icon = meta.icon;
              return (
                <button key={dbk.dbkId} onClick={() => dbk.status === 'ACTIVE' && setDbkId(dbk.dbkId)} disabled={dbk.status !== 'ACTIVE'} className="w-full rounded-3xl border border-neutral-200 bg-white p-6 text-left shadow-sm transition enabled:hover:border-neutral-400 enabled:hover:shadow-md disabled:cursor-default">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-bold">{dbk.displayName || dbk.legalName || 'Organization'}</div>
                      <div className="mt-1 text-sm text-neutral-500">{dbk.sector || 'Organization'}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}><Icon className="h-3.5 w-3.5" />{meta.label}</span>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-sm">
                    {dbk.status === 'ACTIVE' ? <span className="font-semibold text-neutral-900">Open organization</span> : <span className="text-neutral-500">This organization is not ready to open yet.</span>}
                    {dbk.status === 'ACTIVE' && <ArrowRight className="h-4 w-4" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return <DbkApp dbkId={dbkId} />;
}
