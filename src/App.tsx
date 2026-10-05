import React, { useCallback, useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { DbkApp } from './components/experience/DbkApp';
import { OwnerCommandCenter } from './components/master/OwnerCommandCenter';
import { BusinessDiscovery } from './components/onboarding/BusinessDiscovery';
import { LoginScreen } from './components/auth/LoginScreen';
import { PublicGateway } from './public/PublicGateway';
import { SokoniExperience } from './sokoni/SokoniExperience';
import { SokoniBusinessRegistration } from './sokoni/SokoniBusinessRegistration';
import { useAuth } from './client/AuthContext';
import { listDbks } from './client/masterControlApi';
import type { DbkIdentity } from './platform/types';

type PublicView = 'FLOW' | 'LOGIN';

export default function App() {
  const { user, loading, signOutUser } = useAuth();
  const [publicView, setPublicView] = useState<PublicView>('FLOW');
  const [showBusinessDiscovery, setShowBusinessDiscovery] = useState(false);
  const [dbkId, setDbkId] = useState<string | null>(null);
  const [justProvisioned, setJustProvisioned] = useState(false);
  const [idToken, setIdToken] = useState('');
  const [dbksLoading, setDbksLoading] = useState(true);
  const [dbks, setDbks] = useState<DbkIdentity[]>([]);
  const [dbksError, setDbksError] = useState<string | null>(null);
  const [showSokoni, setShowSokoni] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sokoni') === '1');
  const [showSokoniBusiness, setShowSokoniBusiness] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sokoniBusiness') === '1');

  const loadDbks = useCallback(async () => {
    if (!user) {
      setDbks([]);
      setDbkId(null);
      setIdToken('');
      setDbksLoading(false);
      return;
    }

    setDbksLoading(true);
    setDbksError(null);

    try {
      const token = await user.getIdToken();
      setIdToken(token);
      const result = await listDbks(token);
      setDbks(result);
      const requestedDbk = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('dbk')
        : null;
      if (requestedDbk && result.some((dbk) => dbk.dbkId === requestedDbk)) {
        setDbkId(requestedDbk);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      setDbksError('We could not load your organizations. Please try again.');
    } finally {
      setDbksLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setDbks([]);
      setDbkId(null);
      setIdToken('');
      setShowBusinessDiscovery(false);
      setDbksLoading(false);
      return;
    }

    void loadDbks();
  }, [user, loadDbks]);

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

  const openOrganization = (id: string) => {
    setDbkId(id);
  };

  const addOrganization = () => {
    setDbkId(null);
    setShowBusinessDiscovery(true);
  };

  if (showSokoni) {
    if (showSokoniBusiness) {
      return <SokoniBusinessRegistration onExit={exitSokoniBusiness} />;
    }

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

  if (!user) {
    if (publicView === 'FLOW') {
      return (
        <div className="relative">
          <PublicGateway
            onSignIn={() => setPublicView('LOGIN')}
            onSelectSector={() => setPublicView('LOGIN')}
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

    return (
      <div className="min-h-screen bg-[#FBFBF9] text-neutral-900">
        <header className="h-16 flex items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
          <button onClick={() => setPublicView('FLOW')} className="text-sm font-semibold text-neutral-600">
            ← Return to TDBK
          </button>
          <div className="font-serif font-bold text-sm">Thuram Digital Bridge Kenya</div>
        </header>
        <LoginScreen onBackToGateway={() => setPublicView('FLOW')} />
      </div>
    );
  }

  if (showBusinessDiscovery) {
    return (
      <BusinessDiscovery
        onProvisioned={async (provisionedDbkId: string) => {
          setShowBusinessDiscovery(false);
          setJustProvisioned(true);
          setDbkId(provisionedDbkId);
          await loadDbks();
        }}
      />
    );
  }

  if (dbksError) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] px-4 py-12 text-neutral-900">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <CircleAlert className="mx-auto h-8 w-8 text-red-600" />
          <h1 className="mt-4 text-xl font-bold">Your organizations could not be loaded</h1>
          <p className="mt-2 text-sm text-neutral-600">{dbksError}</p>
          <button onClick={() => void loadDbks()} className="mt-6 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white">Try again</button>
        </div>
      </div>
    );
  }

  if (dbksLoading) {
    return <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center text-sm text-neutral-500">Loading your organizations…</div>;
  }

  if (dbkId) {
    return (
      <DbkApp
        dbkId={dbkId}
        autoOpenInstall={justProvisioned}
        onLogout={async () => {
          await signOutUser();
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  return (
    <OwnerCommandCenter
      userEmail={user.email}
      dbks={dbks}
      idToken={idToken}
      loading={dbksLoading}
      onRefresh={loadDbks}
      onAddOrganization={addOrganization}
      onOpenOrganization={openOrganization}
      onOpenSokoni={enterSokoni}
      onLogout={async () => {
        await signOutUser();
        window.history.replaceState({}, '', window.location.pathname);
      }}
    />
  );
}
