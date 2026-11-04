import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BookOpen, Download, Mic, Play, RotateCcw, Save, Square, Trash2 } from "lucide-react";
import { analyzeVerse } from "../../scripts/writers-flow.mjs";
import { safeClipName } from "../../scripts/freestyle-dojo.mjs";
import {
  BAR_AUDIO_SECONDS, MAX_BAR_AUDIO_BYTES, MAX_BAR_REVIEW_NOTE, MAX_BAR_SAMPLES_PER_PAGE, MAX_BAR_TEXT,
  deleteBarSample, listBarSamples, saveBarReview, saveBarSample, type BarReview, type BarSample
} from "@/lib/dojoRecordings";

type Page = { id: string; title: string; body: string };
export function BarReviewSampler({ page }: { page?: Page }) {
  const [barText, setBarText] = useState("");
  const [selectedLine, setSelectedLine] = useState("");
  const [samples, setSamples] = useState<BarSample[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, BarReview>>({});
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Save a written bar, or record a short microphone delivery to hear it back.");
  const [fallback, setFallback] = useState<BarSample | null>(null);
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrl = useRef("");
  const mounted = useRef(true);
  const sourcePageRef = useRef(page?.id);
  const stoppingRef = useRef(false);
  const startingRef = useRef(false);
  const lines = analyzeVerse(page?.body || "").rows.filter(row => row.written && row.text).slice(0, 60);
  const audioSamples = samples.filter(sample => sample.audio);
  const selectedA = audioSamples.find(sample => sample.id === compareA);
  const selectedB = audioSamples.find(sample => sample.id === compareB);

  useEffect(() => { sourcePageRef.current = page?.id; }, [page?.id]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      micRef.current?.getTracks().forEach(track => track.stop());
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    setBarText("");
    setSelectedLine("");
    setSamples([]);
    setReviewDrafts({});
    setCompareA("");
    setCompareB("");
    setFallback(null);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = "";
    setPreview(null);
    if (page?.id) {
      void listBarSamples(page.id).then(items => {
        if (!disposed) setSamples(items);
      }).catch(() => {
        if (!disposed) setNotice("Sample storage is unavailable. Review permissions or try a private export.");
      });
    }
    return () => { disposed = true; };
  }, [page?.id]);

  function selectLine(event: ChangeEvent<HTMLSelectElement>) {
    const selected = event.target.value;
    setSelectedLine(selected);
    if (!selected) return;
    const row = lines.find(item => String(item.lineNumber) === selected);
    if (row) setBarText(row.text.slice(0, MAX_BAR_TEXT));
  }

  function newSample(text: string, blob?: Blob, mimeType = ""): BarSample {
    return {
      id: crypto.randomUUID(), pageId: page!.id,
      text, createdAt: new Date().toISOString(), mimeType,
      ...(blob ? { audio: blob } : {})
    };
  }

  async function commit(sample: BarSample) {
    try {
      await saveBarSample(sample);
      if (mounted.current && sourcePageRef.current === sample.pageId) {
        setSamples(await listBarSamples(sample.pageId));
        setNotice(sample.audio ? "Bar delivery saved privately. Listen, compare, or export below." : "Written bar saved for review.");
      }
    } catch (error) {
      if (mounted.current && sourcePageRef.current === sample.pageId) {
        setFallback(sample);
        setNotice(sample.audio
          ? "Could not save microphone audio. Export this unsaved take below before leaving the page."
          : "Browser storage failed. Copy your bar text before leaving.");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function saveTextBar() {
    const text = barText.trim();
    if (!page || busy || capturing || !text || text.length > MAX_BAR_TEXT || fallback) return;
    setBusy(true);
    void commit(newSample(text));
  }

  function stopRecording() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const current = recorderRef.current;
    if (current?.state === "recording" && !stoppingRef.current) {
      stoppingRef.current = true;
      current.stop();
    }
    setCapturing(false);
  }

  async function recordBar() {
    const text = barText.trim();
    if (!page || busy || capturing || startingRef.current || fallback || !text || text.length > MAX_BAR_TEXT ||
        samples.length >= MAX_BAR_SAMPLES_PER_PAGE) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("Microphone recording requires HTTPS, browser permission, and MediaRecorder support.");
      return;
    }
    startingRef.current = true;
    setBusy(true);
    try {
      setNotice("Requesting microphone access only for this 12-second bar sample...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || sourcePageRef.current !== page.id) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      micRef.current = stream;
      const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const supported = types.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      const origin = page.id;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (mounted.current) setNotice("Microphone recorder failed; try a different browser or input.");
        stopRecording();
      };
      recorder.onstop = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        stream.getTracks().forEach(track => track.stop());
        micRef.current = null;
        recorderRef.current = null;
        stoppingRef.current = false;
        if (mounted.current) setCapturing(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || "audio/webm" });
        if (!blob.size || blob.size > MAX_BAR_AUDIO_BYTES) {
          if (mounted.current) {
            setBusy(false);
            setNotice(blob.size ? "Sample exceeds the 8 MB storage cap." : "No audio was captured. Try again.");
          }
          return;
        }
        const sample: BarSample = { id: crypto.randomUUID(), pageId: origin,
          text, createdAt: new Date().toISOString(), mimeType: blob.type, audio: blob };
        void commit(sample);
      };
      recorder.start(500);
      setCapturing(true);
      setNotice("Recording one bar. Speak or rap now; auto-stop after 12 seconds.");
      timeoutRef.current = setTimeout(stopRecording, BAR_AUDIO_SECONDS * 1000);
    } catch (error) {
      micRef.current?.getTracks().forEach(track => track.stop());
      micRef.current = null;
      setBusy(false);
      setNotice(error instanceof Error ? error.message : "Could not record this bar.");
    } finally {
      startingRef.current = false;
    }
  }


  function reviewFor(sample: BarSample): BarReview {
    return reviewDrafts[sample.id] || {
      note: sample.reviewNote || "",
      rating: sample.rating || 0,
      keeper: Boolean(sample.keeper)
    };
  }

  function patchReview(sample: BarSample, change: Partial<BarReview>) {
    setReviewDrafts(previous => ({
      ...previous,
      [sample.id]: { ...(previous[sample.id] || {
        note: sample.reviewNote || "", rating: sample.rating || 0, keeper: Boolean(sample.keeper)
      }), ...change }
    }));
  }

  async function persistReview(sample: BarSample) {
    if (!page || busy || capturing) return;
    const targetPage = page.id;
    const review = reviewFor(sample);
    setBusy(true);
    try {
      await saveBarReview(targetPage, sample.id, review);
      const refreshed = await listBarSamples(targetPage);
      if (!mounted.current || sourcePageRef.current !== targetPage) return;
      setSamples(refreshed);
      // Keep unsaved notes in other cards; reconcile the unique keeper flag.
      setReviewDrafts(previous => Object.fromEntries(refreshed.map(item => {
        const otherDraft = previous[item.id];
        return [item.id, {
          note: item.id === sample.id ? review.note : (otherDraft?.note ?? item.reviewNote ?? ""),
          rating: item.id === sample.id ? review.rating : (otherDraft?.rating ?? item.rating ?? 0),
          keeper: Boolean(item.keeper)
        }];
      })));
      setNotice(review.keeper ? "Keeper selected for this lyric page. Previous keeper cleared." :
        "Bar review saved privately.");
    } catch (error) {
      if (mounted.current && sourcePageRef.current === targetPage) {
        setNotice(error instanceof Error ? error.message : "Review could not be saved.");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function pickAB(slot: "A" | "B", id: string) {
    if (slot === "A") {
      setCompareA(id);
      if (id && id === compareB) setCompareB("");
    } else {
      setCompareB(id);
      if (id && id === compareA) setCompareA("");
    }
  }

  function download(sample: BarSample) {
    if (!sample.audio) return;
    const url = URL.createObjectURL(sample.audio);
    const a = document.createElement("a");
    const ext = sample.mimeType.includes("mp4") ? "m4a" : "webm";
    a.href = url;
    a.download = safeClipName(page?.title || "freestyle") + "-bar-" + sample.createdAt.replace(/[:.]/g, "-") + "." + ext;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  async function copyBar(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Bar copied to your clipboard.");
    } catch {
      setNotice("Clipboard permission denied. Select the text to copy it manually.");
    }
  }

  function listen(sample: BarSample) {
    if (!sample.audio) return;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const url = URL.createObjectURL(sample.audio);
    previewUrl.current = url;
    setPreview({ id: sample.id, url });
  }

  async function remove(sample: BarSample) {
    if (!window.confirm("Delete this saved bar and its audio from this browser? Export it first if needed.")) return;
    try {
      await deleteBarSample(sample.id);
      if (page?.id === sample.pageId) setSamples(await listBarSamples(page.id));
      setCompareA(current => current === sample.id ? "" : current);
      setCompareB(current => current === sample.id ? "" : current);
      if (preview?.id === sample.id) {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = "";
        setPreview(null);
      }
      setNotice("Bar sample deleted.");
    } catch { setNotice("Could not delete this bar sample."); }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-amber/30 bg-surface p-4 sm:p-6"
      aria-label="Bar Review Sampler">
      <header>
        <h3 className="flex items-center gap-2 font-display text-2xl">
          <Mic size={22} aria-hidden="true" /> Bar Review Sampler
        </h3>
        <p className="mt-2 text-sm text-mist">
          Pick a line from your Freestyle Book or type a new bar. Save it as text,
          or record a short microphone take and replay different deliveries to hear what works.
          Nothing uploads or edits the original lyric page.
        </p>
      </header>
      {!page ? (
        <p className="rounded-xl border border-line p-4 text-sm text-amber">Select or create a Freestyle Book page to start a bar collection.</p>
      ) : (
        <>
          <label className="block text-sm text-mist">Choose a lyric line
            <select value={selectedLine} onChange={selectLine} disabled={capturing || busy}
              className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream">
              <option value="">Write my own bar</option>
              {lines.map(line => (
                <option key={line.lineNumber} value={String(line.lineNumber)}>
                  {"Line " + line.lineNumber + ": " + line.text.slice(0, 90)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-mist">Bar or sentence (up to {MAX_BAR_TEXT} characters)
            <textarea value={barText} maxLength={MAX_BAR_TEXT} rows={3} disabled={capturing || busy}
              onChange={event => { setBarText(event.target.value); setSelectedLine(""); }}
              placeholder="One sentence. One punchline. One delivery worth hearing again."
              className="mt-2 block w-full resize-y rounded-xl border border-line bg-bg p-3 font-mono text-sm text-cream" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveTextBar}
              disabled={busy || capturing || !!fallback || !barText.trim() || samples.length >= MAX_BAR_SAMPLES_PER_PAGE}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber/50 px-4 text-sm disabled:opacity-40">
              <Save size={16} aria-hidden="true" /> Save written bar
            </button>
            <button type="button" onClick={() => void recordBar()}
              disabled={busy || capturing || !!fallback || !barText.trim() || samples.length >= MAX_BAR_SAMPLES_PER_PAGE}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-4 font-semibold text-ink disabled:opacity-40">
              <Mic size={16} aria-hidden="true" /> Record 12-second take
            </button>
            <button type="button" disabled={!capturing} onClick={stopRecording}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm disabled:opacity-40">
              <Square size={16} aria-hidden="true" /> Stop sample
            </button>
          </div>
          {capturing && <p role="status" className="font-semibold text-heat">
            Recording microphone · max {BAR_AUDIO_SECONDS} seconds · use Stop to end early
          </p>}
          <p aria-live="polite" className="text-sm text-amber">{notice}</p>
          {fallback && (
            <div className="rounded-xl border border-heat/50 bg-bg p-4">
              <p className="text-sm font-semibold text-heat">Unsaved bar sample. Export it before leaving.</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{fallback.text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {fallback.audio && <button type="button" onClick={() => download(fallback)}
                  className="min-h-11 rounded-xl bg-amber px-4 text-ink">Download unsaved audio</button>}
                <button type="button" onClick={() => void copyBar(fallback.text)}
                  className="min-h-11 rounded-xl border border-line px-4">Copy bar text</button>
                <button type="button" onClick={() => { setFallback(null); setNotice("Unsaved sample dismissed."); }}
                  className="min-h-11 rounded-xl border border-line px-4">Dismiss after backup</button>
              </div>
            </div>
          )}

          <section aria-label="A/B comparison for bar deliveries" className="rounded-2xl border border-amber/30 bg-[#251b16] p-4">
            <h4 className="font-display text-xl">A/B Bar Audition</h4>
            <p className="mt-2 text-xs text-mist">
              Select two recorded attempts and switch between them in one audio player. Compare delivery by ear;
              no AI score or fabricated timing analysis. Your review ratings are entirely yours.
            </p>
            {audioSamples.length < 2 ? (
              <p className="mt-3 text-sm text-mist">Record at least two audio takes on this lyric page to compare A and B.</p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(["A", "B"] as const).map(slot => {
                  const choice = slot === "A" ? compareA : compareB;
                  const selected = slot === "A" ? selectedA : selectedB;
                  return (
                    <div key={slot} className="rounded-xl border border-line bg-bg p-4">
                      <label className="block text-sm font-semibold text-amber" htmlFor={"bar-compare-" + slot}>
                        Take {slot}
                      </label>
                      <select id={"bar-compare-" + slot} value={choice}
                        onChange={event => pickAB(slot, event.target.value)}
                        className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm">
                        <option value="">Choose a recording</option>
                        {audioSamples.map((item, index) => (
                          <option key={item.id} value={item.id}>
                            {"Sample " + (samples.length - samples.indexOf(item)) + " · " +
                              new Date(item.createdAt).toLocaleString() + (item.keeper ? " · Keeper" : "")}
                          </option>
                        ))}
                      </select>
                      {selected && (
                        <>
                          <p className="mt-3 whitespace-pre-wrap break-words font-mono text-sm">{selected.text}</p>
                          <p className="mt-2 text-xs text-mist">Your rating: {selected.rating || "Unrated"}/5
                            {selected.keeper ? " · Keeper" : ""}</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-mist">
                            {selected.reviewNote || "No review note yet"}
                          </p>
                          <button type="button" onClick={() => listen(selected)}
                            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-4 font-semibold text-ink">
                            <Play size={16} aria-hidden="true" /> Listen to {slot}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-mist">Playback uses the same audio player as the saved takes below. Select Listen A or Listen B to switch.</p>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-display text-xl">Bar attempts</h4>
            <span className="text-sm text-amber">{samples.length} / {MAX_BAR_SAMPLES_PER_PAGE} samples</span>
          </div>
          <p className="text-xs text-mist">
            Try a different delivery and save another attempt. Audio stays in this browser's IndexedDB
            and is NOT included in your lyric-book JSON backup. Export important takes individually.
          </p>
          {!samples.length && <p className="text-sm text-mist">No saved bar samples yet. Your first punchline awaits.</p>}
          <ul className="space-y-2">
            {samples.map((sample, i) => (
              <li key={sample.id} className="rounded-xl border border-line bg-bg p-3">
                <p className="text-xs text-amber">Sample {samples.length - i} · {new Date(sample.createdAt).toLocaleString()}{sample.keeper ? " · KEEPER" : ""}</p>
                <p className="mt-2 whitespace-pre-wrap break-words font-mono text-sm">{sample.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sample.audio && <>
                    <button type="button" onClick={() => listen(sample)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm">
                      <Play size={15} aria-hidden="true" /> Listen
                    </button>
                    <button type="button" onClick={() => download(sample)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-amber/40 px-3 text-sm">
                      <Download size={15} aria-hidden="true" /> Export
                    </button>
                  </>}
                  <button type="button" onClick={() => void copyBar(sample.text)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm">
                    <BookOpen size={15} aria-hidden="true" /> Copy bar
                  </button>
                  <button type="button" onClick={() => { setBarText(sample.text); setSelectedLine(""); }}
                    disabled={busy || capturing} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm disabled:opacity-40">
                    <RotateCcw size={15} aria-hidden="true" /> Try again
                  </button>
                  <button type="button" onClick={() => void remove(sample)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-heat/40 px-3 text-sm text-heat">
                    <Trash2 size={15} aria-hidden="true" /> Delete
                  </button>
                </div>

                <div className="mt-3 grid gap-3 rounded-xl border border-amber/20 bg-[#241b16] p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="block text-xs text-mist">
                    Review notes (delivery, flow, breath, punchline)
                    <textarea rows={2} maxLength={MAX_BAR_REVIEW_NOTE} value={reviewFor(sample).note}
                      disabled={busy || capturing} onChange={event => patchReview(sample, { note: event.target.value })}
                      placeholder="What worked? What should change next take?"
                      className="mt-2 block w-full resize-y rounded-lg border border-line bg-bg p-3 text-sm text-cream disabled:opacity-50" />
                  </label>
                  <div className="space-y-3">
                    <label className="block text-xs text-mist">
                      Your rating
                      <select value={reviewFor(sample).rating} disabled={busy || capturing}
                        onChange={event => patchReview(sample, { rating: Number(event.target.value) })}
                        className="mt-2 block min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm disabled:opacity-50">
                        <option value={0}>Unrated</option>
                        {[1, 2, 3, 4, 5].map(rating =>
                          <option key={rating} value={rating}>{rating} / 5</option>
                        )}
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-xs text-amber">
                      <input type="checkbox" checked={reviewFor(sample).keeper} disabled={busy || capturing}
                        onChange={event => patchReview(sample, { keeper: event.target.checked })} />
                      Mark as keeper
                    </label>
                    <button type="button" disabled={busy || capturing}
                      onClick={() => void persistReview(sample)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber/50 px-4 text-sm text-cream disabled:opacity-40">
                      <Save size={16} aria-hidden="true" /> Save review
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {preview && <audio controls autoPlay src={preview.url} aria-label="Bar sample playback" className="w-full" />}
        </>
      )}
    </section>
  );
}
