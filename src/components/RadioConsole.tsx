import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertCircle, Headphones, RadioTower, RotateCcw } from "lucide-react";
import { collectStation } from "../../scripts/house-logic.mjs";
import { currentTrack, useHouse, type Album, type QueueItem } from "@/lib/engine";

type Band = "AM" | "FM" | "SAT" | "ALL";
type MotionKey = "ambient" | "pulse" | "sweep" | "trails" | "dust";
const ART = import.meta.env.BASE_URL + "radio/mbl-radio-console.png";
const STATION_PRESETS = [
  { id: "solar", title: "Solar Bounce FM", band: "AM" as Band, caption: "Warm grooves, retro bounce, dimensional static.", source: "funk", hz: 104.3 },
  { id: "trucker", title: "Night Trucker", band: "FM" as Band, caption: "Midnight highway transmissions, drifting toward dawn.", source: "night", hz: 92.6 },
  { id: "porch", title: "Porch Static", band: "FM" as Band, caption: "Curious frequencies from the outside edge.", source: "weird", hz: 98.1 },
  { id: "desert", title: "Deep Desert AM", band: "AM" as Band, caption: "Deep-space expeditions crossing the desert.", source: "space", hz: 88.4 },
  { id: "orbit", title: "Orbit Lounge", band: "SAT" as Band, caption: "Dream tides, ocean signals, late-night orbit.", source: "orbit", hz: 107.7 },
] as const;

type RadioPreset = (typeof STATION_PRESETS)[number];
const MOTION_DEFAULT: Record<MotionKey, boolean> = { ambient: true, pulse: true, sweep: true, trails: true, dust: true };
const HOTSPOTS = {
  // Percentages relative to the source art, cropped at y=73..973:
  station: [
    { x: 4.5, y: 33.8, w: 21.4, h: 7.1 },
    { x: 4.5, y: 41.7, w: 21.4, h: 7.1 },
    { x: 4.5, y: 49.5, w: 21.4, h: 7.1 },
    { x: 4.5, y: 57.3, w: 21.4, h: 7.1 },
    { x: 4.5, y: 65.0, w: 21.4, h: 7.1 },
  ],
  ribbon: [
    { x: 2.5, y: 19.5, w: 6.2, h: 6.5 },
    { x: 9.5, y: 19.5, w: 7, h: 6.5 },
    { x: 18.4, y: 19.5, w: 8.2, h: 6.5 },
    { x: 27.6, y: 19.5, w: 8.4, h: 6.5 },
    { x: 36.9, y: 19.5, w: 8.6, h: 6.5 },
    { x: 46.1, y: 19.5, w: 8.9, h: 6.5 },
  ],
};
const rect = (x: number, y: number, w: number, h: number): CSSProperties => ({
  left: x + "%", top: y + "%", width: w + "%", height: h + "%",
});
const hot = (v: { x: number; y: number; w: number; h: number }) => rect(v.x, v.y, v.w, v.h);

