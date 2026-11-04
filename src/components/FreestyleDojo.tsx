import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AudioLines, BookOpen, Download, Mic, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { dojoBeat, dojoBpm, dojoPlan, DOJO_BARS, multisyllablePatterns, safeClipName } from "../../scripts/freestyle-dojo.mjs";
import {
  deleteDojoClip, listDojoClips, MAX_CLIPS_PER_PAGE, MAX_RECORD_SECONDS,
  saveDojoClip, type DojoClip
} from "@/lib/dojoRecordings";

type LyricPage = { id: string; title: string; body: string };
type Step = ReturnType<typeof dojoBeat>;
const AUDIO_LIMIT = 50 * 1024 * 1024;

export function FreestyleDojo({ page }: { page?: LyricPage }) {
  const [bpm, setBpm] = useState(90);
  const [bars, setBars] = useState(16);
  const [clickOn, setClickOn] = useState(true);
  const [mixBeat, setMixBeat] = useState(true);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [step, setStep] = useState<Step>(dojoBeat(-1, 16));
  const [beatUrl, setBeatUrl] = useState("");
  const [beatName, setBeatName] = useState("");
  const [clips, setClips] = useState<DojoClip[]>([]);
  const [pendingClip, setPendingClip] = useState<DojoClip | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [notice, setNotice] = useState("One-bar count-in, then your selected number of four-beat bars.");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const beatSource = useRef<MediaElementAudioSourceNode | null>(null);
  const recordDest = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const micSource = useRef<MediaStreamAudioSourceNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatFileUrl = useRef("");
  const previewObjectUrl = useRef("");
  const currentPageId = useRef(page?.id);
  const active = useRef(false);
  const isStarting = useRef(false);
  const mounted = useRef(true);
  const beatCursor = useRef(0);
  const nextBeatTime = useRef(0);
  const startAt = useRef(0);
  const lastShown = useRef(-2);

  useEffect(() => {
    currentPageId.current = page?.id;
  }, [page?.id]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (ticker.current !== null) clearInterval(ticker.current);
      active.current = false;
      audioRef.current?.pause();
      if (recorder.current?.state === "recording") recorder.current.stop();
      micStream.current?.getTracks().forEach(track => track.stop());
      if (beatFileUrl.current) URL.revokeObjectURL(beatFileUrl.current);
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
      // MediaRecorder.onstop retains the blob and attempts its IndexedDB save.
      void audioCtx.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setClips([]);
    setPendingClip(null);
    if (!page?.id) return;
    void listDojoClips(page.id).then(items => {
      if (!cancelled) setClips(items);
    }).catch(() => {
      if (!cancelled) setNotice("Recording storage is unavailable; downloadable takes still work.");
    });
    return () => { cancelled = true; };
  }, [page?.id]);

  const rhymes = multisyllablePatterns(page?.body || "");
  const phaseText = step.phase === "count-in" ? "Count in · " + step.beat :
    step.phase === "verse" ? "Bar " + step.bar + " / " + bars + " · Beat " + step.beat :
    step.phase === "complete" ? "Verse complete" : "Ready to flow";

  function loadBeat(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    if (active.current || isStarting.current) return;
    if (!file.type.startsWith("audio/") || file.size > AUDIO_LIMIT || file.size === 0) {
      setNotice("Choose a local audio file under 50 MB.");
      return;
    }
    audioRef.current?.pause();
    if (beatFileUrl.current) URL.revokeObjectURL(beatFileUrl.current);
    const url = URL.createObjectURL(file);
    beatFileUrl.current = url;
    setBeatUrl(url);
    setBeatName(file.name);
    setNotice("Local backing track loaded. No audio was uploaded.");
  }

  function removeBeat() {
    if (active.current || isStarting.current) return;
    audioRef.current?.pause();
    setBeatUrl("");
    setBeatName("");
    if (beatFileUrl.current) URL.revokeObjectURL(beatFileUrl.current);
    beatFileUrl.current = "";
  }

  async function ensureAudio(): Promise<AudioContext> {
    const ctx = audioCtx.current || new AudioContext();
    audioCtx.current = ctx;
    await ctx.resume();
    if (beatUrl && audioRef.current && !beatSource.current) {
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(ctx.destination);
      beatSource.current = source;
    }
    return ctx;
  }

  function clickAt(ctx: AudioContext, when: number, beatIndex: number) {
    const first = beatIndex % 4 === 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(first ? 1100 : 760, when);
    gain.gain.setValueAtTime(first ? 0.13 : 0.075, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.06);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  function endSession(completed = false) {
    if (ticker.current !== null) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
    active.current = false;
    if (audioRef.current) audioRef.current.pause();
    const rec = recorder.current;
    if (rec?.state === "recording") rec.stop();
    setRunning(false);
    setRecording(false);
    if (completed) setStep(dojoBeat(4 + bars * 4, bars));
    setNotice(completed ? "Take complete. Your recording is being saved if recording was enabled." :
      "Practice stopped. Recordings save when the recorder finishes.");
  }

  function beginClock(ctx: AudioContext, useBpm: number, useBars: number) {
    const plan = dojoPlan(useBpm, useBars);
    const timerMs = 25;
    beatCursor.current = 0;
    lastShown.current = -2;
    startAt.current = ctx.currentTime + 0.09;
    nextBeatTime.current = startAt.current;
    active.current = true;
    setStep(dojoBeat(-1, useBars));
    setRunning(true);
    if (beatUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => setNotice(
        "Beat autoplay was blocked; press play in its local player. The metronome still works."
      ));
    }
    const tick = () => {
      if (!active.current) return;
      const now = ctx.currentTime;
      while (beatCursor.current < plan.totalBeats && nextBeatTime.current < now + 0.12) {
        if (clickOn) clickAt(ctx, nextBeatTime.current, beatCursor.current);
        beatCursor.current += 1;
        nextBeatTime.current += plan.beatSeconds;
      }
      const elapsed = now - startAt.current;
      const index = elapsed >= 0 ? Math.min(plan.totalBeats, Math.floor(elapsed / plan.beatSeconds)) : -1;
      if (index !== lastShown.current) {
        lastShown.current = index;
        setStep(dojoBeat(index, useBars));
      }
      if (index >= plan.totalBeats || elapsed >= MAX_RECORD_SECONDS) endSession(true);
    };
    ticker.current = setInterval(tick, timerMs);
    tick();
  }

  async function start(withMic: boolean) {
    if (active.current || isStarting.current || !page?.id) return;
    isStarting.current = true;
    setStarting(true);
    setNotice(withMic ? "Requesting microphone access for a private recording..." : "Preparing metronome...");
    try {
      if (withMic && clips.length >= MAX_CLIPS_PER_PAGE) {
        throw new Error("This lyric page has 12 clips. Export and delete one before recording more.");
      }
      const ctx = await ensureAudio();
      if (withMic) {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
          throw new Error("Recording requires microphone permissions and a supported secure browser.");
        }
        const mic = await navigator.mediaDevices.getUserMedia({ audio: {
          echoCancellation: true, noiseSuppression: true, autoGainControl: false
        } });
        micStream.current = mic;
        const destination = ctx.createMediaStreamDestination();
        recordDest.current = destination;
        const input = ctx.createMediaStreamSource(mic);
        micSource.current = input;
        input.connect(destination); // Do not monitor microphone through speakers.
        if (mixBeat && beatUrl && beatSource.current) {
          beatSource.current.connect(destination);
        }
        const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
        const mimeType = preferred.find(mime => MediaRecorder.isTypeSupported(mime));
        const rec = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
        recorder.current = rec;
        const chunks: Blob[] = [];
        const sourcePage = page.id;
        const sourceTitle = page.title || "Untitled freestyle";
        const sourceBpm = dojoBpm(bpm);
        const sourceBars = bars;
        rec.ondataavailable = (event: BlobEvent) => { if (event.data.size) chunks.push(event.data); };
        rec.onerror = () => {
          if (mounted.current) setNotice("Recorder reported an error. Stop and try again.");
        };
        rec.onstop = () => {
          mic.getTracks().forEach(track => track.stop());
          input.disconnect();
          if (beatSource.current && recordDest.current) {
            try { beatSource.current.disconnect(recordDest.current); } catch { /* already disconnected */ }
          }
          destination.stream.getTracks().forEach(track => track.stop());
          recordDest.current = null;
          micStream.current = null;
          micSource.current = null;
          recorder.current = null;
          const blob = new Blob(chunks, { type: rec.mimeType || chunks[0]?.type || "audio/webm" });
          if (!blob.size) {
            if (mounted.current) setNotice("No audio captured. Please check microphone permission.");
            return;
          }
          const clip: DojoClip = {
            id: crypto.randomUUID(), pageId: sourcePage, title: sourceTitle,
            bpm: sourceBpm, bars: sourceBars, createdAt: new Date().toISOString(),
            blob, mimeType: blob.type
          };
          void saveDojoClip(clip).then(async () => {
            if (mounted.current && currentPageId.current === sourcePage) {
              setClips(await listDojoClips(sourcePage));
              setNotice("Recording saved privately beside this lyric page. Export a copy for safekeeping.");
            }
          }).catch(() => {
            if (mounted.current && currentPageId.current === sourcePage) {
              setPendingClip(clip);
              setNotice("Browser storage failed. Download the unsaved recording below before leaving this room.");
            }
          });
        };
        rec.start(1000);
        setRecording(true);
      }
      beginClock(ctx, bpm, bars);
      setNotice(withMic ? "Recording microphone" + (mixBeat && beatUrl ? " plus local beat." : " only.") +
        " One-bar count-in, then your verse." : "Practice running. One-bar count-in, then your verse.");
    } catch (error) {
      micStream.current?.getTracks().forEach(track => track.stop());
      micStream.current = null;
      micSource.current?.disconnect();
      micSource.current = null;
      if (beatSource.current && recordDest.current) {
        try { beatSource.current.disconnect(recordDest.current); } catch { /* not connected */ }
      }
      if (recordDest.current) recordDest.current.stream.getTracks().forEach(track => track.stop());
      recordDest.current = null;
      setNotice(error instanceof Error ? error.message : "Could not start this practice session.");
    } finally {
      isStarting.current = false;
      setStarting(false);
    }
  }

  function download(clip: DojoClip) {
    const url = URL.createObjectURL(clip.blob);
    const ext = clip.mimeType.includes("mp4") ? "m4a" : "webm";
    const a = document.createElement("a");
    a.href = url;
    a.download = safeClipName(clip.title) + "-" + clip.createdAt.slice(0, 10) + "." + ext;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  function preview(clip: DojoClip) {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
    const url = URL.createObjectURL(clip.blob);
    previewObjectUrl.current = url;
    setPreviewUrl(url);
  }

  async function discard(clip: DojoClip) {
    if (!window.confirm("Delete this local recording? This cannot be undone. Export it first if needed.")) return;
    try {
      await deleteDojoClip(clip.id);
      if (page?.id) setClips(await listDojoClips(page.id));
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = "";
      setPreviewUrl("");
      setNotice("Local recording deleted.");
    } catch {
      setNotice("Could not delete this clip. Check browser storage permissions.");
    }
  }

  const progress = step.phase === "verse" ? Math.round((step.bar - 1 + (step.beat - 1) / 4) / bars * 100) :
    step.phase === "complete" ? 100 : 0;

  return (
    <div role="tabpanel" aria-label="Freestyle Dojo" className="space-y-5">
      <header className="rounded-2xl border border-amber/30 bg-gradient-to-br from-[#3a2019] to-[#121321] p-5">
        <h2 className="flex items-center gap-2 font-display text-3xl"><Mic aria-hidden="true" /> Freestyle Dojo</h2>
        <p className="mt-2 max-w-3xl text-sm text-mist">Your private practice booth. Train to a four-beat clock, explore long-word end patterns, load a beat from your device, and capture a microphone take with an optional local backing-track mix.</p>
        <p className="mt-2 text-xs text-amber">Selected page: {page ? page.title || "Untitled freestyle" : "None. Create or select a Freestyle Book page to record."}</p>
      </header>
      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Metronome and verse timer">
        <h3 className="font-display text-xl">Practice clock</h3>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-sm text-mist">Tempo (BPM)
            <input type="number" min={55} max={180} step={1} value={bpm} disabled={running || starting}
              onChange={(e) => setBpm(dojoBpm(e.target.value))}
              className="mt-1 block min-h-11 w-28 rounded-xl border border-line bg-bg px-3 text-cream" />
          </label>
          <label className="text-sm text-mist">Verse length
            <select value={bars} disabled={running || starting} onChange={(e) => setBars(Number(e.target.value))}
              className="mt-1 block min-h-11 rounded-xl border border-line bg-bg px-3 text-cream">
              {DOJO_BARS.map(count => <option key={count} value={count}>{count} bars</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={clickOn} disabled={running || starting}
              onChange={(e) => setClickOn(e.target.checked)} /> Audible click
          </label>
        </div>
        <div className="mt-4 rounded-2xl border border-amber/20 bg-bg p-5 text-center">
          <p aria-live="polite" className="font-display text-2xl text-amber">{phaseText}</p>
          <div className="mt-3 grid grid-cols-4 gap-2" aria-label="Four-beat meter">
            {[1, 2, 3, 4].map(n => (
              <span key={n} className={"rounded-lg py-3 text-lg " +
                (running && step.beat === n ? "bg-amber font-bold text-ink" : "bg-white/5 text-mist")}>{n}</span>
            ))}
          </div>
          <div role="progressbar" aria-label="Verse completion" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={progress} className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-amber" style={{ width: progress + "%" }} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={!page || running || starting}
            onClick={() => void start(false)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-5 font-semibold text-ink disabled:opacity-40">
            <Play size={16} aria-hidden="true" /> Start practice
          </button>
          <button type="button" disabled={!page || running || starting || clips.length >= MAX_CLIPS_PER_PAGE}
            onClick={() => void start(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber/60 px-5 text-sm text-cream disabled:opacity-40">
            <Mic size={16} aria-hidden="true" /> Record a take
          </button>
          <button type="button" disabled={!running} onClick={() => endSession(false)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-5 text-sm disabled:opacity-40">
            <Pause size={16} aria-hidden="true" /> Stop
          </button>
          <button type="button" disabled={running || starting} onClick={() => setStep(dojoBeat(-1, bars))}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm disabled:opacity-40">
            <RotateCcw size={15} aria-hidden="true" /> Reset display
          </button>
        </div>
        <p aria-live="polite" className="mt-3 text-sm text-amber">{notice}</p>
        {recording && <p role="status" className="mt-2 text-sm font-bold text-heat">Recording live · Microphone permission granted · Stops at verse end</p>}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Local backing track">
        <h3 className="flex items-center gap-2 font-display text-xl"><AudioLines size={21} aria-hidden="true" /> Your backing beat</h3>
        <p className="mt-2 text-sm text-mist">Choose a beat file from your device. It stays local, and you can mix it into your take. Suno's embedded player cannot be captured or downloaded here.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="dojo-beat" className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-amber/50 px-4 text-sm">Choose local audio</label>
          <input id="dojo-beat" type="file" accept="audio/*" disabled={running || starting}
            onChange={loadBeat} className="sr-only" />
          <span className="max-w-[250px] truncate text-sm text-mist">{beatName || "No beat loaded"}</span>
          {beatUrl && <button type="button" onClick={removeBeat} disabled={running || starting}
            className="min-h-11 rounded-xl border border-line px-4 text-sm disabled:opacity-40">Remove beat</button>}
        </div>
        <audio ref={audioRef} src={beatUrl || undefined} controls preload="metadata"
          className={"mt-4 w-full " + (beatUrl ? "" : "hidden")} aria-label="Local backing track player" />
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={mixBeat} disabled={running || starting}
            onChange={e => setMixBeat(e.target.checked)} />
          Include locally loaded beat in microphone recordings
        </label>
        <p className="mt-2 text-xs text-mist">Use headphones to reduce microphone bleed. Only the microphone and your selected local beat are recorded. The click is for monitoring, not included in the saved mix.</p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Multi-syllable end-word patterns">
        <h3 className="font-display text-xl">Long-rhyme pattern map</h3>
        <p className="mt-2 text-sm text-mist">Spelling-based groups of three-plus-syllable end words, highlighted when two lines share a vowel-ending pattern. These are writing clues, not verified phonetic or multisyllabic rhyme matches.</p>
        {rhymes.length === 0 ? <p className="mt-3 text-sm text-mist">No repeating long-word endings on this page yet. Try words like “generation” and “celebration.”</p> : (
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {rhymes.slice(0, 16).map((group, index) => (
              <li key={group.pattern} className="rounded-xl border border-amber/30 bg-bg p-4">
                <p className="text-xs text-amber">Family {index + 1} · ending “{group.pattern}”</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {group.words.map(word => (
                    <li key={word.line + ":" + word.word}
                      className="rounded-full border border-amber/35 bg-amber/15 px-3 py-2 text-sm font-semibold text-cream">
                      {word.word} <span className="text-xs font-normal text-mist">line {word.line}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Saved freestyle recordings">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-xl"><BookOpen size={20} aria-hidden="true" /> Takes for this lyric page</h3>
          <span className="text-sm text-amber">{clips.length} / {MAX_CLIPS_PER_PAGE} saved</span>
        </div>
        <p className="mt-2 text-xs text-mist">Audio is stored in this browser's IndexedDB by lyric-page ID. JSON Freestyle Book exports do NOT include recordings. Download each take before clearing browser data or switching devices.</p>
        {clips.length === 0 && <p className="mt-4 text-sm text-mist">No takes recorded for this page yet.</p>}
        <ul className="mt-4 space-y-2">
          {clips.map((clip) => (
            <li key={clip.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{clip.title}</p>
                <p className="text-xs text-mist">{new Date(clip.createdAt).toLocaleString()} · {clip.bpm} BPM · {clip.bars} bars</p>
              </div>
              <button type="button" className="min-h-11 rounded-xl border border-line px-3 text-sm" onClick={() => preview(clip)}>Listen</button>
              <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-amber/50 px-3 text-sm"
                onClick={() => download(clip)}><Download size={16} aria-hidden="true" /> Export</button>
              <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-heat/50 px-3 text-sm text-heat"
                onClick={() => void discard(clip)}><Trash2 size={16} aria-hidden="true" /> Delete</button>
            </li>
          ))}
        </ul>
        {previewUrl && <audio src={previewUrl} controls className="mt-4 w-full" aria-label="Selected freestyle take preview" />}
        {pendingClip && (
          <div className="mt-4 rounded-xl border border-heat/60 p-4">
            <p className="font-semibold text-heat">This recording was not saved in the browser.</p>
            <button type="button" onClick={() => download(pendingClip)}
              className="mt-2 min-h-11 rounded-xl bg-amber px-4 font-semibold text-ink">Download unsaved take now</button>
          </div>
        )}
      </section>
    </div>
  );
}
