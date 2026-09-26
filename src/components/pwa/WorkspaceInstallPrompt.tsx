import React, { useEffect, useState } from 'react';
import { Download, LogOut, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface WorkspaceInstallPromptProps {
  dbkId: string;
  onLogout: () => Promise<void> | void;
}

export function WorkspaceInstallPrompt({ dbkId, onLogout }: WorkspaceInstallPromptProps) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const install = async () => {
    if (!installEvent || installing) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
      setOpen(false);
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) manifest.href = `/manifest.webmanifest?dbk=${encodeURIComponent(dbkId)}`;
    window.history.replaceState({}, '', `/?dbk=${encodeURIComponent(dbkId)}`);
  }, [dbkId]);

  return (
    <>
      <div className="fixed right-4 top-4 z-[80] flex items-center gap-2">
        {installEvent && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white shadow-xl hover:bg-neutral-800">
            <Smartphone className="h-4 w-4" /> Install workspace
          </button>
        )}
        <button type="button" onClick={() => void onLogout()} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3.5 py-2.5 text-xs font-bold text-neutral-800 shadow-lg backdrop-blur hover:bg-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {open && installEvent && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-950 text-white"><Download className="h-5 w-5" /></div>
                <h2 className="mt-4 text-xl font-black">Install this workspace</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">Put this business workspace on your phone or computer for direct access. The installed entry opens this provisioned business, not the public TDBK landing page.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => void install()} disabled={installing} className="mt-6 w-full rounded-2xl bg-neutral-950 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50">{installing ? 'Installing…' : 'Add TDBK to my device'}</button>
            <p className="mt-3 text-center text-[11px] leading-5 text-neutral-500">If your browser does not offer installation here, use the browser menu and choose “Install app” or “Add to Home screen”.</p>
          </div>
        </div>
      )}
    </>
  );
}
