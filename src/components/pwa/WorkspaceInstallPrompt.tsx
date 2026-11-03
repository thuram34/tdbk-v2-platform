import React, { useEffect, useState } from 'react';
import { useAuth } from '../../client/AuthContext';
import { Download, LogOut, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface WorkspaceInstallPromptProps {
  dbkId: string;
  onLogout: () => Promise<void> | void;
  autoOpen?: boolean;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener(deferredInstallPrompt));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installListeners.forEach((listener) => listener(null));
  });
}

const isStandaloneDisplay = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

export function WorkspaceInstallPrompt({
  dbkId,
  onLogout,
  autoOpen = false,
}: WorkspaceInstallPromptProps) {
  const { getIdToken } = useAuth();
  const [displayName, setDisplayName] = useState(dbkId);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(deferredInstallPrompt);
  const [open, setOpen] = useState(autoOpen && !isStandaloneDisplay());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDisplayName(dbkId);
    void (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const response = await fetch('/api/platform/dbks', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const data = await response.json();
        const dbk = (data.dbks || []).find((item: { dbkId?: string; displayName?: string; legalName?: string; status?: string }) => item.dbkId === dbkId && item.status === 'ACTIVE');
        if (!cancelled && dbk) setDisplayName(dbk.displayName || dbk.legalName || dbkId);
      } catch {
        // Branding is progressive enhancement; workspace access remains unaffected.
      }
    })();
    return () => { cancelled = true; };
  }, [dbkId, getIdToken]);

  useEffect(() => {
    const listener = (event: BeforeInstallPromptEvent | null) => {
      setInstallEvent(event);
      if (event && autoOpen && !isStandaloneDisplay()) setOpen(true);
    };

    installListeners.add(listener);
    if (deferredInstallPrompt) {
      setInstallEvent(deferredInstallPrompt);
      if (autoOpen && !isStandaloneDisplay()) setOpen(true);
    }

    return () => {
      installListeners.delete(listener);
    };
  }, [autoOpen]);

  useEffect(() => {
    if (!autoOpen || isStandaloneDisplay()) return;
    // Make the install surface appear immediately after the successful
    // provisioning transition, even when the browser has not yet emitted
    // beforeinstallprompt. Native installation remains available when the
    // browser provides the event.
    setOpen(true);
  }, [autoOpen, dbkId]);

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) manifest.href = `/manifest.webmanifest?dbk=${encodeURIComponent(dbkId)}`;
    window.localStorage.setItem('tdbk:last-workspace', dbkId);
    window.history.replaceState({}, '', `/?dbk=${encodeURIComponent(dbkId)}`);
  }, [dbkId]);

  const install = async () => {
    if (!installEvent || installing) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
      deferredInstallPrompt = null;
      setOpen(false);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      <div className="fixed right-4 top-4 z-[80] flex items-center gap-2">
        {(!isStandaloneDisplay() && (installEvent || autoOpen)) && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white shadow-xl hover:bg-neutral-800">
            <Smartphone className="h-4 w-4" /> Install {displayName}
          </button>
        )}
        <button type="button" onClick={() => void onLogout()} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3.5 py-2.5 text-xs font-bold text-neutral-800 shadow-lg backdrop-blur hover:bg-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {open && !isStandaloneDisplay() && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-950 text-white"><Download className="h-5 w-5" /></div>
                <h2 className="mt-4 text-xl font-black">{displayName} is ready</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Install <strong>{displayName}</strong> for direct, app-like access to your business workspace. It opens this business instead of the public TDBK landing page.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>

            {installEvent ? (
              <button type="button" onClick={() => void install()} disabled={installing} className="mt-6 w-full rounded-2xl bg-neutral-950 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50">
                {installing ? 'Installing…' : `Install ${displayName}`}
              </button>
            ) : (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Your browser has not exposed its native install action yet. Use the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. This page is already prepared as the workspace installation target.
              </div>
            )}

            <p className="mt-3 text-center text-[11px] leading-5 text-neutral-500">
              Business workspace: {displayName}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
