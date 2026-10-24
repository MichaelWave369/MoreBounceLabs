import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BackspinDecks } from "./components/BackspinDecks";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./styles.css";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
type OfflineState = "idle" | "preparing" | "ready" | "error";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Backspin96 needs a #root element to render.");
}

const home = import.meta.env.BASE_URL;

function StandaloneBooth() {
  const [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineState, setOfflineState] = useState<OfflineState>("idle");
  const [progress, setProgress] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    setInstalled(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let cancelled = false;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register(home + "backspin96-sw.js", { scope: home })
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          if (!cancelled) setWorkerReady(Boolean(registration.active));
        })
        .catch(() => {
          if (!cancelled) setWorkerError("Offline preparation is not available in this browser.");
        });
    } else {
      setWorkerError("This browser does not support offline app caching.");
    }
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function installApp() {
    const event = installPrompt;
    if (!event) return;
    setInstallPrompt(null);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome !== "accepted") setOfflineMessage("Installation was cancelled. You can still use the booth in your browser.");
    } catch {
      setOfflineMessage("Use your browser's Install app or Add to Home Screen menu.");
    }
  }

  async function prepareOffline() {
    if (!workerReady || offlineState === "preparing" || !online) return;
    setOfflineState("preparing");
    setOfflineMessage("");
    setProgress("Preparing DJ booth files…");
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) throw new Error("Offline service is not ready.");
      const result = await new Promise<number>((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = window.setTimeout(() => {
          channel.port1.close();
          reject(new Error("Offline download timed out. Check your connection."));
        }, 120000);
        channel.port1.onmessage = (event: MessageEvent) => {
          const data = event.data;
          if (data?.type === "progress") {
            setProgress("Saving booth resources " + data.done + "/" + data.total);
          } else if (data?.type === "ready") {
            clearTimeout(timer);
            channel.port1.close();
            resolve(data.total);
          } else if (data?.type === "error") {
            clearTimeout(timer);
            channel.port1.close();
            reject(new Error(String(data.detail || "Offline preparation failed.")));
          }
        };
        registration.active!.postMessage({ type: "BACKSPIN_OFFLINE_PREPARE" }, [channel.port2]);
      });
      setOfflineState("ready");
      setOfflineMessage("Saved " + result + " app resources on this device. Local music files stay yours.");
    } catch (error) {
      setOfflineState("error");
      setOfflineMessage(error instanceof Error ? error.message : "Could not save offline resources.");
    }
  }

  return (
    <div className="min-h-screen bg-bg text-cream">
      <header className="border-b border-line bg-bg/95">
        <div className="mx-auto flex max-w-[1760px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">Independent DJ performance space</p>
            <p className="font-display text-2xl tracking-tight">BackSpin96</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {installPrompt && !installed && (
              <button type="button" onClick={() => void installApp()}
                className="min-h-11 rounded-full border border-fuchsia-400/60 bg-fuchsia-500/15 px-4 text-sm font-semibold text-fuchsia-100">
                Install BackSpin96
              </button>
            )}
            <a href={home} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm">
              MoreBounceLabs ↗
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1760px] px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/30 bg-[#1b1026] px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-fuchsia-300">BackSpin96 · Performance-ready setup</p>
            <p className="mt-1 text-sm text-mist">
              {installed ? "Installed DJ booth" : "Install from your browser menu to launch like an app"} ·
              {online ? " Online" : " Offline: saved resources only"}
            </p>
          </div>
          <button type="button" disabled={!workerReady || !online || offlineState === "preparing"}
            onClick={() => void prepareOffline()}
            className="min-h-11 rounded-xl border border-cyan-400/50 bg-cyan-950/30 px-4 text-sm text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
            {offlineState === "preparing" ? progress : offlineState === "ready" ? "Refresh offline copy" : "Prepare offline booth"}
          </button>
          <p role="status" aria-live="polite" className="w-full text-xs text-mist">
            {offlineMessage || workerError ||
              "Offline preparation saves the app and DJ engine, not your music. Test without internet before a live set."}
          </p>
        </div>
        <BackspinDecks standalone />
      </main>

      <footer className="mx-auto max-w-[1760px] px-4 pb-8 text-xs text-mist">
        BackSpin96 loads local audio only when you choose it. Mixing and playback remain under your control.
        Browser storage may be cleared by the device, so offline use is not guaranteed until tested.
      </footer>
    </div>
  );
}

createRoot(root).render(
  <AppErrorBoundary>
    <StandaloneBooth />
  </AppErrorBoundary>,
);
