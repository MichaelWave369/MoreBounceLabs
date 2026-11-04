import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dojoBeat, dojoBpm, dojoPlan, DOJO_BARS, multisyllablePatterns, rhymePattern, safeClipName } from "./freestyle-dojo.mjs";

test("practice tempo is bounded and beat plans count one bar in before the verse", () => {
  assert.deepEqual(DOJO_BARS, [4, 8, 16, 32]);
  assert.equal(dojoBpm("90"), 90);
  assert.equal(dojoBpm(20), 55);
  assert.equal(dojoBpm(400), 180);
  assert.equal(dojoBpm(NaN), 90);
  const plan = dojoPlan(90, 16);
  assert.equal(plan.bpm, 90);
  assert.equal(plan.countInBeats, 4);
  assert.equal(plan.totalBeats, 68);
  assert.ok(Math.abs(plan.beatSeconds - 2 / 3) < 0.001);
  assert.throws(() => dojoPlan(100, 13), /supported/);
});

test("timing maps 4-count to exact verse bars and a terminal state", () => {
  assert.deepEqual(dojoBeat(-1, 16), { phase: "ready", beat: 0, bar: 0, done: false });
  assert.deepEqual(dojoBeat(0, 16), { phase: "count-in", beat: 1, bar: 0, done: false });
  assert.deepEqual(dojoBeat(3, 16), { phase: "count-in", beat: 4, bar: 0, done: false });
  assert.deepEqual(dojoBeat(4, 16), { phase: "verse", beat: 1, bar: 1, done: false });
  assert.deepEqual(dojoBeat(7, 16), { phase: "verse", beat: 4, bar: 1, done: false });
  assert.deepEqual(dojoBeat(8, 16), { phase: "verse", beat: 1, bar: 2, done: false });
  assert.deepEqual(dojoBeat(67, 16), { phase: "verse", beat: 4, bar: 16, done: false });
  assert.deepEqual(dojoBeat(68, 16), { phase: "complete", beat: 0, bar: 16, done: true });
  assert.throws(() => dojoBeat(4, 13), /Unsupported/);
});

test("multisyllabic spelling patterns do not claim dictionary-verified phonetic rhymes", () => {
  assert.equal(rhymePattern("generation"), "ation");
  assert.equal(rhymePattern("celebration"), "ation");
  assert.equal(rhymePattern("cat"), "");
  const groups = multisyllablePatterns("[Verse 1]\nI'm painting a generation\nCreative celebration\nAnother bright generation!\nShort rhyme time");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].pattern, "ation");
  assert.deepEqual(groups[0].words.map(w => w.word), ["generation", "celebration", "generation"]);
  assert.deepEqual(groups[0].words.map(w => w.line), [2, 3, 4]);
  assert.equal(multisyllablePatterns("cat\nbat\nrat").length, 0);
});

test("download names are safe filename fragments", () => {
  assert.equal(safeClipName("../../My :* freestyle?!"), "My-freestyle");
  assert.equal(safeClipName(""), "freestyle");
  assert.ok(safeClipName("x".repeat(200)).length <= 56);
});

test("Writers Room links the Dojo to its private lyric page without rewriting album audio", () => {
  const writers = readFileSync("src/components/WritersRoom.tsx", "utf8");
  const dojo = readFileSync("src/components/FreestyleDojo.tsx", "utf8");
  const storage = readFileSync("src/lib/dojoRecordings.ts", "utf8");
  const house = readFileSync("src/components/HouseApp.tsx", "utf8");
  assert.match(writers, /"dojo", title: "Freestyle Dojo"/);
  assert.match(writers, /<FreestyleDojo page=\{page \?/);
  assert.match(dojo, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(dojo, /new MediaRecorder\(destination\.stream/);
  assert.match(dojo, /createMediaElementSource/);
  assert.match(dojo, /createMediaStreamDestination/);
  assert.match(dojo, /include.+local.+beat/i);
  assert.match(dojo, /mixBeat && beatUrl && beatSource\.current/);
  assert.match(dojo, /getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
  assert.match(dojo, /MAX_RECORD_SECONDS/);
  assert.match(dojo, /URL\.revokeObjectURL/);
  assert.match(dojo, /Record a take/);
  assert.match(dojo, /Long-rhyme pattern map/);
  assert.match(storage, /"mbl-freestyle-dojo-v1"/);
  assert.match(storage, /index\("pageId"\)/);
  assert.match(storage, /MAX_CLIP_BYTES/);
  assert.match(dojo, /JSON Freestyle Book exports do NOT include recordings/);
  assert.match(house, /\["writers", "Writers"\]/);
  assert.doesNotMatch(dojo, /https:\/\/(cdn1|cdn2)\.suno\.ai\/audio|fetch\(.+page\.body/);
});
