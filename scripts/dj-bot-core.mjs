/**
 * Interprets a visible player clock and an explicit playback state.
 * The agent does not guess when a third-party iframe has finished.
 */
export function parsePlayerTime(text) {
  const raw = String(text ?? "").trim();
  if (!/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(raw)) return null;
  const parts = raw.split(":").map(Number);
  if (parts.some((n) => !Number.isSafeInteger(n))) return null;
  return parts.reduce((n, segment) => n * 60 + segment, 0);
}

/**
 * @param {{state: string | null, currentText: string | null, durationText: string | null, sawPlaying: boolean}} observation
 */
export function shouldAdvance(observation) {
  const current = parsePlayerTime(observation.currentText);
  const duration = parsePlayerTime(observation.durationText);
  return Boolean(observation.sawPlaying && observation.state === "ended" &&
    current !== null && duration !== null && duration > 0 && current >= duration);
}

export function createTrackWatch() {
  let sawPlaying = false;
  return {
    observe(state, currentText, durationText) {
      if (state === "playing") sawPlaying = true;
      return shouldAdvance({ state, currentText, durationText, sawPlaying });
    },
  };
}
