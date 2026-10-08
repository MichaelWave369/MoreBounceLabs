import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Disc3, Headphones, Maximize2, Pause, Play, RotateCcw, ShieldAlert } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const BOOTH_URL = `${BASE}backspin96/`;
const MANIFEST_URL = `${BOOTH_URL}mbl-stage.json`;
const POSTER_URL = `${BASE}backspin96-poster.png`;
type Deck = "A" | "B";
type BoothStatus = "checking" | "ready" | "missing";
type Snapshot = {
  ready: boolean;
  A: { loaded: boolean; title: string; playing: boolean };
  B: { loaded: boolean; title: string; playing: boolean };
  crossfader: number;
};
type BackspinAdapter = {
  version: number;
  snapshot: () => Snapshot;
  scratch: (deckId: Deck, ratio: number) => boolean;
  release: (deckId: Deck) => boolean;
};
type BackspinWindow = Window & { __MBL_BACKSPIN?: BackspinAdapter };
type ScratchGesture = { id: number; lastAngle: number; lastTime: number; moved: boolean };

const EMPTY: Snapshot = {
  ready: false, A: { loaded: false, title: "", playing: false },
  B: { loaded: false, title: "", playing: false }, crossfader: 0,
};
const pos = (left: number, top: number, width: number, height: number): CSSProperties => ({
  left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
});
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

