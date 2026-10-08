import { useEffect, useRef, useState } from "react";
import { filteredSoundCloudAlbums, SOUNDCLOUD_ALBUMS, SOUNDCLOUD_PROFILE, soundCloudWidgetSrc } from "@/lib/soundcloud";

type Widget = {
  bind: (event: string, handler: () => void) => void;
  unbind: (event: string) => void;
  play: () => void;
  next: () => void;
  skip: (index: number) => void;
  getSounds: (handler: (sounds: unknown[]) => void) => void;
  getCurrentSoundIndex: (handler: (index: number) => void) => void;
  isPaused: (handler: (paused: boolean) => void) => void;
};
type WidgetFactory = { Widget: ((iframe: HTMLIFrameElement) => Widget) & { Events: Record<string, string> } };
type SCWindow = Window & { SC?: WidgetFactory };

function getWidgetAPI(): Promise<WidgetFactory> {
  const win = window as SCWindow;
  if (win.SC?.Widget) return Promise.resolve(win.SC);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[data-mbl-soundcloud-widget]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://w.soundcloud.com/player/api.js";
      script.async = true;
      script.dataset.mblSoundcloudWidget = "1";
      document.head.appendChild(script);
    }
    const target = script;
    const clean = () => { target.removeEventListener("load", ready); target.removeEventListener("error", failed); };
    const ready = () => {
      clean();
      if (win.SC?.Widget) resolve(win.SC);
      else reject(new Error("SoundCloud Widget API did not initialize."));
    };
    const failed = () => { clean(); reject(new Error("SoundCloud Widget API could not load.")); };
    target.addEventListener("load", ready, { once: true });
    target.addEventListener("error", failed, { once: true });
    // If the script already loaded between the initial check and event binding.
    if (win.SC?.Widget) ready();
  });
}

