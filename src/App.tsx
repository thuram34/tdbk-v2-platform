import React, { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { DbkApp } from './components/experience/DbkApp';
import { BusinessDiscovery } from './components/onboarding/BusinessDiscovery';
import { LoginScreen } from './components/auth/LoginScreen';
import { PublicGateway } from './public/PublicGateway';
import { useAuth } from './client/AuthContext';
import { listDbks } from './client/masterControlApi';
import LegacyApp from './AppLegacy';

export default function App() {
  const { user, loading } = useAuth();
  const [publicView, setPublicView] = useState<'GATEWAY' | 'LOGIN'>('GATEWAY');
  const [showGateway, setShowGateway] = useState(true);
  const [dbkId, setDbkId] = useState<string | null>(null);
  const [dbksLoading, setDbksLoading] = useState(true);
  const [dbks, setDbks] = useState<any[]>([]);
  const [engineeringMode, setEngineeringMode] = useState(false);

  useEffect(() => {
    if (!user) {
      setDbks([]);
      setDbkId(null);
      return;
    }

    let cancelled = false;

    const loadDbks = async () => {
      setDbksLoading(true);

      try {
        const token = await user.getIdToken();
        const result = await listDbks(token);
        const active = result.filter((dbk) => dbk.status === 'ACTIVE');

        if (!cancelled) {
          setDbks(active);

          if (active.length === 1) {
            setDbkId(active[0].dbkId);
          }
        }
      } catch (error) {
        console.error('Failed to load DBKs:', error);
      } finally {
        if (!cancelled) {
          setDbksLoading(false);
        }
      }
    };

    loadDbks();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (engineeringMode) {
    return <LegacyApp />;
  }

  if (loading) {
    return <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-sm text-neutral-400">Loading TDBK…</div>;
  }

  if (showGateway) {
    return (
      <div className="relative">
        <PublicGateway
          onSignIn={() => {
            setShowGateway(false);
            if (!user) setPublicView('LOGIN');
          }}
          onLaunchWorkspace={() => {
            setShowGateway(false);
            if (!user) setPublicView('LOGIN');
          }}
          onSelectSector={() => {
            setShowGateway(false);
            if (!user) setPublicView('LOGIN');
          }}
        />
        {user && (
          <button
            onClick={() => setShowGateway(false)}
            className="fixed bottom-4 right-4 z-50 rounded-xl bg-neutral-950/90 px-4 py-2 text-xs font-semibold text-white border border-neutral-800"
          >
            Enter My Digital Space →
          </button>
        )}
      </div>
    );
  }

  if (!user) {
    return publicView === 'LOGIN' ? (
      <div className="min-h-screen bg-[#FBFBF9] text-neutral-900">
        <header className="h-16 flex items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
          <button onClick={() => setPublicView('GATEWAY')} className="text-sm font-semibold text-neutral-600">← Return to Public Gateway</button>
          <div className="font-serif font-bold text-sm">Thuram Digital Bridge Kenya</div>
        </header>
        <LoginScreen onBackToGateway={() => setPublicView('GATEWAY')} />
      </div>
    ) : <PublicGateway onSignIn={() => setPublicView('LOGIN')} onSelectSector={() => setPublicView('LOGIN')} />;
  }

  if (dbksLoading) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center text-sm text-neutral-500">
        Loading your businesses…
      </div>
    );
  }

  if (!dbkId && dbks.length === 0) {
    return (
      <>
        <BusinessDiscovery onProvisioned={(id) => {
          setDbkId(id);
          setDbks([{ dbkId: id, status: 'ACTIVE' }]);
        }} />
        <button
          onClick={() => setEngineeringMode(true)}
          title="Engineering console"
          className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white/90 px-3 py-2 text-[10px] font-semibold text-neutral-500 shadow-sm backdrop-blur"
        >
          <Settings2 className="w-3.5 h-3.5" /> Engineering
        </button>
      </>
    );
  }

  if (dbks.length > 1 && !dbkId) {
    const selected = dbks.find((dbk) => dbk.dbkId === dbkId);

    return (
      <div className="min-h-screen bg-[#FBFBF9] p-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold text-neutral-900">
            Your businesses
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Select the business you want to open.
          </p>

          <div className="mt-6 grid gap-3">
            {dbks.map((dbk) => (
              <button
                key={dbk.dbkId}
                onClick={() => setDbkId(dbk.dbkId)}
                className="w-full rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm hover:border-neutral-400"
              >
                <div className="font-semibold text-neutral-900">
                  {dbk.displayName || dbk.legalName}
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  {dbk.sector}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <DbkApp dbkId={dbkId} />;
}
