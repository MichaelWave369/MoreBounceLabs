/**
 * More Bounce Labs: independent, read-only review of PhiSkrit compositions.
 * Not MBL Mix Exchange v1; not an audio permission, queue item, or import.
 *
 * This validator RECONSTRUCTS the documented phiskrit.rhythm.composition.v1
 * representation. It does not copy or execute any PhiSkrit application code.
 */
export const PHISKRIT_SCHEMA = "phiskrit.rhythm.composition.v1" as const;
export const PHISKRIT_MAX_BYTES = 96 * 1024;
const MAX_CLIPS = 8, MAX_REPEATS = 4, MAX_EVENTS = 128, PPQ = 480;
const INTERPRETATION = "ORIGINAL_MODERN_LG_ARRANGEMENT_NOT_HISTORICAL" as const;

export type PhiSkritClip = { pattern: string; repeats: number };
export type PhiSkritEvent = {
  clipIndex: number;
  repetition: number;
  position: number;
  syllable: "L" | "G";
  startTick: number;
  durationTicks: number;
  midiNote: number;
  velocity: number;
};
export type PhiSkritComposition = {
  schema: typeof PHISKRIT_SCHEMA;
  source: "PhiSkrit";
  interpretation: typeof INTERPRETATION;
  title: string;
  bpm: number;
  ticksPerBeat: 480;
  clips: PhiSkritClip[];
  eventCount: number;
  totalTicks: number;
  events: PhiSkritEvent[];
};
export type PhiSkritReview = {
  verdict: "VALID_FOR_VISUAL_REVIEW";
  composition: PhiSkritComposition;
  totalBeats: number;
  durationSeconds: number;
  lightCount: number;
  heavyCount: number;
  warning: string;
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function equalShape(received: unknown, expected: unknown): boolean {
  if (Object.is(received, expected)) return true;
  if (Array.isArray(expected)) {
    return Array.isArray(received) && received.length === expected.length &&
      expected.every((item, index) => equalShape(received[index], item));
  }
  if (!object(expected) || !object(received)) return false;
  const wanted = Object.keys(expected).sort();
  const given = Object.keys(received).sort();
  return wanted.length === given.length &&
    wanted.every((key, index) => key === given[index] && equalShape(received[key], expected[key]));
}

function reconstruct(raw: Record<string, unknown>): PhiSkritComposition {
  const title = raw.title;
  if (typeof title !== "string" || title.length < 1 || title.length > 80 ||
      !title.trim() || /[\u0000-\u001f\u007f]/.test(title)) {
    throw new TypeError("Composition title must be 1–80 printable characters.");
  }
  const bpm = raw.bpm;
  if (!Number.isInteger(bpm) || (bpm as number) < 40 || (bpm as number) > 200) {
    throw new RangeError("Tempo must be an integer from 40 to 200 BPM.");
  }
  if (!Array.isArray(raw.clips) || raw.clips.length < 1 || raw.clips.length > MAX_CLIPS) {
    throw new RangeError("Composition must contain 1–8 clips.");
  }
  const canonicalClips: PhiSkritClip[] = [];
  const events: PhiSkritEvent[] = [];
  let totalTicks = 0;

  for (const [clipIndex, clip] of raw.clips.entries()) {
    if (!object(clip) || typeof clip.pattern !== "string" ||
        !/^[LG]{1,8}$/.test(clip.pattern)) {
      throw new TypeError("Each clip must contain 1–8 uppercase L/G syllables.");
    }
    if (!Number.isInteger(clip.repeats) || (clip.repeats as number) < 1 ||
        (clip.repeats as number) > MAX_REPEATS) {
      throw new RangeError("Each clip must repeat between 1 and 4 times.");
    }
    const pattern = clip.pattern;
    const repeats = clip.repeats as number;
    canonicalClips.push({ pattern, repeats });
    for (let repetition = 0; repetition < repeats; repetition++) {
      for (const [position, syllable] of [...pattern].entries()) {
        const heavy = syllable === "G";
        const durationTicks = heavy ? 960 : 480;
        events.push({
          clipIndex, repetition, position, syllable: heavy ? "G" : "L",
          startTick: totalTicks, durationTicks,
          midiNote: heavy ? 60 : 67, velocity: heavy ? 108 : 78,
        });
        if (events.length > MAX_EVENTS) {
          throw new RangeError("Composition exceeds the 128-event limit.");
        }
        totalTicks += durationTicks;
      }
    }
  }

  return {
    schema: PHISKRIT_SCHEMA,
    source: "PhiSkrit",
    interpretation: INTERPRETATION,
    title, bpm: bpm as number,
    ticksPerBeat: PPQ,
    clips: canonicalClips,
    eventCount: events.length,
    totalTicks, events,
  };
}

/** Rejects non-canonical, malformed or oversized data with no side effects. */
export function validatePhiSkritComposition(input: unknown): PhiSkritReview {
  if (!object(input) || input.schema !== PHISKRIT_SCHEMA) {
    throw new TypeError("Only phiskrit.rhythm.composition.v1 JSON is accepted.");
  }
  const serialized = JSON.stringify(input);
  if (!serialized || new TextEncoder().encode(serialized).length > PHISKRIT_MAX_BYTES) {
    throw new RangeError("PhiSkrit composition exceeds the 96 KiB limit.");
  }
  const expected = reconstruct(input);
  if (!equalShape(input, expected)) {
    throw new TypeError("Composition metadata or note/tick timeline did not match the v1 contract.");
  }
  const totalBeats = expected.totalTicks / PPQ;
  const heavyCount = expected.events.filter(event => event.syllable === "G").length;
  return {
    verdict: "VALID_FOR_VISUAL_REVIEW",
    composition: expected,
    totalBeats,
    durationSeconds: totalBeats * 60 / expected.bpm,
    lightCount: expected.eventCount - heavyCount,
    heavyCount,
    warning: "Valid structure is not proof of authorship or historical accuracy. Review only: does not grant audio or DJ control.",
  };
}

/** Strictly size-bounded, text-only entry point for browser file imports. */
export function parsePhiSkritCompositionText(text: string): PhiSkritReview {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > PHISKRIT_MAX_BYTES) {
    throw new RangeError("PhiSkrit JSON must be no more than 96 KiB.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new TypeError("File does not contain valid JSON."); }
  return validatePhiSkritComposition(parsed);
}
