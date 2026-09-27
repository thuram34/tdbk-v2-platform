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
  const [idToken, setIdToken] = useState('');
  const [dbksLoading, setDbksLoading] = useState(true);
  const [dbks, setDbks] = useState<DbkIdentity[]>([]);
  const [dbksError, setDbksError] = useState<string | null>(null);
  const [showSokoni, setShowSokoni] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sokoni') === '1');
  const [showSokoniBusiness, setShowSokoniBusiness] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sokoniBusiness') === '1');

  const loadDbks = useCallback(async () => {
    if (!user) {
    if (publicView === 'FLOW') {
      return (
        <div className="relative">
          <PublicGateway
            onSignIn={() => setPublicView('LOGIN')}
            onSelectSector={() => setPublicView('LOGIN')}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FBFBF9] text-neutral-900">
        <header className="h-16 flex items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
          <button onClick={() => setPublicView('FLOW')} className="text-sm font-semibold text-neutral-600">← Return to TDBK</button>
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
    return <DbkApp dbkId={dbkId} onLogout={async () => { await signOutUser(); window.history.replaceState({}, '', window.location.pathname); }} />;
  }

  return (
    <>
      <OwnerCommandCenter
        userEmail={user.email}
        dbks={dbks}
        idToken={idToken}
        loading={dbksLoading}
        onRefresh={loadDbks}
        onAddOrganization={addOrganization}
        onOpenOrganization={openOrganization}
        onOpenSokoni={enterSokoni}
        onLogout={async () => { await signOutUser(); window.history.replaceState({}, '', window.location.pathname); }}
      />
    </>
  );
}
