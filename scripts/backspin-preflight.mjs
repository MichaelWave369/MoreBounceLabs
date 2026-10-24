/**
 * BackSpin96 preflight assessment. This file cannot start, stop, or modify audio.
 * Observations are browser/engine signals, not proof that sound reaches speakers.
 */

/** @typedef {"pass" | "pending" | "attention"} CheckState */
/** @typedef {{id: string, label: string, state: CheckState, detail: string}} ObservedCheck */
/** @typedef {{id: string, label: string, hint: string}} ManualCheck */

/** @type {readonly ManualCheck[]} */
export const MANUAL_SOUNDCHECK = Object.freeze([
  { id: "output-a", label: "Deck A is audible", hint: "Play a local test track and hear it through the intended output." },
  { id: "output-b", label: "Deck B is audible", hint: "Test the second deck independently, not just its play indicator." },
  { id: "crossfader", label: "Crossfader cuts correctly", hint: "Listen to both sides and center. Confirm A and B match the hardware output." },
  { id: "headphones", label: "Headphone cue path tested", hint: "Confirm cue monitoring or mark the item incomplete if unavailable." },
  { id: "emergency", label: "Emergency controls identified", hint: "Locate Stop both, volume controls and the physical output disconnect before the set." },
]);

/** @param {string} id
 *  @param {string} label
 *  @param {CheckState} state
 *  @param {string} detail
 *  @returns {ObservedCheck}
 */
function check(id, label, state, detail) { return { id, label, state, detail }; }

/**
 * @param {{
 *   manifestStatus: "checking" | "ready" | "missing",
 *   bridgeReady: boolean,
 *   snapshot: { ready: boolean, A: {loaded: boolean}, B: {loaded: boolean} },
 *   secureContext: boolean,
 *   audioWorkletSupported: boolean
 * }} input
 * @returns {ObservedCheck[]}
 */
export function assessPreflight(input) {
  const { manifestStatus, bridgeReady, snapshot, secureContext, audioWorkletSupported } = input;
  return [
    check("secure", "Secure browser context", secureContext ? "pass" : "attention",
      secureContext ? "Browser reports a secure context." : "HTTPS or trusted local hosting is required for several audio APIs."),
    check("worklet", "AudioWorklet API available", audioWorkletSupported ? "pass" : "attention",
      audioWorkletSupported ? "API detected; sound output is not yet verified." : "This browser does not expose the expected AudioWorklet API."),
    check("runtime", "Pinned BackSpin runtime", manifestStatus === "ready" ? "pass" : manifestStatus === "missing" ? "attention" : "pending",
      manifestStatus === "ready" ? "Staged v1.5.0 manifest accepted." : manifestStatus === "missing" ? "Required DJ runtime manifest unavailable." : "Checking pinned runtime manifest."),
    check("bridge", "Original engine bridge", bridgeReady ? "pass" : "pending",
      bridgeReady ? "Read-only deck status adapter connected." : "Waiting for the embedded DJ engine."),
    check("audio", "Dual audio initialized", snapshot.ready ? "pass" : "pending",
      snapshot.ready ? "Original engine reports initialization." : "Press Start dual audio in the booth."),
    check("deck-a", "Deck A loaded", snapshot.A.loaded ? "pass" : "pending",
      snapshot.A.loaded ? "Engine reports a loaded track; audibility is separate." : "Load an authorized local track on Deck A."),
    check("deck-b", "Deck B loaded", snapshot.B.loaded ? "pass" : "pending",
      snapshot.B.loaded ? "Engine reports a loaded track; audibility is separate." : "Load an authorized local track on Deck B."),
  ];
}

/**
 * @param {ObservedCheck[]} observed
 * @param {ReadonlySet<string>} manualIds
 */
export function summarizePreflight(observed, manualIds) {
  const observedPass = observed.filter((item) => item.state === "pass").length;
  const manualPass = MANUAL_SOUNDCHECK.filter((item) => manualIds.has(item.id)).length;
  const attention = observed.some((item) => item.state === "attention");
  const complete = observedPass === observed.length && manualPass === MANUAL_SOUNDCHECK.length;
  return {
    observedPass,
    observedTotal: observed.length,
    manualPass,
    manualTotal: MANUAL_SOUNDCHECK.length,
    status: complete ? "operator-checked" : attention ? "needs-attention" : "incomplete",
    complete,
  };
}

/**
 * Local-only plain-text report. Does not include titles, audio files or credentials.
 * @param {ObservedCheck[]} observed
 * @param {ReadonlySet<string>} manualIds
 * @param {string} dateIso
 */
export function makeSoundcheckReport(observed, manualIds, dateIso) {
  const summary = summarizePreflight(observed, manualIds);
  return [
    "BackSpin96 / Preflight Soundcheck",
    "Captured: " + dateIso,
    "Assessment: " + (summary.complete ? "Operator-marked complete" : "Incomplete"),
    "Note: Software status and self-checks do not prove actual audio output or latency.",
    "",
    "Observed checks (software signals only):",
    ...observed.map((item) => "[" + item.state.toUpperCase() + "] " + item.label + " — " + item.detail),
    "",
    "Manual checks (self-attested, not automatically verified):",
    ...MANUAL_SOUNDCHECK.map((item) => "[" + (manualIds.has(item.id) ? "CHECKED" : "NOT CHECKED") + "] " + item.label),
    "",
    "No music, filenames, device identifiers, or recordings are included.",
  ].join("\n");
}
