import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MutableRefObject } from "react";
import { FolderOpen, Headphones, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Square, Upload } from "lucide-react";
import { acceptableRadioFile, matchRadioFiles, MAX_RADIO_FILES, nextRadioIndex } from "../../scripts/radio-local.mjs";

type StationSong = { albumId: string; index: number; title: string; albumTitle: string };
type LocalItem = { fileIndex: number; title: string; albumTitle: string };
export type LocalRadioControls = {
  toggle: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  shuffle: () => void;
  repeat: () => void;
};

export function LocalContinuousRadio({
  stationId, stationTitle, stationSongs, onLocalActiveChange, onStart, controllerRef
}: {
  stationId: string;
  stationTitle: string;
  stationSongs: StationSong[];
  onLocalActiveChange: (active: boolean) => void;
  onStart: () => void;
  controllerRef: MutableRefObject<LocalRadioControls | null>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"all" | "station">("all");
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatAll, setRepeatAll] = useState(true);
  const [message, setMessage] = useState("Choose your own exported/authorized audio files to enable true continuous playback.");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const sourceRef = useRef("");
  const stationRef = useRef(stationId);
  const mountedRef = useRef(true);

  const matched = useMemo(() => matchRadioFiles(files, stationSongs), [files, stationSongs]);
  const queue = useMemo<LocalItem[]>(() => mode === "station" ? matched : files.map((file, fileIndex) => ({
    fileIndex, title: file.name.replace(/\.[^.]+$/, ""), albumTitle: "Locally selected audio"
  })), [files, matched, mode]);

  function releaseUrl() {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
    sourceRef.current = "";
  }

  function stop() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    releaseUrl();
    setPlaying(false);
    setActive(false);
    setIndex(-1);
    onLocalActiveChange(false);
  }

  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.setAttribute("webkitdirectory", "");
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      releaseUrl();
      onLocalActiveChange(false);
    };
    // Mount/unmount only, never discard local files just because React rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stationRef.current !== stationId) {
      stationRef.current = stationId;
      stop();
      setMessage("Station changed. Select Current station matches, or play all locally selected tracks.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  function loadAt(next: number, auto = true) {
    const entry = queue[next], audio = audioRef.current;
    if (!entry || !audio || !files[entry.fileIndex]) return;
    audio.pause();
    audio.removeAttribute("src");
    releaseUrl();
    const url = URL.createObjectURL(files[entry.fileIndex]);
    sourceRef.current = url;
    audio.src = url;
    audio.load();
    setIndex(next);
    setPlaying(false);
    if (!auto) return;
    setActive(true);
    onLocalActiveChange(true);
    void audio.play().then(() => {
      if (mountedRef.current) {
        setPlaying(true);
        setMessage("Playing a locally selected file. The next track loads automatically.");
      }
    }).catch(() => {
      if (mountedRef.current) {
        setPlaying(false);
        setMessage("Browser blocked playback or cannot decode this file. Press Play, or try MP3/WAV.");
      }
    });
  }

  function start() {
    if (!queue.length) {
      setMessage(mode === "station"
        ? "No selected audio filenames matched this station. Switch to All selected files or choose matching exports."
        : "Select your own local audio files first.");
      return;
    }
    onStart(); // Suspend the native/Suno house player before this independent local source starts.
    if (index >= 0 && audioRef.current?.src && active) {
      const audio = audioRef.current;
      void audio.play().then(() => {
        setPlaying(true);
        setMessage("Local radio resumed.");
      }).catch(() => setMessage("Play was blocked. Try pressing Play again."));
    } else loadAt(0, true);
  }

  function toggle() {
    if (!active || index < 0) { start(); return; }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().then(() => {
          setPlaying(true);
      }).catch(() => setMessage("Browser blocked audio. Press Play in the local audio controls."));
    } else {
      audio.pause();
      playingRef.current = false;
      setPlaying(false);
    }
  }

  function next() {
    if (!queue.length) return;
    if (index < 0) { start(); return; }
    const nextIndex = nextRadioIndex(index, queue.length, repeatAll, shuffle);
    if (nextIndex === -1) {
      stop();
      setMessage("Local playlist finished. Enable Repeat all to keep the radio going.");
    } else loadAt(nextIndex, true);
  }

  function prev() {
    if (!queue.length) return;
    if (index < 0) { start(); return; }
    loadAt(Math.max(0, index - 1), true);
  }

  function setModeSafe(value: "all" | "station") {
    stop();
    setMode(value);
    setMessage(value === "all" ? "Ready to play all locally selected tracks." :
      "Only filenames matching verified songs on this station will be queued.");
  }

  function addAudio(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    stop();
    const filtered = selected.filter(acceptableRadioFile).slice(0, MAX_RADIO_FILES);
    setFiles(filtered);
    setMode("all");
    setMessage(filtered.length
      ? "Loaded " + filtered.length + " local audio files (not uploaded). Press Play continuous radio."
      : "No supported nonempty audio files were selected. Use MP3, WAV, OGG, M4A or compatible audio.");
  }

  function toggleShuffle() { setShuffle(value => !value); }
  function toggleRepeat() { setRepeatAll(value => !value); }

  useEffect(() => {
    controllerRef.current = { toggle, next, prev, stop, shuffle: toggleShuffle, repeat: toggleRepeat };
    return () => { controllerRef.current = null; };
  });

  const current = index >= 0 ? queue[index] : null;
  return (
    <section aria-label="Continuous local radio" className="mt-5 rounded-2xl border border-amber/40 bg-[#201713] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-2xl"><Headphones aria-hidden="true" /> Continuous Radio · Local Audio</h3>
          <p className="mt-2 max-w-3xl text-sm text-mist">
            Choose music files you own or are authorized to play from this device.
            One Play starts the playlist; it advances automatically when each file ends.
            No uploads, direct Suno stream scraping, or secret audio downloads.
          </p>
        </div>
        <span className="rounded-full border border-amber/40 px-3 py-2 text-xs text-amber">
          {active ? playing ? "LOCAL RADIO ON AIR" : "LOCAL RADIO PAUSED" : "LOCAL RADIO READY"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="radio-local-files" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber/50 px-4 text-sm">
          <Upload size={17} aria-hidden="true" /> Choose audio files
        </label>
        <input type="file" id="radio-local-files" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm" multiple
          onChange={addAudio} className="sr-only" />
        <label htmlFor="radio-local-folder" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-4 text-sm">
          <FolderOpen size={17} aria-hidden="true" /> Choose music folder
        </label>
        <input type="file" id="radio-local-folder" ref={folderInputRef} accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm"
          multiple onChange={addAudio} className="sr-only" />
        <span className="text-xs text-mist">{files.length} selected files (max {MAX_RADIO_FILES}) · current station: {stationTitle}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-xs text-mist">
          Playlist source
          <select value={mode} onChange={event => setModeSafe(event.target.value as "all" | "station")}
            className="mt-2 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-cream">
            <option value="all">All locally selected files ({files.length})</option>
            <option value="station">Current station title matches ({matched.length}/{stationSongs.length})</option>
          </select>
        </label>
        <div className="rounded-xl border border-line bg-bg p-3 text-xs text-mist">
          <p className="font-semibold text-amber">Station match: {matched.length} / {stationSongs.length}</p>
          <p className="mt-1">Matching uses song titles in filenames, not an unauthorized Suno feed. Ambiguous titles are skipped. Choose All selected files to play everything regardless of matching.</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-amber/20 bg-bg p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber">Now playing · {index >= 0 ? index + 1 : 0} / {queue.length}</p>
        <p className="mt-1 truncate font-display text-xl">{current?.title || "Choose your own audio and press Play"}</p>
        <p className="text-xs text-mist">{current?.albumTitle || "Continuous local radio"}</p>
        <audio ref={audioRef} controls preload="metadata" className="mt-3 w-full"
          onEnded={next} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onError={() => {
            if (sourceRef.current) setMessage("This browser could not decode the selected file. Try MP3 or WAV.");
          }}
          aria-label="Continuous local radio audio player" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!queue.length} onClick={toggle}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-4 font-semibold text-ink disabled:opacity-40">
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {playing ? "Pause" : "Play continuous radio"}
          </button>
          <button type="button" disabled={!active} onClick={prev}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm disabled:opacity-40">
            <SkipBack size={16} aria-hidden="true" /> Previous
          </button>
          <button type="button" disabled={!active} onClick={next}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm disabled:opacity-40">
            <SkipForward size={16} aria-hidden="true" /> Next
          </button>
          <button type="button" disabled={!active} onClick={() => { stop(); setMessage("Local radio stopped."); }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm disabled:opacity-40">
            <Square size={16} aria-hidden="true" /> Stop
          </button>
          <button type="button" aria-pressed={shuffle} onClick={toggleShuffle}
            className={"inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm " +
              (shuffle ? "border-amber text-amber" : "border-line")}>
            <Shuffle size={16} aria-hidden="true" /> Shuffle {shuffle ? "on" : "off"}
          </button>
          <button type="button" aria-pressed={repeatAll} onClick={toggleRepeat}
            className={"inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm " +
              (repeatAll ? "border-amber text-amber" : "border-line")}>
            <Repeat size={16} aria-hidden="true" /> Repeat all {repeatAll ? "on" : "off"}
          </button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-sm text-amber">{message}</p>
      <p className="mt-2 text-xs text-mist">
        Files remain in this tab's memory and must be selected again after a reload.
        Browser autoplay and codec rules still apply, but end-of-track events and queue advances are controlled here.
        Official Suno embeds remain a separate, manual listening option above.
      </p>
    </section>
  );
}
