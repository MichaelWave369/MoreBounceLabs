/**
 * BackSpin96 R6 Set Review.
 * Pure validation and summaries; never controls the DJ engine or sends data.
 * A Set Ledger is self-reported browser-state history, not a recording.
 */
/** @typedef {{
 * id: number, at: string, elapsedSeconds: number,
 * source: "OBSERVED" | "MANUAL", kind: string, detail: string,
 * deck?: "A" | "B"
 * }} ReviewEvent */
export const SET_REVIEW_FORMAT = "backspin96-set-ledger-v1";
export const SET_REVIEW_MAX_BYTES = 512 * 1024;
export const SET_REVIEW_MAX_EVENTS = 1000;

const KINDS = new Set([
  "audio-initialized", "track-loaded", "track-unloaded", "play", "pause",
  "crossfader-zone", "monitoring-started", "monitoring-stopped",
  "transition", "highlight", "note",
]);

/** @param {unknown} value */
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** @param {unknown} value */
function validIso(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

/**
 * Parse a *local*, explicitly chosen R5 JSON export.
 * Discards unknown fields; rejects overlarge or malformed records.
 * Never treats OBSERVED labels in imported files as independently verified.
 * @param {string} text
 */
export function parseSetLedgerForReview(text) {
  if (typeof text !== "string" || text.length > SET_REVIEW_MAX_BYTES) {
    throw new Error("Ledger file is too large. Maximum 512 KiB.");
  }
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error("This file is not valid JSON."); }
  if (!isObject(data) || data.format !== SET_REVIEW_FORMAT) {
    throw new Error("Expected a BackSpin96 Set Ledger v1 JSON export.");
  }
  if (!validIso(data.startedAt) || !(data.endedAt === null || data.endedAt === undefined || validIso(data.endedAt))) {
    throw new Error("Ledger start or end timestamp is invalid.");
  }
  if (typeof data.trackTitlesIncluded !== "boolean") {
    throw new Error("Ledger privacy metadata is missing.");
  }
  if (!Array.isArray(data.entries) || data.entries.length > SET_REVIEW_MAX_EVENTS) {
    throw new Error("Ledger must contain an entries array of at most 1,000 events.");
  }
  const ids = new Set();
  const rawEntries = /** @type {any[]} */ (data.entries);
  const entries = rawEntries.map((entry, index) => {
    if (!isObject(entry) || !Number.isSafeInteger(entry.id) || entry.id <= 0 || ids.has(entry.id)) {
      throw new Error("Invalid or duplicate event ID at row " + (index + 1) + ".");
    }
    ids.add(entry.id);
    if (!validIso(entry.at) || !Number.isFinite(entry.elapsedSeconds) ||
        entry.elapsedSeconds < 0 || entry.elapsedSeconds > 30 * 86400) {
      throw new Error("Invalid timestamp or elapsed time at row " + (index + 1) + ".");
    }
    if (entry.source !== "OBSERVED" && entry.source !== "MANUAL") {
      throw new Error("Invalid event provenance at row " + (index + 1) + ".");
    }
    if (typeof entry.kind !== "string" || !KINDS.has(entry.kind) ||
        typeof entry.detail !== "string" || entry.detail.length > 300 ||
        /[\u0000-\u001f\u007f]/.test(entry.detail)) {
      throw new Error("Invalid event details at row " + (index + 1) + ".");
    }
    if (entry.deck !== undefined && entry.deck !== "A" && entry.deck !== "B") {
      throw new Error("Invalid deck marker at row " + (index + 1) + ".");
    }
    return {
      id: entry.id,
      at: entry.at,
      elapsedSeconds: entry.elapsedSeconds,
      source: entry.source,
      kind: entry.kind,
      detail: entry.detail,
      ...(entry.deck === "A" || entry.deck === "B" ? { deck: entry.deck } : {}),
    };
  });
  entries.sort((a,b) => a.elapsedSeconds - b.elapsedSeconds || a.id - b.id);
  return {
    format: SET_REVIEW_FORMAT,
    startedAt: data.startedAt,
    endedAt: data.endedAt ?? null,
    trackTitlesIncluded: data.trackTitlesIncluded,
    entries,
    imported: true,
  };
}

/** @param {ReviewEvent[]} entries */
export function summarizeSetReview(entries) {
  const kinds = Object.create(null);
  const decks = {A: {loads: 0, plays: 0}, B: {loads: 0, plays: 0}};
  let observed = 0, manual = 0, manualTransitions = 0, highlights = 0, faderZones = 0;
  let durationSeconds = 0;
  for (const entry of entries) {
    if (!entry || typeof entry.kind !== "string") continue;
    kinds[entry.kind] = (kinds[entry.kind] || 0) + 1;
    if (entry.source === "OBSERVED") observed++;
    if (entry.source === "MANUAL") manual++;
    if (entry.source === "MANUAL" && entry.kind === "transition") manualTransitions++;
    if (entry.source === "MANUAL" && entry.kind === "highlight") highlights++;
    if (entry.source === "OBSERVED" && entry.kind === "crossfader-zone") faderZones++;
    if ((entry.deck === "A" || entry.deck === "B") && entry.source === "OBSERVED") {
      if (entry.kind === "track-loaded") decks[entry.deck].loads++;
      if (entry.kind === "play") decks[entry.deck].plays++;
    }
    if (Number.isFinite(entry.elapsedSeconds)) durationSeconds = Math.max(durationSeconds, entry.elapsedSeconds);
  }
  return {
    eventCount: entries.length,
    observed, manual, manualTransitions, highlights, faderZones,
    decks, kinds, durationSeconds,
    caveat: "Counts come from sampled DJ state and operator markers. Not a measurement of audible music, crowd response, latency or mixing quality.",
  };
}

/** @param {number} seconds */
export function clockSetReview(seconds) {
  const n = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return [h,m,s].map(v => String(v).padStart(2, "0")).join(":");
}

/** @param {unknown} value */
function csvField(value) {
  let text = String(value ?? "");
  // Spreadsheet formula injection. Quoting alone does not neutralize formulas.
  if (/^\s*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

/**
 * Export the reviewed ledger as CSV on an explicit browser download action.
 * @param {ReviewEvent[]} entries
 */
export function setReviewCsv(entries) {
  const rows = [["Elapsed", "Timestamp (UTC)", "Source (declared)", "Kind", "Deck", "Detail"]];
  for (const entry of entries) {
    rows.push([
      clockSetReview(entry.elapsedSeconds),
      entry.at,
      entry.source,
      entry.kind,
      entry.deck ?? "",
      entry.detail,
    ]);
  }
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** @param {ReviewEvent[]} entries
 *  @param {"all"|"observed"|"manual"|"transitions"|"loads"} filter
 */
export function filterSetReview(entries, filter) {
  if (filter === "observed") return entries.filter(e => e.source === "OBSERVED");
  if (filter === "manual") return entries.filter(e => e.source === "MANUAL");
  if (filter === "transitions") return entries.filter(e =>
    e.kind === "transition" || e.kind === "crossfader-zone");
  if (filter === "loads") return entries.filter(e => e.kind === "track-loaded");
  return entries;
}
