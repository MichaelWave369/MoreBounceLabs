import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeftRight, Download, FileUp, ShieldAlert, Trash2 } from "lucide-react";
import {
  compareSetLedgers,
  setComparisonCsv,
} from "../../scripts/backspin-set-compare.mjs";
import {
  parseSetLedgerForReview,
  SET_REVIEW_MAX_BYTES,
} from "../../scripts/backspin-set-review.mjs";

type Event = {
  id: number;
  at: string;
  elapsedSeconds: number;
  source: "OBSERVED" | "MANUAL";
  kind: string;
  detail: string;
  deck?: "A" | "B";
};
type Import = {
  entries: Event[];
  startedAt: string;
  trackTitlesIncluded: boolean;
};

export function BackspinSetCompare({
  leftEntries,
  leftLabel,
}: {
  leftEntries: Event[];
  leftLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comparisonSet, setComparisonSet] = useState<Import | null>(null);
  const [feedback, setFeedback] = useState("");
  const generation = useRef(0);

  const compared = useMemo(() =>
    compareSetLedgers(leftEntries, comparisonSet?.entries ?? []),
    [leftEntries, comparisonSet]);

  async function chooseReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const ticket = ++generation.current;
    if (file.size > SET_REVIEW_MAX_BYTES) {
      setFeedback("Set B is too large (512 KiB maximum).");
      return;
    }
    try {
      const text = await file.text();
      if (ticket !== generation.current) return;
      const parsed = parseSetLedgerForReview(text);
      setComparisonSet({
        entries: parsed.entries as Event[],
        startedAt: parsed.startedAt,
        trackTitlesIncluded: parsed.trackTitlesIncluded,
      });
      setFeedback("Set B loaded and validated in this tab only. Its event claims remain self-reported.");
    } catch (error) {
      if (ticket !== generation.current) return;
      setFeedback(error instanceof Error ? error.message : "Set B could not be reviewed.");
    }
  }

  function forgetReference() {
    generation.current++;
    setComparisonSet(null);
    setFeedback("Set B was discarded from memory. The original local file was not changed.");
  }

  function saveComparison() {
    if (!compared.ready) return;
    const csv = setComparisonCsv(compared);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "backspin96-set-comparison.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("Comparison CSV download requested. Summary counts only, no tracks, notes or filenames.");
  }

  const rows = [
    {name: "Set A", counts: compared.bands.a, entries: compared.eventCounts.a, label: leftLabel, duration: compared.durationLabels.a, accent: "bg-cyan-400"},
    {name: "Set B", counts: compared.bands.b, entries: compared.eventCounts.b, label: "Saved reference", duration: compared.durationLabels.b, accent: "bg-fuchsia-400"},
  ];

  return (
    <section className="mt-5 rounded-2xl border border-fuchsia-500/35 bg-[#171020] p-4"
      aria-label="BackSpin96 compare two set ledgers">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-fuchsia-200">
            <ArrowLeftRight size={17} aria-hidden="true"/> Set Compare · R7
          </p>
          <p className="mt-1 text-xs text-mist">Compare logged activity from two sets, not mixing skill.</p>
        </div>
        <button type="button" aria-expanded={expanded} aria-controls="backspin-set-compare"
          onClick={() => setExpanded(value => !value)}
          className="min-h-11 rounded-xl border border-fuchsia-400/40 px-4 text-sm text-fuchsia-100">
          {expanded ? "Hide comparison" : "Compare sets"}
        </button>
      </div>
      {expanded && (
        <div id="backspin-set-compare" className="mt-4 border-t border-fuchsia-500/20 pt-4">
          <p className="flex items-start gap-2 text-xs text-mist">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true"/>
            Set A is the selected R6 review source ({leftLabel}). Select a separate local R5 JSON export
            as Set B. Files never leave this device. Imported OBSERVED labels are claims in that file,
            not independent verification.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-fuchsia-400/40 px-4 text-sm text-fuchsia-100">
              <FileUp size={16} aria-hidden="true"/> Load Set B JSON
              <input type="file" className="sr-only" accept=".json,application/json"
                aria-label="Select local Set B ledger JSON"
                onChange={(event) => void chooseReference(event)}/>
            </label>
            {comparisonSet && (
              <button type="button" onClick={forgetReference}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm text-mist">
                <Trash2 size={15} aria-hidden="true"/> Forget Set B
              </button>
            )}
            <button type="button" disabled={!compared.ready} onClick={saveComparison}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm text-cream disabled:opacity-40">
              <Download size={15} aria-hidden="true"/> Export comparison CSV
            </button>
          </div>
          {feedback && <p role="status" className="mt-2 text-xs text-fuchsia-200">{feedback}</p>}
          {!compared.ready ? (
            <p className="mt-4 rounded-xl border border-line p-4 text-sm text-mist">
              {leftEntries.length === 0
                ? "Set A has no logged events yet. Start a Set Ledger or choose a saved R6 review first."
                : "Select Set B to compare against " + leftLabel + "."}
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {rows.map(row => (
                  <div key={row.name} className="rounded-xl border border-line bg-[#100d19] p-3">
                    <p className="text-sm font-semibold text-cream">{row.name} · {row.label}</p>
                    <p className="mt-1 text-xs text-mist">
                      {row.entries} logged events · last logged {row.duration}
                    </p>
                    <div className="mt-3 grid h-20 grid-cols-5 items-end gap-2" role="img"
                      aria-label={row.name + " event counts in five equal time segments: " + row.counts.join(", ")}>
                      {row.counts.map((count, i) => {
                        const maximum = Math.max(1, ...row.counts);
                        return (
                          <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
                            <span className="text-[10px] tabular-nums text-mist">{count}</span>
                            <span className={`w-full rounded-t-sm ${row.accent}`}
                              style={{height: `${Math.max(5, 60 * count / maximum)}px`}} aria-hidden="true"/>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-[10px] text-mist">
                      0–20% · 20–40% · 40–60% · 60–80% · 80–100% of logged duration
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[500px] text-left text-xs">
                  <thead className="bg-[#28182e] text-cream">
                    <tr><th scope="col" className="p-3">Logged metric</th>
                      <th scope="col" className="p-3 text-right">Set A</th>
                      <th scope="col" className="p-3 text-right">Set B</th>
                      <th scope="col" className="p-3 text-right">B − A</th></tr>
                  </thead>
                  <tbody>
                    {compared.metrics.map(metric => (
                      <tr key={metric.id} className="border-t border-line text-mist">
                        <th scope="row" className="p-3 font-normal" title={metric.interpret}>{metric.label}</th>
                        <td className="p-3 text-right tabular-nums">{metric.a}</td>
                        <td className="p-3 text-right tabular-nums">{metric.b}</td>
                        <td className="p-3 text-right tabular-nums">
                          {metric.delta > 0 ? "+" : ""}{metric.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-mist">{compared.caution}</p>
              {comparisonSet?.trackTitlesIncluded && (
                <p className="mt-2 text-xs text-amber">
                  The imported R5 ledger allowed track names. This R7 comparison does not export them.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
