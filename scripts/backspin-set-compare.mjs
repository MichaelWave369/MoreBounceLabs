/**
 * BackSpin96 R7: evidence-limited side-by-side Set Compare.
 * Pure functions; no audio controls, storage, upload, or ranking model.
 * A count delta indicates a different number of *logged events*, not a
 * better performance. Polling gaps and manual annotation habits matter.
 */
import { summarizeSetReview, clockSetReview } from "./backspin-set-review.mjs";

/** @typedef {{
 *  id: number, at: string, elapsedSeconds: number,
 *  source: "OBSERVED" | "MANUAL", kind: string, detail: string,
 *  deck?: "A" | "B"
 * }} ReviewEvent */

/** @type {readonly {id: string, label: string, interpret: string}[]} */
export const SET_COMPARE_METRICS = Object.freeze([
  {id: "manualTransitions", label: "Manual transitions", interpret: "Operator-marked transitions only"},
  {id: "highlights", label: "Manual highlights", interpret: "Operator-entered highlights only"},
  {id: "faderZones", label: "Fader region changes", interpret: "Sampled crossfader zones"},
  {id: "aLoads", label: "Deck A loads", interpret: "Observed track-load changes"},
  {id: "bLoads", label: "Deck B loads", interpret: "Observed track-load changes"},
  {id: "aPlays", label: "Deck A play starts", interpret: "Observed playback-state changes"},
  {id: "bPlays", label: "Deck B play starts", interpret: "Observed playback-state changes"},
]);

/** @param {ReturnType<typeof summarizeSetReview>} summary */
function metricCounts(summary) {
  return {
    manualTransitions: summary.manualTransitions, highlights: summary.highlights,
    faderZones: summary.faderZones, aLoads: summary.decks.A.loads,
    bLoads: summary.decks.B.loads, aPlays: summary.decks.A.plays,
    bPlays: summary.decks.B.plays,
  };
}

/**
 * Five equal *relative elapsed time* segments. Not a waveform or beat grid.
 * Identical timestamps do not imply synchronized performances.
 * @param {ReviewEvent[]} entries
 * @param {number} duration
 */
export function compareEventBands(entries, duration) {
  const buckets = [0, 0, 0, 0, 0];
  if (duration <= 0) return buckets;
  for (const event of entries) {
    if (!Number.isFinite(event.elapsedSeconds) || event.elapsedSeconds < 0) continue;
    const ratio = Math.max(0, Math.min(1, event.elapsedSeconds / duration));
    buckets[Math.min(4, Math.floor(ratio * 5))]++;
  }
  return buckets;
}

/**
 * @param {ReviewEvent[]} left
 * @param {ReviewEvent[]} right
 */
export function compareSetLedgers(left, right) {
  const a = summarizeSetReview(left);
  const b = summarizeSetReview(right);
  const countsA = metricCounts(a);
  const countsB = metricCounts(b);
  const metrics = SET_COMPARE_METRICS.map(({id,label,interpret}) => {
    // This is a fixed internal metric key, never supplied by imported files.
    const metric = /** @type {keyof typeof countsA} */ (id);
    const aValue = countsA[metric], bValue = countsB[metric];
    return {id, label, interpret, a: aValue, b: bValue, delta: bValue - aValue};
  });
  return {
    ready: a.eventCount > 0 && b.eventCount > 0,
    durations: {a: a.durationSeconds, b: b.durationSeconds},
    durationLabels: {a: clockSetReview(a.durationSeconds), b: clockSetReview(b.durationSeconds)},
    eventCounts: {a: a.eventCount, b: b.eventCount},
    bands: {a: compareEventBands(left, a.durationSeconds), b: compareEventBands(right, b.durationSeconds)},
    metrics,
    caution: "Deltas compare logged activity only. Unequal set durations, polling gaps and manual marker habits make skill or quality comparisons invalid.",
  };
}

/** @param {ReturnType<typeof compareSetLedgers>} comparison */
export function setComparisonCsv(comparison) {
  // Only fixed internal labels and numeric metrics; no imported notes,
  // track titles, filenames or formulas can enter this export.
  const lines = [
    ["Metric", "Set A", "Set B", "B minus A", "Meaning"],
    ...comparison.metrics.map(x => [x.label, x.a, x.b, x.delta, x.interpret]),
  ];
  const field = (/** @type {string|number} */ text) => '"' + String(text).replace(/"/g,'""') + '"';
  return lines.map(row => row.map(field).join(",")).join("\r\n") + "\r\n";
}
