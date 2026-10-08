import { useEffect, useRef, useState } from "react";

const LENS_URL = "https://michaelwave369.github.io/infinitylens369/";

export function InfinityLensStage({ reduced }: { reduced: boolean }) {
  const [launched, setLaunched] = useState(false);
  const [session, setSession] = useState(0);
  const [message, setMessage] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (reduced) setLaunched(false);
  }, [reduced]);

  function openLens() {
    setMessage("");
    setLaunched(true);
  }

  function stopLens() {
    setLaunched(false);
    setSession((n) => n + 1);
    setMessage("InfinityLens stage stopped. Its audio and GPU effects are no longer running here.");
  }

  function fullScreen() {
    const element = frame.current;
    if (!element) return;
    if (!element.requestFullscreen) {
      setMessage("Fullscreen is not supported by this browser. Try the dedicated InfinityLens page.");
      return;
    }
    void element.requestFullscreen().catch(() =>
      setMessage("Fullscreen was blocked. Open InfinityLens in a separate tab instead."),
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-amber/40 bg-surface p-4 sm:p-6" aria-label="InfinityLens369 visual stage">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber">Guest visual engine · InfinityLens369</p>
          <h2 className="mt-1 font-display text-2xl">Open the fractal portal</h2>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            The original InfinityLens369 experience lives here in an isolated visual stage. Explore Mandelbrot, Julia,
            kaleidoscopes, tunnels and its own performance controls, without replacing MBL's player.
          </p>
        </div>
        <a className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-cream"
          href={LENS_URL} target="_blank" rel="noopener noreferrer">
          Open original visualizer ↗
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!launched ? (
          <button type="button" className="min-h-11 rounded-full bg-heat px-5 font-semibold text-cream"
            onClick={openLens} disabled={reduced}>
            Launch InfinityLens stage
          </button>
        ) : (
          <>
            <button type="button" className="min-h-11 rounded-full bg-heat px-5 font-semibold text-cream"
              onClick={stopLens}>Stop visual stage</button>
            <button type="button" className="min-h-11 rounded-full border border-line px-4 text-sm"
              onClick={fullScreen}>Fullscreen visual stage</button>
          </>
        )}
        <span className="text-xs text-mist" role="status">
          {reduced ? "Reduced motion is enabled; launch is disabled for comfort." : message || (launched ? "Visual stage active" : "Off until launched")}
        </span>
      </div>

      {launched && !reduced ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-bg">
          <iframe key={session} ref={frame} title="InfinityLens369 interactive fractal visualizer"
            src={LENS_URL} allow="fullscreen" allowFullScreen
            loading="eager" referrerPolicy="strict-origin-when-cross-origin"
            className="block h-[420px] w-full bg-bg sm:h-[620px]" />
        </div>
      ) : (
        <div className="mt-4 flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-bg p-5 text-center">
          <span className="font-display text-3xl text-amber" aria-hidden>∞</span>
          <p className="font-display text-xl">Portal on standby</p>
          <p className="max-w-md text-xs text-mist">Launch only when you want it. This avoids running a second WebGL renderer while browsing albums or using the DJ tools.</p>
        </div>
      )}
      <p className="mt-3 text-xs text-mist">
        Audio disclosure: Suno plays in a separate cross-origin iframe. InfinityLens cannot analyze that sound directly.
        Its visuals will be ambient unless you explicitly load audio into InfinityLens itself. If browser iframe policies block the stage,
        use the Open original visualizer link.
      </p>
    </section>
  );
}
