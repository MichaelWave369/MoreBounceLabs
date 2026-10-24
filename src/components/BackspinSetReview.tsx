import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { BarChart3, Download, FileUp, ShieldCheck } from "lucide-react";
import {
  clockSetReview,
  filterSetReview,
  parseSetLedgerForReview,
  setReviewCsv,
  SET_REVIEW_MAX_BYTES,
  summarizeSetReview,
} from "../../scripts/backspin-set-review.mjs";

type ReviewEntry = {
  id: number;
  at: string;
  elapsedSeconds: number;
  source: "OBSERVED" | "MANUAL";
  kind: string;
  detail: string;
  deck?: "A" | "B";
};

type Imported = {
  startedAt: string;
  endedAt: string | null;
  trackTitlesIncluded: boolean;
  entries: ReviewEntry[];
};

type ReviewFilter = "all" | "observed" | "manual" | "transitions" | "loads";

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "observed", label: "Observed" },
  { value: "manual", label: "Manual" },
  { value: "transitions", label: "Transition points" },
  { value: "loads", label: "Deck loads" },
];

export function BackspinSetReview({
  liveEntries,
  liveStartedAt,
  liveTracksIncluded,
}: {
  liveEntries: ReviewEntry[];
  liveStartedAt: string;
  liveTracksIncluded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [imported, setImported] = useState<Imported | null>(null);
  const [source, setSource] = useState<"live" | "imported">("live");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [feedback, setFeedback] = useState("");
  const importCounter = useRef(0);

  const entries = source === "imported" && imported ? imported.entries : liveEntries;
  const startAt = source === "imported" && imported ? imported.startedAt : liveStartedAt;
  const tracksIncluded = source === "imported" && imported ? imported.trackTitlesIncluded : liveTracksIncluded;
  const summary = useMemo(() => summarizeSetReview(entries), [entries]);
  const filtered = useMemo(() =>
    filterSetReview(entries, filter).slice().sort((a, b) =>
      a.elapsedSeconds - b.elapsedSeconds || a.id - b.id), [entries, filter]);

  async function importLedger(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > SET_REVIEW_MAX_BYTES) {
      setFeedback("File exceeds the 512 KiB import limit.");
      return;
    }
    const generation = ++importCounter.current;
    try {
      const text = await file.text();
      const validated = parseSetLedgerForReview(text);
      if (generation !== importCounter.current) return;
      setImported({
        startedAt: validated.startedAt,
        endedAt: validated.endedAt,
        trackTitlesIncluded: validated.trackTitlesIncluded,
        entries: validated.entries as ReviewEntry[],
      });
      setSource("imported");
      setFilter("all");
      setFeedback("Imported ledger validated locally. Its event labels are self-reported, not independently verified.");
    } catch (error) {
      if (generation !== importCounter.current) return;
      setFeedback(error instanceof Error ? error.message : "This file could not be reviewed.");
    }
  }

  function downloadCsv() {
    if (!entries.length) return;
    const csv = setReviewCsv(filtered);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "backspin96-set-review-" + (startAt || "session").slice(0, 19).replace(/[:T]/g, "-") + ".csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("CSV download requested for " + filtered.length + " currently filtered events.");
  }

  function forgetImport() {
    importCounter.current++;
    setImported(null);
    setSource("live");
    setFilter("all");
    setFeedback("Imported ledger discarded from this page. No local file was changed.");
  }

  return (
    <section className="mt-5 rounded-2xl border border-cyan-500/35 bg-[#0c1721] p-4"
      aria-label="BackSpin96 set review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
            <BarChart3 size={18} aria-hidden="true" /> Set Review · R6
          </p>
          <p className="mt-1 text-xs text-mist">
            Read-only review of the current set, or a JSON ledger you choose locally.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(value => !value)}
          aria-expanded={open} aria-controls="backspin-set-review-details"
          className="min-h-11 rounded-xl border border-cyan-400/50 px-4 text-sm text-cyan-100">
          {open ? "Hide set review" : "Open set review"}
        </button>
      </div>
      <div id="backspin-set-review-details" className={open ? "mt-4 border-t border-cyan-400/20 pt-4" : "hidden"}>
        <p className="mb-3 flex items-start gap-2 text-xs text-mist">
          <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          Counts are derived from sampled status reports and your manual markers, never measured audio.
          Import, filtering and CSV generation happen on this device. No file uploads.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={source === "live"} onClick={() => {setSource("live");setFilter("all");}}
            className={`min-h-11 rounded-xl px-3 text-sm ${source === "live" ? "bg-cyan-700 text-white" : "border border-line text-mist"}`}>
            Current set ({liveEntries.length})
          </button>
          {imported && (
            <button type="button" aria-pressed={source === "imported"} onClick={() => {setSource("imported");setFilter("all");}}
              className={`min-h-11 rounded-xl px-3 text-sm ${source === "imported" ? "bg-cyan-700 text-white" : "border border-line text-mist"}`}>
              Imported set ({imported.entries.length})
            </button>
          )}
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/50 px-3 text-sm text-cyan-100">
            <FileUp size={16} aria-hidden="true" /> Review saved JSON
            <input type="file" accept=".json,application/json" onChange={(event) => void importLedger(event)}
              aria-label="Review a local BackSpin96 Set Ledger JSON file" className="sr-only" />
          </label>
          {imported && (
            <button type="button" className="min-h-11 rounded-xl border border-line px-3 text-xs text-mist"
              onClick={forgetImport}>Forget imported set</button>
          )}
        </div>
        <p className="mb-3 text-xs text-mist">
          {startAt ? "Session began: " + startAt : "No set started yet."}
          {" · "}Track names {tracksIncluded ? "may appear in this ledger" : "excluded by the source ledger"}.
          {" · "}Imported event provenance is declared by its file.
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Events", summary.eventCount],
            ["Observed", summary.observed],
            ["Manual", summary.manual],
            ["Marked transitions", summary.manualTransitions],
            ["Fader regions", summary.faderZones],
            ["Highlights", summary.highlights],
          ].map(([label, count]) => (
            <div key={label} className="rounded-xl border border-line bg-[#111e2a] p-3">
              <p className="text-xs text-mist">{label}</p>
              <p className="mt-1 font-display text-2xl tabular-nums text-cream">{count}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <p className="rounded-lg border border-line px-3 py-2 text-xs text-mist">
            Deck A: {summary.decks.A.loads} load observations, {summary.decks.A.plays} play observations
          </p>
          <p className="rounded-lg border border-line px-3 py-2 text-xs text-mist">
            Deck B: {summary.decks.B.loads} load observations, {summary.decks.B.plays} play observations
          </p>
          <p className="rounded-lg border border-line px-3 py-2 text-xs text-mist">
            Last logged point: {clockSetReview(summary.durationSeconds)}
          </p>
        </div>
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-cream">Set timeline</h3>
            <span className="text-xs text-mist">{filtered.length} selected events</span>
          </div>
          <div className="relative mt-3 h-14 overflow-hidden rounded-xl border border-line bg-[#0a111b]"
            aria-label="Relative event positions, not a waveform">
            <div className="absolute inset-x-3 top-1/2 h-px bg-cyan-400/30" />
            {filtered.slice(-150).map((event) => {
              const fraction = summary.durationSeconds > 0 ?
                Math.min(1, Math.max(0, event.elapsedSeconds / summary.durationSeconds)) : 0;
              return (
                <span key={event.id}
                  className={`absolute bottom-2 top-2 w-[3px] rounded-full ${event.source === "MANUAL" ? "bg-fuchsia-400" : "bg-cyan-300/70"}`}
                  style={{left: `${(fraction * 96 + 2).toFixed(2)}%`}}
                  title={clockSetReview(event.elapsedSeconds) + " · " + event.source + " · " + event.detail}
                  aria-hidden="true" />
              );
            })}
          </div>
          <p className="mt-1 text-xs text-mist">
            Cyan = observed · Pink = manual · Latest 150 selected marks shown · Proportional elapsed time, not audio waveform
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <button type="button" key={item.value} aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`min-h-10 rounded-lg px-3 text-xs ${filter === item.value
                ? "bg-cyan-700 text-white" : "border border-line text-mist"}`}>
              {item.label}
            </button>
          ))}
          <button type="button" disabled={!filtered.length} onClick={downloadCsv}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/40 px-3 text-xs text-cyan-100 disabled:opacity-40">
            <Download size={15} aria-hidden="true" /> Export filtered CSV
          </button>
        </div>
        <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-line bg-[#0a111b] p-3">
          {filtered.length ? (
            <ol className="grid gap-2">
              {filtered.slice(-60).reverse().map((event) => (
                <li key={event.id} className="flex items-start gap-3 rounded-lg border border-line p-2 text-xs">
                  <span className="shrink-0 font-mono text-cyan-200">{clockSetReview(event.elapsedSeconds)}</span>
                  <span>
                    <span className="mr-2 font-semibold text-cream">{event.source}</span>
                    <span className="text-mist">{event.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-mist">No matching events. Record a set or review a saved JSON file.</p>}
        </div>
        <p className="mt-3 text-xs text-mist" role="status">{feedback || summary.caveat}</p>
      </div>
    </section>
  );
}
