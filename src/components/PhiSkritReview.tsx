import { useState, type ChangeEvent } from "react";
import { FileJson2, FileUp, LockKeyhole, ShieldCheck, Music2 } from "lucide-react";
import {
  PHISKRIT_MAX_BYTES, parsePhiSkritCompositionText,
  type PhiSkritReview as Review,
} from "@/lib/phiskritCompositionReview";

/** Isolated review lane: no useHouse, mixExchange, queue or Backspin calls. */
export function PhiSkritReview() {
  const [review, setReview] = useState<Review | null>(null);
  const [filename, setFilename] = useState("");
  const [status, setStatus] = useState("Choose a locally exported PhiSkrit composition JSON to inspect it.");
  const [reading, setReading] = useState(false);

  async function receive(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    // Never retain old approval while a new file is being validated.
    setReview(null);
    setFilename("");
    setReading(true);
    setStatus("Reconstructing pattern events and timing…");
    try {
      if (file.size > PHISKRIT_MAX_BYTES) throw new RangeError("Files must be 96 KiB or smaller.");
      const result = parsePhiSkritCompositionText(await file.text());
      setReview(result);
      setFilename(file.name);
      setStatus("PASS: Every clip, repeat, note, tick and metadata field matches the v1 contract.");
    } catch (error) {
      setStatus("REJECTED: " + (error instanceof Error ? error.message : "Invalid composition file."));
    } finally {
      input.value = "";
      setReading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber/35 bg-[#170e0be8] p-4 text-cream shadow-2xl sm:p-6"
      id="phiskrit-review-workspace" aria-labelledby="phiskrit-review-heading">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-5">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber">
            More Bounce Labs / Creative Interop
          </p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl" id="phiskrit-review-heading">
            PhiSkrit Rhythm Review
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#d8c7b9]">
            Bring in a PhiSkrit v0.5 composition, inspect its rhythm,
            and verify its note timeline without touching your MBL queue,
            DJ decks, mixes, or album catalog.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
          <LockKeyhole size={15} aria-hidden="true" /> Read only · No playback authorization
        </span>
      </header>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(250px,0.5fr)]">
        <section className="min-w-0 rounded-2xl border border-white/15 bg-black/30 p-4 sm:p-5"
          aria-labelledby="phiskrit-load-title">
          <div className="flex items-center gap-2 text-amber">
            <FileUp size={19} aria-hidden="true" />
            <h3 className="font-display text-xl" id="phiskrit-load-title">Import for review</h3>
          </div>
          <p className="mt-3 text-sm text-[#d8c7b9]">
            Open Composer in PhiSkrit, export Composition JSON, then select
            that file here. All parsing happens locally. Nothing is uploaded or played.
          </p>
          <label className="mt-5 block text-sm font-semibold" htmlFor="phiskrit-file">
            Select PhiSkrit composition (.json)
          </label>
          <input id="phiskrit-file" type="file" accept=".json,application/json" disabled={reading}
            onChange={receive}
            className="mt-2 block min-h-11 w-full max-w-full rounded-xl border border-white/25 bg-surface/80 p-3 text-sm text-cream file:mr-3 file:rounded-lg file:border-0 file:bg-amber file:px-3 file:py-2 file:font-semibold file:text-ink" />
          <p role="status" aria-live="polite" className={"mt-4 rounded-xl border p-3 text-sm leading-relaxed " +
            (review ? "border-emerald-400/35 bg-emerald-900/20 text-emerald-200" :
              "border-amber/25 bg-amber/5 text-[#ecd6be]")}>{status}</p>
          {filename && <p className="mt-2 break-all text-xs text-[#c7b6a6]">Selected file: {filename}</p>}
          <p className="mt-3 text-xs leading-relaxed text-[#baab9f]">
            Strict v1 schema · 96 KiB file cap · 8 clips max · 128 events max.
            Rejected files never enter the preview.
          </p>
        </section>

        <aside className="rounded-2xl border border-white/15 bg-black/30 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-amber">
            <ShieldCheck size={19} aria-hidden="true" />
            <h3 className="font-display text-xl">Independent validation</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#d8c7b9]">
            MBL regenerates the arrangement from the declared clips and BPM,
            then compares every event and field. It does not trust the exported
            event list or reuse PhiSkrit&apos;s importer.
          </p>
          <div className="mt-5 rounded-xl border border-white/10 bg-surface/60 p-3 text-xs leading-relaxed text-[#d6c3b4]">
            <strong className="text-amber">Not the Agent Mix Studio.</strong>{" "}
            PhiSkrit compositions contain musical note events, not verified MBL
            album IDs. A structural PASS is not permission to operate the DJ
            rig or proof that a historical theory is correct.
          </div>
          <a href="https://michaelwave369.github.io/PhiSkrit/" target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber/45 px-4 py-2 text-sm font-semibold text-amber hover:bg-amber/10">
            <Music2 size={17} aria-hidden="true" /> Open PhiSkrit Composer ↗
          </a>
        </aside>
      </div>

      {review && (
        <section className="mt-5 min-w-0 rounded-2xl border border-emerald-500/35 bg-[#151b16ed] p-4 sm:p-5"
          aria-labelledby="phiskrit-timeline-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                <ShieldCheck className="mr-2 inline" size={17} aria-hidden="true" /> Valid for visual review
              </p>
              <h3 className="mt-2 break-words font-display text-2xl" id="phiskrit-timeline-title">
                {review.composition.title}
              </h3>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs text-[#d8c7b9]">
              <FileJson2 size={14} aria-hidden="true" /> phiskrit.rhythm.composition.v1
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Clips", review.composition.clips.length],
              ["Notes", review.composition.eventCount],
              ["Tempo", review.composition.bpm + " BPM"],
              ["Beats", review.totalBeats],
              ["Duration", review.durationSeconds.toFixed(2) + " s"],
              ["Heavy / Light", review.heavyCount + " / " + review.lightCount],
            ].map(([label, value]) => (
              <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3" key={label}>
                <dt className="text-xs text-[#bfaf9e]">{label}</dt>
                <dd className="mt-1 break-words font-display text-lg text-cream">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-amber">
              <Music2 size={18} aria-hidden="true" />
              <h4 className="font-display text-xl">Validated arrangement timeline</h4>
            </div>
            <p className="mt-2 text-xs text-[#bda998]">
              One tile per syllable. L = 1 beat and G = 2 beats.
              This is a static visual analysis, not a player.
            </p>
            <div className="mt-3 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/35 p-3"
              role="list" aria-label="Validated PhiSkrit rhythm note timeline">
              {review.composition.events.map((event, i) => (
                <div role="listitem" key={i}
                  title={"Clip " + (event.clipIndex + 1) + ", repeat " + (event.repetition + 1) + ", beat " + event.startTick / 480}
                  className={"flex min-h-20 shrink-0 flex-col items-center justify-center rounded-lg border px-3 text-sm " +
                    (event.syllable === "G"
                      ? "border-amber/60 bg-amber/25 text-amber"
                      : "border-emerald-400/40 bg-emerald-800/25 text-emerald-200")}
                  style={{ width: event.durationTicks === 960 ? 80 : 52 }}>
                  <strong className="text-lg">{event.syllable}</strong>
                  <span className="text-[10px] opacity-80">{event.startTick / 480}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {review.composition.clips.map((clip, i) => (
              <div className="rounded-xl border border-white/15 bg-black/25 p-3" key={i}>
                <p className="text-xs text-[#c3af98]">Clip {i + 1}</p>
                <p className="mt-1 break-all font-mono text-lg text-cream">{clip.pattern}</p>
                <p className="text-xs text-[#d1bcaa]">{clip.repeats} repetition{clip.repeats === 1 ? "" : "s"}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[#c3b1a0]">{review.warning}</p>
        </section>
      )}
    </section>
  );
}
