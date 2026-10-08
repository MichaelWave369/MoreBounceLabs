import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL;
const BOOTH_URL = `${BASE}backspin96/`;
const MANIFEST_URL = `${BOOTH_URL}mbl-stage.json`;

type BoothStatus = "checking" | "ready" | "missing";

export function BackspinDecks() {
  const [status, setStatus] = useState<BoothStatus>("checking");
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState("");
  const iframe = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(MANIFEST_URL, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return false;
        const manifest: unknown = await res.json();
        return Boolean(manifest && typeof manifest === "object"
          && (manifest as Record<string, unknown>).engine === "Backspin96"
          && (manifest as Record<string, unknown>).sourceVersion === "1.5.0");
      })
      .then((ok) => { if (!cancelled) setStatus(ok ? "ready" : "missing"); })
      .catch(() => { if (!cancelled) setStatus("missing"); });
    return () => { cancelled = true; };
  }, []);

  function fullscreen() {
    if (!iframe.current?.requestFullscreen) {
      setNotice("Fullscreen unavailable. Use Open standalone booth instead.");
      return;
    }
    void iframe.current.requestFullscreen().catch(() =>
      setNotice("The browser blocked fullscreen. Use Open standalone booth instead."));
  }

  return (
    <section aria-label="Backspin 96 DJ Decks" className="pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">
            MoreBounceLabs · Performance Booth
          </p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl">Backspin '96</h1>
          <p className="mt-2 max-w-3xl text-sm text-mist">
            The original warehouse DJ rig. Two AudioWorklet decks, scratching,
            cue points, mixer, Auto Mix, local crates and recovery tools.
          </p>
        </div>
        {status === "ready" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm"
              onClick={fullscreen}>Fullscreen booth</button>
            <a href={BOOTH_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm">
              Open standalone booth ↗
            </a>
            <button type="button" className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm"
              onClick={() => {
                setResetKey((n) => n + 1);
                setNotice("Booth reloaded. Stop playback and save/export your work first; in-memory decks have reset.");
              }}>Reload booth</button>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-mist" aria-live="polite">
        {notice || (status === "ready"
          ? "Backspin is isolated from the main MBL player. Load music from your own authorized local files."
          : status === "checking" ? "Checking the Backspin booth installation…"
          : "Backspin runtime has not been staged in this GitHub Pages deployment yet.")}
      </p>

      {status === "ready" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-amber/40 bg-black shadow-2xl">
          <iframe
            key={resetKey}
            ref={iframe}
            title="Backspin 96, complete original DJ performance booth"
            src={BOOTH_URL}
            loading="eager"
            allow="autoplay; fullscreen"
            allowFullScreen
            referrerPolicy="same-origin"
            className="block h-[740px] w-full bg-black sm:h-[940px] xl:h-[1100px]"
          />
        </div>
      ) : (
        <div className="mt-5 flex min-h-72 flex-col items-center justify-center rounded-3xl border border-amber/30 bg-surface p-6 text-center">
          <span aria-hidden className="text-5xl text-amber">◉</span>
          <h2 className="mt-4 font-display text-2xl">
            {status === "checking" ? "Opening the warehouse…" : "Warehouse booth awaiting its source pack"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-mist">
            The full Backspin 96 engine is distributed as a versioned archive.
            Add the reviewed v1.5.0 ZIP at <code>vendor/backspin96-source.zip</code>.
            The deployment build verifies its SHA-256, stages the genuine
            audio engine, and activates the DJ booth automatically.
          </p>
          <p className="mt-3 text-xs text-mist">
            Nothing is fetched from Suno automatically, and no synthetic mixing engine is substituted.
          </p>
        </div>
      )}

      <p className="mt-3 max-w-5xl text-xs text-mist">
        Your library and downloaded audio stay in this browser's storage.
        The original Backspin app requires a user gesture to initialize audio.
        GitHub Pages cannot supply cross-origin-isolation headers, so the booth
        uses its non-isolated copy-transport fallback and must be checked in a real browser.
        Leaving Decks unmounts the booth and may stop unsaved live playback.
      </p>
    </section>
  );
}
