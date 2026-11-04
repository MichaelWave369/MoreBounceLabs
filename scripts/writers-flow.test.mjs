import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { BAR_TARGETS, analyzeVerse, appendBarGuide, appendSpark, approximateWordSyllables, freestylePrompt, lastBarWord } from "./writers-flow.mjs";

test("count entered bars without treating section headings or empty numbered guides as lyrics", () => {
  const source = "[Verse 1]\n01. first line in time\n02. \n03. second line to shine\n[Hook]\n# Note: Keep this gritty\n04. \n";
  const result = analyzeVerse(source);
  assert.equal(result.writtenBars, 2);
  assert.equal(result.plannedSlots, 4);
  assert.equal(result.rows.length, 4);
  assert.deepEqual(result.rows.map(row => row.endWord), ["time", "", "shine", ""]);
  assert.equal(result.rows[1].written, false);
  assert.ok(result.totalSyllables > 0);
  assert.ok(result.averageSyllables > 0);
});

test("multiple lyric lines work without numbering and punctuation is excluded from end words", () => {
  const result = analyzeVerse("Raise the light!\r\nMake it right.\n\n[Outro]");
  assert.equal(result.writtenBars, 2);
  assert.deepEqual(result.rows.map(row => row.endWord), ["light", "right"]);
  assert.equal(lastBarWord("16. Blue sky?"), "sky");
  assert.equal(approximateWordSyllables("hello"), 2);
  assert.equal(approximateWordSyllables("a"), 1);
  assert.equal(approximateWordSyllables(""), 0);
});

test("bar guides append without overwriting existing songs", () => {
  assert.deepEqual(BAR_TARGETS, [4, 8, 16, 32]);
  const original = "old lyrics stay intact";
  const updated = appendBarGuide(original, 16);
  assert.ok(updated.startsWith(original));
  assert.match(updated, /\[Verse · 16 bar guide\]/);
  assert.match(updated, /16\. /);
  const result = analyzeVerse(updated);
  assert.equal(result.writtenBars, 1);
  assert.equal(result.plannedSlots, 17);
  assert.equal(analyzeVerse(appendBarGuide("", 4)).plannedSlots, 4);
  assert.throws(() => appendBarGuide("text", 13), /Choose/);
});

test("offline original prompt deck produces varied sparks and appends ignored note lines", () => {
  const p = freestylePrompt(0);
  const q = freestylePrompt(1);
  assert.ok(p.setting && p.theme && p.twist);
  assert.notDeepEqual(p, q);
  assert.deepEqual(freestylePrompt(-3), p);
  const draft = appendSpark("One genuine bar", p);
  assert.ok(draft.startsWith("One genuine bar"));
  assert.match(draft, /# Freestyle spark/);
  assert.match(draft, /# Setting:/);
  assert.equal(analyzeVerse(draft).writtenBars, 1);
  assert.equal(analyzeVerse(draft).plannedSlots, 1);
});

test("Writers Room keeps original persistence and uses pure, offline flow analysis", () => {
  const room = readFileSync("src/components/WritersRoom.tsx", "utf8");
  for (const keyword of ["Flow Bench", "Freestyle Spark Deck", "Append {barTarget}-bar guide",
    "Deal another spark", "Export .txt", "Copy lyrics", "analyzeVerse(page?.body", "appendBarGuide(page.body", "appendSpark(page.body"]) {
    assert.ok(room.includes(keyword), "Missing writer feature: " + keyword);
  }
  assert.match(room, /window\.localStorage\.setItem\(BOOK_KEY/);
  assert.match(room, /fetch\(lexicalUrl\(mode\.code, target\)/);
  assert.doesNotMatch(readFileSync("scripts/writers-flow.mjs", "utf8"), /fetch\(|localStorage|AudioContext/);
});