export function SoundCloudShelf({
  query, selectedId, onSelect,
}: {
  query: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const listed = filteredSoundCloudAlbums(query);
  const selected = SOUNDCLOUD_ALBUMS.find((album) => album.id === selectedId);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [widgetStatus, setWidgetStatus] = useState("");
  const [autoContinue, setAutoContinue] = useState(true);
  const continueRef = useRef(autoContinue);
  const lastPlayingIndex = useRef(0);

  useEffect(() => { continueRef.current = autoContinue; }, [autoContinue]);

  useEffect(() => {
    if (!selected || !iframe.current) return;
    let disposed = false;
    let widget: Widget | null = null;
    let events: string[] = [];
    let scheduled: number | undefined;
    setWidgetStatus("Loading SoundCloud's official playlist controls…");

    void getWidgetAPI().then((api) => {
      if (disposed || !iframe.current) return;
      widget = api.Widget(iframe.current);
      const e = api.Widget.Events;
      const bind = (name: string | undefined, handler: () => void) => {
        if (name && widget) { widget.bind(name, handler); events.push(name); }
      };
      bind(e.READY, () => setWidgetStatus("Ready. Press Play once inside SoundCloud's official player."));
      bind(e.PLAY, () => {
        setWidgetStatus("SoundCloud is playing.");
        widget?.getCurrentSoundIndex((index) => { if (!disposed) lastPlayingIndex.current = index; });
      });
      bind(e.PAUSE, () => setWidgetStatus("Paused in SoundCloud."));
      bind(e.ERROR, () => setWidgetStatus("SoundCloud could not play this release. Open it on SoundCloud instead."));
      bind(e.FINISH, () => {
        if (!continueRef.current || disposed) return;
        const endedAt = lastPlayingIndex.current;
        // Many SoundCloud playlist embeds already advance themselves.
        // Only assist if the official widget is still paused after a short grace period.
        scheduled = window.setTimeout(() => {
          if (disposed || !widget) return;
          const current = widget;
          current.getSounds((sounds) => {
            if (disposed || !Array.isArray(sounds) || sounds.length < 2) return;
            current.getCurrentSoundIndex((index) => {
              if (disposed) return;
              current.isPaused((paused) => {
                if (disposed || !paused) return; // Native SoundCloud autoplay is already working.
                if (index === endedAt && index < sounds.length - 1) {
                  current.next();
                  current.play();
                  setWidgetStatus("Attempting next track. If your browser blocks playback, press Play in SoundCloud.");
                } else if (index > endedAt) {
                  current.play();
                  setWidgetStatus("Attempting to continue. If blocked, press Play in SoundCloud.");
                } else {
                  setWidgetStatus("Album ended. Select another album to continue listening.");
                }
              });
            });
          });
        }, 1000);
      });
      // The iframe still plays by itself if the widget API is unavailable.
    }).catch(() => {
      if (!disposed) setWidgetStatus("Official SoundCloud embed available. Advanced playback event controls unavailable.");
    });
    return () => {
      disposed = true;
      if (scheduled !== undefined) window.clearTimeout(scheduled);
      if (widget) for (const event of events) widget.unbind(event);
    };
  }, [selected?.id]);

  return (
    <section className="mt-8 border-t border-line pt-7" aria-label="SoundCloud album archives">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber">MoreBounceLabs · SoundCloud archives</p>
          <h2 className="mt-1 font-display text-3xl">The original record shelves</h2>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            ${SOUNDCLOUD_ALBUMS.length} public albums from the original MicTek SoundCloud profile. Select a record to open its official
            playlist player without downloading or copying the audio.
          </p>
        </div>
        <a href={SOUNDCLOUD_PROFILE} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm">
          All albums on SoundCloud ↗
        </a>
      </div>

      {listed.length === 0 ? (
        <p className="mt-5 text-sm text-mist">No SoundCloud albums match that search.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {listed.map((album) => (
            <button key={album.id} type="button"
              aria-pressed={selectedId === album.id}
              className={`sleeve rounded-xl text-left focus-visible:outline-2 focus-visible:outline-amber ${selectedId === album.id ? "ring-2 ring-amber" : ""}`}
              onClick={() => onSelect(album.id)}>
              <img src={album.cover} alt="" loading="lazy" referrerPolicy="no-referrer"
                className="aspect-square w-full rounded-2xl bg-surface object-cover" />
              <span className="mt-2 block font-medium">{album.title}</span>
              <span className="block text-xs text-mist">{album.year} · {album.trackCount} tracks · SoundCloud</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-6 rounded-3xl border border-amber/40 bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-amber">Now selected · SoundCloud playlist</p>
              <h3 className="mt-1 font-display text-2xl">{selected.title}</h3>
              <p className="mt-2 max-w-xl text-sm text-mist">{selected.description}</p>
            </div>
            <div className="flex gap-2">
              <a href={selected.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm">
                Open on SoundCloud ↗
              </a>
              <button type="button" onClick={() => onSelect(null)}
                className="min-h-11 rounded-full border border-line px-4 text-sm">Close player</button>
            </div>
          </div>
          <iframe key={selected.id} ref={iframe} title={`SoundCloud playlist: ${selected.title}`}
            src={soundCloudWidgetSrc(selected.url)} allow="autoplay; encrypted-media"
            loading="eager" referrerPolicy="strict-origin-when-cross-origin"
            className="mt-4 h-[400px] w-full rounded-xl border border-line bg-bg sm:h-[450px]" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-mist">
            <label className="inline-flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={autoContinue} onChange={(event) => setAutoContinue(event.target.checked)} />
              Assist next-track playback when SoundCloud pauses at the end
            </label>
            <p role="status" aria-live="polite">{widgetStatus || "Use the SoundCloud controls inside the player."}</p>
          </div>
          <p className="mt-2 text-xs text-mist">
            Playback stays with SoundCloud. The playlist may advance on its own; the optional assist only tries to continue
            after a FINISH event when SoundCloud remains paused. Browser autoplay rules may still require a tap.
            The MBL mini-player is hidden while this SoundCloud player is open.
          </p>
        </div>
      )}
    </section>
  );
}
