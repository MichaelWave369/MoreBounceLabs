/**
 * BackSpin96 Set Ledger R5: read-only, user-initiated and deliberately local.
 * No engine controls, storage, fetch or audio APIs are used here.
 *
 * Timing comes from a polled adapter snapshot, so events are approximate.
 */

/** @typedef {"A" | "B"} DeckId */
/** @typedef {{
 *   ready: boolean,
 *   A: {loaded: boolean, playing: boolean, title?: string},
 *   B: {loaded: boolean, playing: boolean, title?: string},
 *   crossfader: number
 * }} DeckSnapshot */
/** @typedef {{
 *   source: "OBSERVED" | "MANUAL",
 *   kind: string,
 *   detail: string,
 *   deck?: DeckId
 * }} LedgerChange */
/** @typedef {LedgerChange & {elapsedSeconds: number, at: string, id: number}} LedgerEntry */

export const LEDGER_MAX_EVENTS = 1000;
export const LEDGER_FORMAT = "backspin96-set-ledger-v1";

/** @param {unknown} title */
export function safeTrackTitle(title) {
  return typeof title === "string" ? title.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120) : "";
}

/** @param {unknown} note */
export function safeMarkerNote(note) {
  return typeof note === "string" ? note.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120) : "";
}

/** @param {number} value */
function fadeZone(value) {
  if (!Number.isFinite(value)) return "unknown";
  if (value <= -0.55) return "A";
  if (value >= 0.55) return "B";
  return "center";
}

/**
 * Compare two complete polling snapshots, capturing state transitions only.
 * @param {DeckSnapshot} previous
 * @param {DeckSnapshot} next
 * @param {boolean} includeTrackTitles
 * @returns {LedgerChange[]}
 */
export function detectSetChanges(previous, next, includeTrackTitles = false) {
  /** @type {LedgerChange[]} */
  const changes = [];
  if (!previous.ready && next.ready) {
    changes.push({source:"OBSERVED", kind:"audio-initialized",
      detail:"The DJ engine reported dual audio initialized."});
  }
  for (const deck of /** @type {DeckId[]} */ (["A", "B"])) {
    const before = previous[deck], after = next[deck];
    const oldTitle = safeTrackTitle(before.title), newTitle = safeTrackTitle(after.title);
    const titleChanged = before.loaded && after.loaded && oldTitle !== newTitle;
    if (after.loaded && (!before.loaded || titleChanged)) {
      changes.push({source:"OBSERVED", deck, kind:"track-loaded",
        detail:"Deck " + deck + " reported a track load" +
          (includeTrackTitles && newTitle ? ": " + newTitle : "") + "."});
    } else if (!after.loaded && before.loaded) {
      changes.push({source:"OBSERVED", deck, kind:"track-unloaded",
        detail:"Deck " + deck + " reported its track was unloaded."});
    }
    if (after.playing !== before.playing && after.loaded) {
      changes.push({source:"OBSERVED", deck, kind:after.playing ? "play" : "pause",
        detail:"Deck " + deck + " reported " + (after.playing ? "playback" : "pause") + "."});
    }
  }
  const beforeZone = fadeZone(previous.crossfader);
  const afterZone = fadeZone(next.crossfader);
  if (beforeZone !== "unknown" && afterZone !== "unknown" && beforeZone !== afterZone) {
    changes.push({source:"OBSERVED", kind:"crossfader-zone",
      detail:"Crossfader position entered " + afterZone + " region."});
  }
  return changes;
}

/**
 * @param {LedgerEntry[]} existing
 * @param {LedgerEntry[]} incoming
 * @returns {LedgerEntry[]}
 */
export function appendLedgerEvents(existing, incoming) {
  return [...existing, ...incoming].slice(-LEDGER_MAX_EVENTS);
}

/**
 * @param {LedgerEntry[]} events
 * @param {{startedAt: string, endedAt?: string, tracksIncluded: boolean}} options
 */
export function exportSetLedger(events, options) {
  return JSON.stringify({
    format:LEDGER_FORMAT,
    provenance:{automatic:"OBSERVED adapter snapshots, subject to polling gaps",
      manual:"MANUAL operator markers"},
    startedAt: options.startedAt,
    endedAt: options.endedAt ?? null,
    trackTitlesIncluded:options.tracksIncluded,
    observationNote:"This log approximates UI state changes, not confirmed audible output, performance quality, beat alignment or audio recording.",
    entries:events,
  }, null, 2) + "\n";
}
