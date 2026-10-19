import { useEffect, useState } from "react";
import { Download, Wifi, WifiOff, X } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstallEvent(null);
  }

  return (
    <div style={{ position: "fixed", zIndex: 1000, bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", width: "min(100%, 520px)", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "#102b25", color: "#fff", boxShadow: "0 8px 28px #0003", fontSize: 13 }}>
        {online ? <Wifi size={18} /> : <WifiOff size={18} />}
        <span style={{ flex: 1 }}>{installed ? "Chemist Pro is installed" : online ? "Install Chemist Pro for app-like access" : "Offline — saved app shell available; sync is not enabled"}</span>
        {!installed && installEvent && !dismissed && <button onClick={install} style={{ border: 0, borderRadius: 9, padding: "8px 10px", background: "#b6f2d8", color: "#103d2d", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}><Download size={15} /> Install</button>}
        {!installed && !installEvent && !dismissed && <span style={{ opacity: .8 }}>Use browser menu → Install app / Add to Home screen</span>}
        {!installed && <button aria-label="Dismiss install tip" onClick={() => setDismissed(true)} style={{ border: 0, background: "transparent", color: "#fff", padding: 4, cursor: "pointer" }}><X size={16} /></button>}
      </div>
    </div>
  );
}
