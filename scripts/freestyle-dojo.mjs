/**
 * Pure, offline timing and rhyme-pattern helpers for Freestyle Dojo.
 * Not a phonetic dictionary or microphone performance analyzer.
 */
import { analyzeVerse, approximateWordSyllables } from "./writers-flow.mjs";

export const DOJO_BARS = [4, 8, 16, 32];
export const MIN_BPM = 55;
export const MAX_BPM = 180;

/** @param {number|string} input */
export function dojoBpm(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 90;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)));
}

/** @param {number} bpm @param {number} bars */
export function dojoPlan(bpm, bars) {
  if (!DOJO_BARS.includes(bars)) throw new Error("Choose a supported number of bars.");
  const safeBpm = dojoBpm(bpm);
  return { bpm: safeBpm, bars, beatSeconds: 60 / safeBpm, countInBeats: 4, totalBeats: 4 + bars * 4 };
}

/** Index zero is the first audible count-in click. @param {number} index @param {number} bars */
export function dojoBeat(index, bars) {
  if (!Number.isInteger(index) || index < 0) return { phase: "ready", beat: 0, bar: 0, done: false };
  const total = 4 + bars * 4;
  if (!DOJO_BARS.includes(bars)) throw new Error("Unsupported bar count.");
  if (index >= total) return { phase: "complete", beat: 0, bar: bars, done: true };
  if (index < 4) return { phase: "count-in", beat: index + 1, bar: 0, done: false };
  const b = index - 4;
  return { phase: "verse", beat: (b % 4) + 1, bar: Math.floor(b / 4) + 1, done: false };
}

/** A spelling-based suffix from the final two vowel groups. @param {string} word */
export function rhymePattern(word) {
  const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (approximateWordSyllables(w) < 3) return "";
  const groups = [...w.matchAll(/[aeiouy]+/g)];
  if (groups.length < 2) return "";
  return w.slice(groups[groups.length - 2].index);
}

/** @param {string} lyrics */
export function multisyllablePatterns(lyrics) {
  const lines = analyzeVerse(lyrics).rows.filter(r => r.written && r.endWord);
  const buckets = new Map();
  for (const line of lines) {
    const key = rhymePattern(line.endWord);
    if (!key) continue;
    const rows = buckets.get(key) || [];
    rows.push({ line: line.lineNumber, word: line.endWord, syllables: approximateWordSyllables(line.endWord) });
    buckets.set(key, rows);
  }
  return [...buckets.entries()].filter(([, rows]) => rows.length >= 2)
    .map(([pattern, words]) => ({ pattern, words }))
    .sort((a, b) => b.words.length - a.words.length || a.pattern.localeCompare(b.pattern));
}

/** @param {string} input */
export function safeClipName(input) {
  return (String(input || "freestyle").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 56) || "freestyle");
}