export function RadioConsole({ albums, onPlay, reduced }: {
  albums: Album[];
  onPlay: (items: QueueItem[]) => void;
  reduced: boolean;
}) {
  const house = useHouse();
  const [stationIndex, setStationIndex] = useState(0);
  const [band, setBand] = useState<Band>("ALL");
  const [motion, setMotion] = useState(!reduced);
  const [layers, setLayers] = useState(MOTION_DEFAULT);
  const [intensity, setIntensity] = useState(60);
  const [speed, setSpeed] = useState(50);
  const [drift, setDrift] = useState(false);
  const [viz, setViz] = useState<"spectrum" | "pulse" | "quiet">("spectrum");
  const [message, setMessage] = useState("");
  const [artReady, setArtReady] = useState<boolean | null>(null);

  const selected = STATION_PRESETS[stationIndex];
  const available = useMemo(() => STATION_PRESETS.map((preset) => collectStation(albums, preset.source)), [albums]);
  const tunedIndices = STATION_PRESETS.map((_item, index) => index).filter(
    (i) => (band === "ALL" || STATION_PRESETS[i].band === band) && available[i].length,
  );
  const actuallyPlaying = house.status === "playing" && !house.embed;
  const isEmbedded = Boolean(house.embed);
  const liveOutput = actuallyPlaying || isEmbedded;
  const now = currentTrack(house);
  const effects = motion && !reduced;

  useEffect(() => { if (reduced) setMotion(false); }, [reduced]);

  useEffect(() => {
    if (!drift || !effects || tunedIndices.length < 2) return;
    // A visual-only scanning needle, never involuntary station playback.
    const timer = window.setInterval(() => {
      setStationIndex((current) => tunedIndices[(tunedIndices.indexOf(current) + 1 + tunedIndices.length) % tunedIndices.length]);
    }, Math.round(20000 - speed * 100));
    return () => window.clearInterval(timer);
  }, [drift, effects, band, speed, tunedIndices.join(",")]);

  function tune(index: number, play = true) {
    const items = available[index];
    if (!items?.length) {
      setMessage("There are no MBL songs mapped to this station yet.");
      return;
    }
    setStationIndex(index);
    setMessage(play
      ? "Tuned to " + STATION_PRESETS[index].title + ". If the official Suno embed appears, use Play inside it."
      : "Dial tuned to " + STATION_PRESETS[index].title + ". Press Power to listen.");
    if (play) onPlay(items);
  }

  function scan(direction = 1) {
    if (!tunedIndices.length) { setMessage("No stations available on this band."); return; }
    const pos = tunedIndices.indexOf(stationIndex);
    const next = tunedIndices[(pos + direction + tunedIndices.length) % tunedIndices.length];
    tune(next);
  }

  function setFrequencyBand(next: Band) {
    setBand(next);
    const index = STATION_PRESETS.findIndex((preset, i) =>
      (next === "ALL" || preset.band === next) && available[i].length);
    if (index !== -1) {
      setStationIndex(index);
      setMessage(next + " selected. Press the highlighted station or Power to play.");
    } else setMessage("No stations are available on this band yet.");
  }

  function togglePower() {
    if (isEmbedded) {
      setMessage("SoundCloud is not involved here. Suno owns its iframe Play control below the console.");
      return;
    }
    if (!house.queue.length || house.status === "idle") {
      tune(stationIndex);
      return;
    }
    house.toggle();
  }

  function toggleLayer(layer: MotionKey) { setLayers((old) => ({ ...old, [layer]: !old[layer] })); }

  function changeVisual() {
    setViz((prev) => prev === "spectrum" ? "pulse" : prev === "pulse" ? "quiet" : "spectrum");
  }
  function resetMotion() {
    setLayers(MOTION_DEFAULT);
    setIntensity(60); setSpeed(50); setDrift(false); setViz("spectrum");
  }

  const control = (label: string, style: CSSProperties, action: () => void, enabled = false) => (
    <button type="button" className={"mbl-radio-hotspot" + (enabled ? " mbl-radio-hotspot-active" : "")}
      style={style} title={label} aria-label={label} aria-pressed={enabled} onClick={action}>
      <span className="sr-only">{label}</span>
    </button>
  );
  const motionControls: Array<{ key: MotionKey; label: string }> = [
    { key: "ambient", label: "Ambient lighting" },
    { key: "pulse", label: "Signal pulse" },
    { key: "sweep", label: "Satellite sweep arc" },
    { key: "trails", label: "Scan trails" },
    { key: "dust", label: "Dust and glow" },
  ];

  return (
    <section aria-label="MoreBounceLabs Radio" className="mbl-radio-room">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.19em] text-amber">Global Broadcast Network · MBL</p>
          <h1 className="font-display text-4xl sm:text-5xl">Radio Control Room</h1>
          <p className="mt-2 text-sm text-mist">The original retro CB / satellite console, with a real tuner on top.</p>
        </div>
        <span className="rounded-full border border-amber/40 bg-surface px-4 py-2 text-xs font-semibold text-amber">
          {isEmbedded ? "OFFICIAL SUNO PLAYER" : actuallyPlaying ? "AUDIO ON AIR" : "TRANSMITTER READY"}
        </span>
      </div>

      <div className={"mbl-radio-stage" + (effects ? " mbl-radio-stage-motion" : "")}
        style={{ "--radio-energy": intensity / 100, "--radio-speed": Math.max(0.45, 1.8 - speed / 65) + "s" } as CSSProperties}>
        {artReady !== false && <img src={ART} alt="Vintage MoreBounceLabs satellite radio console with knobs, station presets, tuner, analog meters and an amber signal display"
          className="mbl-radio-art" onLoad={() => setArtReady(true)} onError={() => setArtReady(false)} draggable={false} />}
        {artReady === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#56311b,#0c0b0c_70%)] p-5 text-center">
            <RadioTower size={65} className="text-amber" />
            <h2 className="mt-4 font-display text-3xl">MBL Radio Console</h2>
            <p className="mt-3 max-w-md text-sm text-mist">The approved background image has not been staged in this deployment. Radio controls are available below.</p>
          </div>
        )}
        {effects && artReady && (
          <div className="mbl-radio-fx-layer" aria-hidden="true">
            {layers.ambient && <div className="mbl-radio-fx-ambient" />}
            {layers.sweep && <div className="mbl-radio-fx-sweep" />}
            {layers.pulse && <div className="mbl-radio-fx-signal" />}
            {layers.trails && <div className="mbl-radio-fx-trails" />}
            {layers.dust && <div className="mbl-radio-fx-dust" />}
            {viz !== "quiet" && liveOutput && (
              <div className={"mbl-radio-fx-meter " + (viz === "pulse" ? "mbl-radio-fx-meter-pulse" : "")}>
                {Array.from({ length: 11 }, (_, i) => <i key={i} style={{ animationDelay: (i * 0.09) + "s" }} />)}
              </div>
            )}
          </div>
        )}
        {artReady && (
          <div className="mbl-radio-clickmap">
            {STATION_PRESETS.map((preset, index) => control(
              "Tune " + preset.title + ": " + available[index].length + " songs",
              hot(HOTSPOTS.station[index]), () => tune(index),
              stationIndex === index,
            ))}
            {control("Toggle radio motion", hot(HOTSPOTS.ribbon[0]), () => setMotion((old) => !old), effects)}
            {motionControls.map((item, i) => control(
              "Toggle " + item.label, hot(HOTSPOTS.ribbon[i + 1]),
              () => toggleLayer(item.key), layers[item.key] && effects,
            ))}
            {control("Change visualizer mode", rect(54.9, 19.6, 8.0, 6.5), changeVisual, viz !== "quiet")}
            {control("Adjust effect intensity", rect(63.1, 19.6, 9.4, 6.5), () => setIntensity((n) => n >= 90 ? 10 : n + 10))}
            {control("Adjust motion speed", rect(73, 19.6, 7.8, 6.5), () => setSpeed((n) => n >= 90 ? 10 : n + 10))}
            {control("Toggle automatic visual station drift", rect(81.3, 19.6, 9.5, 6.5), () => setDrift((n) => !n), drift)}
            {(["AM", "FM", "SAT", "ALL"] as Band[]).map((b, i) => control(
              "Select " + b + " station band", rect(75.0 + i * 5.1, 58.7, 4.7, 5.9),
              () => setFrequencyBand(b), band === b,
            ))}
            {control("Power, play or pause radio", rect(46.8, 65.8, 6.9, 8.8), togglePower, liveOutput)}
            {control("Previous station or track", rect(42.2, 67.0, 4.6, 6.5), () => house.queue.length ? house.prev() : scan(-1))}
            {control("Next station or track", rect(53.7, 67.0, 4.5, 6.5), () => house.queue.length ? house.next() : scan(1))}
            {control("Shuffle radio", rect(37.1, 67.0, 4.4, 6.5), house.setShuffle, house.shuffle)}
            {control("Cycle radio repeat mode", rect(58.8, 67.0, 4.6, 6.5), house.setRepeat, house.repeat !== "off")}
            {control("Scan next available station", rect(29.5, 80.0, 8.7, 6.9), () => scan(1))}
            {control("Tune frequency left", rect(41.4, 80.8, 3.8, 6.2), () => scan(-1))}
            {control("Turn tuning dial to next station", rect(45.9, 78.0, 9.4, 12.5), () => scan(1))}
            {control("Tune frequency right", rect(55.1, 80.8, 3.8, 6.2), () => scan(1))}
          </div>
        )}
      </div>

      <div className="mbl-radio-controls mt-3 rounded-2xl border border-amber/30 bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber">Now tuning · {selected.band} {selected.hz.toFixed(1)}</p>
            <h2 className="font-display text-2xl">{selected.title}</h2>
            <p className="text-sm text-mist">{selected.caption}</p>
            <p className="mt-1 text-xs text-mist">{available[stationIndex].length} catalog tracks · {now.track ? "House track: " + now.track.title : "Select a station to start listening"}</p>
          </div>
          <button className="min-h-11 rounded-full bg-amber px-5 font-semibold text-ink" type="button" onClick={() => tune(stationIndex)}>
            <Headphones size={16} className="mr-2 inline" /> Tune &amp; Play
          </button>
          <button className="min-h-11 rounded-full border border-line px-4" type="button" onClick={() => scan(1)}>Scan next</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {STATION_PRESETS.map((preset, index) => (
            <button key={preset.id} type="button" aria-pressed={index === stationIndex}
              onClick={() => tune(index)}
              className={"min-h-10 rounded-full border px-3 text-xs " + (index === stationIndex ? "border-amber bg-amber/20 text-cream" : "border-line text-mist")}>
              {preset.title}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-mist">
            Intensity · {intensity}%
            <input type="range" min={0} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} aria-label="Radio motion intensity" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-mist">
            Motion speed · {speed}%
            <input type="range" min={0} max={100} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Radio motion speed" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button className="min-h-10 rounded-xl border border-line px-3 text-xs" type="button" aria-pressed={effects} onClick={() => setMotion(!motion)}>
              Motion {effects ? "ON" : "OFF"}
            </button>
            <button className="min-h-10 rounded-xl border border-line px-3 text-xs" type="button" aria-pressed={drift} onClick={() => setDrift(!drift)}>Drift {drift ? "ON" : "OFF"}</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="min-h-10 rounded-xl border border-line px-3 text-xs" type="button" onClick={changeVisual}>Visual: {viz}</button>
            <button className="min-h-10 rounded-xl border border-line px-3 text-xs" type="button" onClick={resetMotion} aria-label="Reset radio motion effects"><RotateCcw size={15} /></button>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-mist" role="status" aria-live="polite"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {message || (reduced ? "Your reduced-motion setting is active." : "Click a station or a radio control. Each knob hotspot has a keyboard-accessible action.")}</p>
        <p className="mt-2 text-xs text-mist">Stations are curated MBL album-title collections. AM, FM and SAT are themed presets, not RF broadcasts. Signal effects are ambient unless authorized native audio is playing. Suno may require pressing Play in its official iframe below.</p>
      </div>
    </section>
  );
}
