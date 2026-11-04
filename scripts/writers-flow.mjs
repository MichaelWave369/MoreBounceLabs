/**
 * Pure offline helpers for the MoreBounceLabs Flow Bench.
 * Writing aid, not music/audio or accurate phonetic metering.
 */
export const BAR_TARGETS = [4, 8, 16, 32];
const SETTINGS = [
  "A midnight radio station at the edge of town",
  "An empty diner after the last bus leaves",
  "A mountain road during a summer storm",
  "The back room of an old record store",
  "A futuristic city built around an ancient tree",
  "A tiny studio with the world's loudest speakers",
  "A train that never stops in the same century",
  "A rooftop overlooking a sleeping neighborhood",
  "A deserted arcade with one machine still running"
];
const THEMES = [
  "A discovery nobody else believes",
  "A conversation with your younger self",
  "An ordinary object hiding an impossible secret",
  "An unexpected act of kindness",
  "The one thing you refuse to trade away",
  "What home means after a long journey",
  "An invention that solved the wrong problem",
  "A victory too small for anyone else to notice",
  "A message sent two thousand years into the future",
  "Learning to laugh when plans fall apart"
];
const ANGLES = [
  "Tell it in reverse.",
  "Use three vivid sounds.",
  "Make the last bar flip the meaning of the first.",
  "Describe it without naming it.",
  "Tell it from an object's perspective.",
  "Start with a question and answer it in the hook.",
  "Use contrast between something tiny and something enormous.",
  "Let a mistake become the punchline.",
  "Make the final image surprisingly peaceful.",
  "Use one repeated phrase with a different meaning each time.",
  "Tell the truth without using the word I."
];

/** @param {number} index */
export function freestylePrompt(index) {
  const n = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return {
    setting: SETTINGS[n % SETTINGS.length],
    theme: THEMES[(n * 3 + 2) % THEMES.length],
    twist: ANGLES[(n * 5 + 4) % ANGLES.length]
  };
}

/** Spelling heuristic, not phonetic performance measurement. @param {string} word */
export function approximateWordSyllables(word) {
  const letters = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!letters) return 0;
  if (letters.length <= 3) return 1;
  const matches = letters.match(/[aeiouy]+/g);
  let count = matches?.length || 1;
  if (letters.endsWith("e") && !letters.endsWith("le") && !letters.endsWith("ye") && count > 1) count--;
  return Math.max(1, count);
}

/** @param {string} line */
export function lastBarWord(line) {
  const value = String(line || "").replace(/^\s*\d{1,2}[.)]\s*/, "").trim();
  const match = value.match(/([\p{L}\p{N}'’-]+)[^\p{L}\p{N}'’-]*$/u);
  return match?.[1] || "";
}

/** @param {string} line */
export function barText(line) {
  const value = String(line || "").trim();
  if (!value || /^\[.+\]$/.test(value) || /^#/.test(value) ||
      /^(verse|hook|chorus|intro|outro|bridge)(\s*\d+)?\s*:?$/i.test(value)) return null;
  return value.replace(/^\d{1,2}[.)]\s*/, "").trim();
}

/**
 * Lines are candidate bars, not audio timings. Numbered blanks are slots;
 * only nonempty lines count as written bars.
 * @param {string} lyrics
 */
export function analyzeVerse(lyrics) {
  const rows = [];
  let lineNumber = 0;
  let totalSyllables = 0;
  let writtenBars = 0;
  let plannedSlots = 0;
  for (const raw of String(lyrics || "").replace(/\r\n?/g, "\n").split("\n")) {
    lineNumber++;
    const line = barText(raw);
    if (line === null) continue;
    if (!line && !/^\s*\d{1,2}[.)]\s*$/.test(raw)) continue;
    plannedSlots++;
    const written = Boolean(line);
    const words = written ? line.match(/[\p{L}\p{N}'’-]+/gu) || [] : [];
    const syllables = words.reduce((sum, word) => sum + approximateWordSyllables(word), 0);
    totalSyllables += syllables;
    if (written) writtenBars++;
    rows.push({ lineNumber, text: line, written, syllables, endWord: written ? lastBarWord(line) : "" });
  }
  return {
    rows, writtenBars, plannedSlots, totalSyllables,
    averageSyllables: writtenBars ? Math.round((totalSyllables / writtenBars) * 10) / 10 : 0
  };
}

/** @param {string} existing @param {number} count */
export function appendBarGuide(existing, count) {
  if (!BAR_TARGETS.includes(count)) throw new Error("Choose a 4-, 8-, 16-, or 32-bar guide.");
  const content = String(existing || "");
  const prefix = content.trimEnd() ? "\n\n" : "";
  const rows = Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, "0") + ". ");
  return content + prefix + "[Verse · " + count + " bar guide]\n" + rows.join("\n");
}

/** @param {string} text @param {{setting:string,theme:string,twist:string}} prompt */
export function appendSpark(text, prompt) {
  const content = String(text || "");
  const prefix = content.trimEnd() ? "\n\n" : "";
  return content + prefix + "# Freestyle spark\n# Setting: " + prompt.setting +
    "\n# Theme: " + prompt.theme + "\n# Twist: " + prompt.twist;
}