export function BackspinDecks() {
  const [status, setStatus] = useState<BoothStatus>("checking");
  const [bridgeReady, setBridgeReady] = useState(false);
  const [posterReady, setPosterReady] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [xfade, setXfade] = useState(0);
  const iframe = useRef<HTMLIFrameElement>(null);
  const gestures = useRef<Record<Deck, ScratchGesture | null>>({ A: null, B: null });
  const ignoreClick = useRef<Record<Deck, boolean>>({ A: false, B: false });
  const updatedValue = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(MANIFEST_URL, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return false;
        const manifest: unknown = await res.json();
        return Boolean(manifest && typeof manifest === "object"
          && (manifest as Record<string, unknown>).engine === "Backspin96"
          && (manifest as Record<string, unknown>).sourceVersion === "1.5.0"
          && (manifest as Record<string, unknown>).overlayBridgeVersion === 1);
      })
      .then((ok) => { if (!cancelled) setStatus(ok ? "ready" : "missing"); })
      .catch(() => { if (!cancelled) setStatus("missing"); });
    return () => { cancelled = true; };
  }, []);

  function adapter(): BackspinAdapter | null {
    try {
      const view = iframe.current?.contentWindow as BackspinWindow | null;
      const b = view?.__MBL_BACKSPIN;
      // Same-origin iframe: this is deliberate access to OUR copy of Backspin.
      return b?.version === 1 ? b : null;
    } catch { return null; }
  }

  function documentOfBooth(): Document | null {
    try { return iframe.current?.contentDocument || null; } catch { return null; }
  }

  useEffect(() => {
    if (status !== "ready") return;
    const refresh = () => {
      const b = adapter();
      setBridgeReady(Boolean(b));
      if (!b) return;
      try {
        const value = b.snapshot();
        setSnapshot(value);
        // Don't wrestle a DJ who is actively dragging the crossfader.
        if (Date.now() - updatedValue.current > 1500) setXfade(value.crossfader);
      } catch {
        setBridgeReady(false);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 650);
    return () => window.clearInterval(interval);
  }, [status, resetKey]);

  function command(id: string, label: string): boolean {
    const control = documentOfBooth()?.getElementById(id);
    // Elements belong to the iframe's JS realm: parent instanceof checks fail.
    const element = control as (HTMLElement & { disabled?: boolean }) | null;
    if (!element || typeof element.click !== "function" || element.disabled) {
      setNotice(`${label} is not available yet. Start Dual Audio and load your own track first.`);
      return false;
    }
    element.click();
    setNotice(`${label} sent to the original Backspin '96 engine.`);
    return true;
  }

  function changeRange(id: string, value: number) {
    const control = documentOfBooth()?.getElementById(id);
    if (!control || control.tagName !== "INPUT" || (control as HTMLInputElement).disabled) {
      setNotice("Start Dual Audio before using the battle mixer.");
      return;
    }
    const input = control as HTMLInputElement;
    input.value = String(value);
    const EventClass = input.ownerDocument.defaultView?.Event ?? Event;
    input.dispatchEvent(new EventClass("input", { bubbles: true }));
  }

  function crossfade(value: number) {
    updatedValue.current = Date.now();
    setXfade(value);
    changeRange("crossfader", value);
  }

  function platterAngle(event: ReactPointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientY - (rect.top + rect.height / 2),
      event.clientX - (rect.left + rect.width / 2));
  }
  function startScratch(event: ReactPointerEvent<HTMLButtonElement>, deck: Deck) {
    if (!snapshot.ready || !snapshot[deck].loaded || !adapter()) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gestures.current[deck] = {
      id: event.pointerId, lastAngle: platterAngle(event), lastTime: performance.now(), moved: false,
    };
    ignoreClick.current[deck] = false;
  }
  function moveScratch(event: ReactPointerEvent<HTMLButtonElement>, deck: Deck) {
    const gesture = gestures.current[deck];
    if (!gesture || gesture.id !== event.pointerId) return;
    const angle = platterAngle(event);
    let delta = angle - gesture.lastAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    const now = performance.now();
    const dt = Math.max(0.005, (now - gesture.lastTime) / 1000);
    gesture.lastAngle = angle;
    gesture.lastTime = now;
    if (Math.abs(delta) > 0.007) {
      gesture.moved = true;
      ignoreClick.current[deck] = true;
      // 33 1/3 RPM nominal; the original AudioWorklet owns the scratch physics.
      const ratio = clamp((delta / dt) / (2 * Math.PI * (33.333 / 60)), -4, 4);
      adapter()?.scratch(deck, ratio);
      event.preventDefault();
    }
  }
  function endScratch(event: ReactPointerEvent<HTMLButtonElement>, deck: Deck) {
    const g = gestures.current[deck];
    if (!g || g.id !== event.pointerId) return;
    if (g.moved) adapter()?.release(deck);
    gestures.current[deck] = null;
  }
  function platterClick(deck: Deck) {
    if (ignoreClick.current[deck]) { ignoreClick.current[deck] = false; return; }
    command(deck.toLowerCase() + "-play", "Deck " + deck + " Play/Pause");
  }
  function reloadBooth() {
    setSnapshot(EMPTY); setBridgeReady(false);
    setResetKey((n) => n + 1);
    setNotice("Original booth reloaded. Save/export recordings first, as unsaved mixer state was reset.");
  }
  function fullscreen() {
    if (!iframe.current?.requestFullscreen) {
      setNotice("Fullscreen is unavailable here. Try the standalone booth.");
      return;
    }
    setExpanded(true);
    void iframe.current.requestFullscreen().catch(() => setNotice("Browser blocked fullscreen. Open the standalone booth instead."));
  }
  const ctl = (id: string, label: string, style: CSSProperties, content?: string) => (
    <button type="button" key={id} className="backspin-poster-hotspot backspin-poster-ctl"
      style={style} aria-label={label} title={label} onClick={() => command(id, label)}>
      {content && <span className="backspin-poster-hotspot-label">{content}</span>}
    </button>
  );

  return (
    <section aria-label="Backspin 96 image DJ booth" className="backspin-stage pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">MoreBounceLabs · DJ Performance</p>
          <h1 className="font-display text-3xl">Backspin '96 · The Vinyl World</h1>
          <p className="mt-1 text-sm text-mist">Two real audio decks beneath your original 90s warehouse artwork.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={BOOTH_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm">Open original booth ↗</a>
          <button type="button" className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm"
            onClick={() => setExpanded((open) => !open)} aria-expanded={expanded} aria-controls="backspin-advanced">
            {expanded ? "Hide advanced rig" : "Advanced rig & crates"}
          </button>
          <button type="button" onClick={fullscreen} className="min-h-11 rounded-full border border-line bg-surface px-3 text-sm"
            title="Fullscreen original booth" aria-label="Fullscreen original booth"><Maximize2 size={17} /></button>
        </div>
      </div>
      <div className="backspin-poster-wrap mx-auto" aria-label="Interactive original Parallax Backspin 96 poster with overlay controls">
        {posterReady ? (
          <img src={POSTER_URL} alt="Original PARALLAX BACKSPIN '96 retro DJ poster with neon rave typography, vinyl turntables, CRT and a classic battle mixer"
            onError={() => setPosterReady(false)}
            className="backspin-poster-art" draggable={false} />
        ) : (
          <div className="flex aspect-[1055/1491] flex-col items-center justify-center bg-gradient-to-b from-[#251121] to-[#080710] p-8 text-center">
            <Disc3 size={70} className="text-fuchsia-400" />
            <h2 className="mt-4 font-display text-3xl">Backspin '96 Visual Booth</h2>
            <p className="mt-2 max-w-xs text-sm text-mist">The original poster artwork is being staged. The functional DJ controls are below.</p>
          </div>
        )}
        {posterReady && status === "ready" && (
          <div className="backspin-poster-clickmap" aria-label="Hardware control hotspots">
            {(["A", "B"] as Deck[]).map((deck) => (
              <button key={deck} type="button"
                className={"backspin-poster-platter backspin-poster-hotspot" + (snapshot[deck].playing ? " is-playing" : "")}
                style={deck === "A" ? pos(2.7, 49.9, 32.8, 14.5) : pos(67.8, 49.9, 30.5, 14.5)}
                aria-label={`Deck ${deck} vinyl platter: click Play/Pause or drag to scratch`}
                title={`Deck ${deck}: click to play or drag to scratch`}
                onPointerDown={(event) => startScratch(event, deck)}
                onPointerMove={(event) => moveScratch(event, deck)}
                onPointerUp={(event) => endScratch(event, deck)}
                onPointerCancel={(event) => endScratch(event, deck)}
                onClick={() => platterClick(deck)}
              >
                <span className="backspin-poster-platter-light" aria-hidden="true" />
                <span className="sr-only">Deck {deck} vinyl platter</span>
              </button>
            ))}
            {ctl("a-cue", "Cue Deck A", pos(3.5, 65.5, 8.5, 2.6), "CUE A")}
            {ctl("b-cue", "Cue Deck B", pos(87.5, 65.5, 8.5, 2.6), "CUE B")}
            {ctl("a-hotcue-1", "Hot cue A1", pos(12, 65.2, 7.5, 2.7), "A1")}
            {ctl("b-hotcue-1", "Hot cue B1", pos(79.7, 65.2, 7.5, 2.7), "B1")}
            {ctl("startAudio", "Start dual audio engine", pos(42, 46.8, 16, 2.7), "POWER / AUDIO")}
            {ctl("automixStart", "Start authorized Auto Mix", pos(43, 52, 14, 2.7), "AUTO MIX")}
            {ctl("panicStop", "Emergency stop both decks", pos(43, 56.8, 14, 2.7), "STOP BOTH")}
            <label className="backspin-poster-xfade" style={pos(39, 60, 22, 3.9)}>
              <span className="backspin-poster-xfade-name">A ◀ XFADE ▶ B</span>
              <input type="range" aria-label="Backspin battle crossfader on artwork" min={-1} max={1} step={0.01}
                disabled={!snapshot.ready} value={xfade} onChange={(e) => crossfade(Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>

      <div className="backspin-performance-rail mx-auto mt-5 max-w-[1055px] rounded-3xl border border-fuchsia-500/35 bg-[#100b19] p-4 shadow-2xl sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Human-led · Backspin engine</p>
            <p className="mt-1 text-sm text-mist">
              {status === "checking" ? "Checking original Backspin engine…" :
                status === "missing" ? "Original Backspin v1.5.0 runtime is not available. The source pack must be staged on Pages." :
                !bridgeReady ? "Booting the original DJ performance rig…" :
                snapshot.ready ? "Dual audio online. Import your own audio, load decks and mix." : "Ready to start dual audio. Requires a real click."}
            </p>
          </div>
          <button type="button" className="min-h-11 rounded-xl bg-fuchsia-600 px-5 font-semibold text-white disabled:opacity-50"
            disabled={status !== "ready" || snapshot.ready || !bridgeReady}
            onClick={() => command("startAudio", "Start Dual Audio")}>Start dual audio</button>
          <button type="button" className="min-h-11 rounded-xl border border-fuchsia-400/50 px-4 text-sm disabled:opacity-50"
            disabled={!bridgeReady} onClick={() => command("crateFileInput", "Import local music into Smart Crates")}>Import music files</button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.1fr_1fr]">
          {(["A", "B"] as Deck[]).map((deck) => (
            <div key={deck} className={`rounded-2xl border p-3 ${deck === "A" ? "border-cyan-600/50" : "border-orange-500/50"}`}
              style={{ gridColumn: deck === "B" ? (undefined) : undefined }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="font-display text-xl">Deck {deck}</strong>
                <span className="text-xs text-mist">{snapshot[deck].playing ? "PLAYING" : snapshot[deck].loaded ? "CUED" : "EMPTY"}</span>
              </div>
              <p className="mb-3 truncate text-xs text-mist" title={snapshot[deck].title}>
                {snapshot[deck].title || "Load an authorized local track to scratch and mix"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!snapshot.ready}
                  onClick={() => command(deck.toLowerCase() + "-file", "Load deck " + deck)}
                  className="min-h-11 rounded-xl border border-line px-3 text-xs disabled:opacity-40">Load {deck}</button>
                <button type="button" disabled={!snapshot[deck].loaded}
                  onClick={() => command(deck.toLowerCase() + "-play", "Play/Pause " + deck)}
                  className="min-h-11 rounded-xl bg-[#34213d] px-3 text-xs disabled:opacity-40">
                  {snapshot[deck].playing ? <Pause size={14} className="mr-1 inline" /> : <Play size={14} className="mr-1 inline" />}
                  {snapshot[deck].playing ? "Pause" : "Play"}
                </button>
                <button type="button" disabled={!snapshot[deck].loaded}
                  onClick={() => command(deck.toLowerCase() + "-cue", "Cue " + deck)}
                  className="min-h-11 rounded-xl border border-line px-3 text-xs disabled:opacity-40">Cue</button>
                {[1, 2, 3, 4].map((number) => (
                  <button key={number} type="button" disabled={!snapshot[deck].loaded}
                    onClick={() => command(deck.toLowerCase() + "-hotcue-" + number, `Deck ${deck} hot cue ${number}`)}
                    className="min-h-11 rounded-xl border border-line px-3 text-xs disabled:opacity-40">H{number}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-fuchsia-500/35 p-3 lg:col-start-2 lg:row-start-1">
            <strong className="font-display text-xl">Battle mixer</strong>
            <label className="mt-3 block text-xs text-mist">Crossfader {xfade.toFixed(2)}
              <input type="range" min={-1} max={1} step={0.01} value={xfade}
                disabled={!snapshot.ready} onChange={(e) => crossfade(Number(e.target.value))}
                aria-label="Battle mixer crossfader"
                className="mt-2 block w-full accent-fuchsia-400 disabled:opacity-40" />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!snapshot.ready} onClick={() => crossfade(-1)}
                className="min-h-11 rounded-xl border border-line px-3 text-xs disabled:opacity-40">Cut A</button>
              <button type="button" disabled={!snapshot.ready} onClick={() => crossfade(0)}
                className="min-h-11 rounded-xl border border-line px-3 text-xs disabled:opacity-40">Center</button>
              <button type="button" disabled={!snapshot.ready} onClick={() => crossfade(1)}
                className="min-h-11 rounded-xl border border-line px-3 text-xs disabled:opacity-40">Cut B</button>
              <button type="button" disabled={!snapshot.ready} onClick={() => command("automixStart", "Auto Mix")}
                className="min-h-11 rounded-xl border border-fuchsia-400/60 px-3 text-xs disabled:opacity-40">Auto Mix</button>
              <button type="button" disabled={!snapshot.ready} onClick={() => command("panicStop", "STOP BOTH")}
                className="min-h-11 rounded-xl bg-rose-900/70 px-3 text-xs disabled:opacity-40">Stop both</button>
            </div>
          </div>
        </div>
        <p role="status" aria-live="polite" className="mt-3 text-xs text-mist">
          <ShieldAlert size={14} className="mr-1 inline" /> {notice || "The poster controls operate your real Backspin AudioWorklet. Drag a vinyl platter to scratch after loading a track. No streamed Suno/SoundCloud audio is captured."}
        </p>
      </div>

      <div className="mx-auto mt-5 max-w-[1200px]">
        <div id="backspin-advanced" className={expanded ? "block" : "backspin-advanced-collapsed"}>
          <h2 className="mb-3 font-display text-2xl">Original performance rig & Smart Crates</h2>
          <p className="mb-3 text-sm text-mist">All original controls remain available here, including waveform, BPM, loops, MIDI, recording, crates and the full scratch surfaces.</p>
        </div>
        {status === "ready" ? (
          <iframe
            key={resetKey}
            ref={iframe}
            title="Original Backspin 96 DJ engine and advanced controls"
            src={BOOTH_URL}
            loading="eager"
            allow="autoplay; fullscreen"
            allowFullScreen
            referrerPolicy="same-origin"
            aria-hidden={!expanded}
            tabIndex={expanded ? 0 : -1}
            onLoad={() => { setBridgeReady(false); setNotice("Backspin engine loaded. Press Start dual audio to enable sound."); }}
            className={expanded
              ? "block h-[780px] w-full rounded-2xl border border-fuchsia-500/35 bg-black sm:h-[1050px] xl:h-[1180px]"
              : "backspin-inactive-iframe"}
          />
        ) : (
          <p className="rounded-xl border border-line p-4 text-sm text-mist">Backspin source pack is pending. Open the original booth link after the engine is deployed.</p>
        )}
      </div>

      <div className="mx-auto mt-4 flex max-w-[1055px] flex-wrap items-center gap-3 text-xs text-mist">
        <Headphones size={18} className="text-fuchsia-300" />
        <span>Local music only · No microphone or unauthorized streaming capture · Real browser audio gesture required.</span>
        <button type="button" onClick={reloadBooth} disabled={status !== "ready"}
          className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-3 disabled:opacity-40">
          <RotateCcw size={14} /> Reload rig
        </button>
      </div>
    </section>
  );
}
