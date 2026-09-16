import React, { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { DbkShell } from './components/experience/DbkShell';
import { BusinessDiscovery } from './components/onboarding/BusinessDiscovery';
import { LoginScreen } from './components/auth/LoginScreen';
import { PublicGateway } from './public/PublicGateway';
import { useAuth } from './client/AuthContext';
import LegacyApp from './AppLegacy';

export default function App() {
  const { user, loading } = useAuth();
  const [publicView, setPublicView] = useState<'GATEWAY' | 'LOGIN'>('GATEWAY');
  const [showGateway, setShowGateway] = useState(true);
  const [dbkId, setDbkId] = useState<string | null>(null);
  const [engineeringMode, setEngineeringMode] = useState(false);

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

  if (!dbkId) {
    return (
      <>
        <BusinessDiscovery onProvisioned={setDbkId} />
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

  return <DbkShell initialDbkId={dbkId} initialViewMode="WORKSPACE" onSwitchToMaster={() => setEngineeringMode(true)} />;
}
