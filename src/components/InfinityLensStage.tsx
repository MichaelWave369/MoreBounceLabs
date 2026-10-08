import { useEffect, useRef, useState } from "react";
import {
  BRIDGE_MODES, BRIDGE_PALETTES, LENS_ORIGIN, LENS_URL,
  bridgeCommand, bridgeHello, isBridgeAck, isBridgeReady,
  type BridgeAction,
} from "@/lib/infinityBridge";

type LinkState = "idle" | "waiting" | "connected" | "unavailable";
type LensMode = typeof BRIDGE_MODES[number][0];
type LensPalette = typeof BRIDGE_PALETTES[number][0];

export function InfinityLensStage({ reduced }: { reduced: boolean }) {
  const [launched, setLaunched] = useState(false);
  const [session, setSession] = useState(0);
  const [status, setStatus] = useState<LinkState>("idle");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<LensMode>("cosmic-drift");
  const [palette, setPalette] = useState<LensPalette>("aurora-phi");
  const frame = useRef<HTMLIFrameElement>(null);
  const sequence = useRef(0);
  const outstanding = useRef(new Map<string, BridgeAction>());

  useEffect(() => {
    // Lab now owns only InfinityLens. Launch automatically when entering the
    // room instead of making visitors click through a second empty stage.
    // Respect both the parent setting and the browser media query before
    // mounting the extra WebGL renderer.
    if (reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLaunched(false);
      setStatus("idle");
      return;
    }
    setLaunched(true);
  }, [reduced]);

  useEffect(() => {
    if (!launched || reduced) return;
    setStatus("waiting");
    outstanding.current.clear();
    const onMessage = (event: MessageEvent<unknown>) => {
      // Never accept messages from other tabs, other iframes, or other origins.
      if (event.source !== frame.current?.contentWindow || event.origin !== LENS_ORIGIN) return;
      if (isBridgeReady(event.data)) {
        setMode(event.data.mode);
        setPalette(event.data.palette);
        setStatus("connected");
        setMessage("Visual controls connected to InfinityLens369.");
      } else if (isBridgeAck(event.data)) {
        const action = outstanding.current.get(event.data.requestId);
        if (action !== event.data.action) return;
        outstanding.current.delete(event.data.requestId);
        setMessage("InfinityLens accepted the " + action + " command.");
      }
    };
    window.addEventListener("message", onMessage);
    const timeout = window.setTimeout(() => {
      setStatus((current) => current === "waiting" ? "unavailable" : current);
      setMessage((current) => current === "" ? "Visual bridge did not respond. The original InfinityLens player can still be used below." : current);
    }, 8000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
      outstanding.current.clear();
    };
  }, [launched, reduced, session]);

  function openLens() {
    setMessage("");
    setStatus("waiting");
    setLaunched(true);
  }

  function stopLens() {
    setLaunched(false);
    setStatus("idle");
    setSession((n) => n + 1);
    setMessage("InfinityLens stopped; its WebGL renderer has been unloaded.");
  }

  function onFrameLoad() {
    frame.current?.contentWindow?.postMessage(bridgeHello(), LENS_ORIGIN);
  }

  function send(action: BridgeAction, value?: string) {
    if (status !== "connected") return;
    const requestId = "mbl-" + (++sequence.current);
    const command = bridgeCommand(action, value, requestId);
    if (!command) {
      setMessage("That scene command was rejected locally.");
      return;
    }
    const target = frame.current?.contentWindow;
    if (!target) return;
    outstanding.current.set(requestId, action);
    target.postMessage(command, LENS_ORIGIN);
    setMessage("Sent " + action + " command; waiting for InfinityLens acknowledgment.");
  }

  function fullScreen() {
    const element = frame.current;
    if (!element?.requestFullscreen) {
      setMessage("Fullscreen isn't supported here. Open InfinityLens in its own tab.");
      return;
    }
    void element.requestFullscreen().catch(() => setMessage("Fullscreen blocked. Open InfinityLens in its own tab."));
  }

  return (
    <section className="rounded-3xl border border-amber/40 bg-surface p-4 sm:p-6" aria-label="InfinityLens369 visual lab">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">MoreBounceLabs · InfinityLens369</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Infinity Lab</h1>
          <p className="mt-2 max-w-3xl text-sm text-mist">
            One portal, one visual engine. Explore the original InfinityLens fractal world
            with scene and palette controls connected through the governed visual bridge.
          </p>
        </div>
        <a className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-cream"
          href={LENS_URL} target="_blank" rel="noopener noreferrer">Open InfinityLens standalone ↗</a>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!launched ? (
          <button type="button" className="min-h-11 rounded-full bg-heat px-5 font-semibold text-cream"
            onClick={openLens} disabled={reduced}>Launch InfinityLens</button>
        ) : (
          <>
            <button type="button" className="min-h-11 rounded-full bg-heat px-5 font-semibold text-cream"
              onClick={stopLens}>Stop InfinityLens</button>
            <button type="button" className="min-h-11 rounded-full border border-line px-4 text-sm"
              onClick={fullScreen}>Fullscreen InfinityLens</button>
          </>
        )}
        <span role="status" aria-live="polite" className="text-xs text-mist">
          {reduced ? "Reduced-motion preference: the stage is disabled." :
            status === "connected" ? "● Visual bridge connected" :
            status === "waiting" ? "Connecting to InfinityLens…" :
            status === "unavailable" ? "Visual bridge unavailable; standalone visuals still work" : "InfinityLens waiting to launch"}
        </span>
      </div>

      {launched && !reduced && (
        <div className="mt-4 rounded-2xl border border-line bg-bg p-3 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber">MBL Scene Controls</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <label className="flex flex-col gap-1 text-sm text-mist">
              Fractal scene
              <select className="min-h-11 rounded-xl border border-line bg-surface px-3 text-cream" value={mode}
                disabled={status !== "connected"}
                onChange={(event) => send("mode", event.currentTarget.value)}>
                {BRIDGE_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-mist">
              Color palette
              <select className="min-h-11 rounded-xl border border-line bg-surface px-3 text-cream" value={palette}
                disabled={status !== "connected"}
                onChange={(event) => send("palette", event.currentTarget.value)}>
                {BRIDGE_PALETTES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="button" disabled={status !== "connected"}
              className="min-h-11 rounded-xl border border-line bg-raised px-4 text-sm text-cream disabled:opacity-40"
              onClick={() => send("safe")}>Safe mode</button>
            <button type="button" disabled={status !== "connected"}
              className="min-h-11 rounded-xl border border-line bg-raised px-4 text-sm text-cream disabled:opacity-40"
              onClick={() => send("reset")}>Reset visuals</button>
          </div>
          <p className="mt-2 text-xs text-mist" role="status">{message || "Waiting for the embedded visualizer to report its supported controls."}</p>
        </div>
      )}

      {launched && !reduced ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-bg">
          <iframe key={session} ref={frame} onLoad={onFrameLoad}
            title="InfinityLens369 interactive fractal visualizer" src={LENS_URL}
            allow="fullscreen" allowFullScreen loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            className="block h-[560px] w-full bg-bg sm:h-[740px] xl:h-[840px]" />
        </div>
      ) : (
        <div className="mt-4 flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-bg p-5 text-center">
          <span className="font-display text-3xl text-amber" aria-hidden>∞</span>
          <p className="font-display text-xl">Portal on standby</p>
          <p className="max-w-md text-xs text-mist">{reduced
            ? "Reduced-motion is enabled. You can open InfinityLens in its own tab to adjust motion settings."
            : "InfinityLens is stopped. Launch the original visual engine whenever you're ready."}</p>
        </div>
      )}
      <p className="mt-3 text-xs text-mist">
        Bridge v1 changes visual scenes only. Suno playback runs in a separate iframe and cannot provide beat, bass,
        playback time or waveform data to this bridge. To get true audio reactivity, use authorized native music files
        in a future opt-in audio integration.
      </p>
    </section>
  );
}
