import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace, isOriginalRigVisible, hasMixInProgress, WORKSPACE_MODES } from "./backspin-workspace.mjs";

test("workspace accepts only the three known view modes", () => {
  assert.deepEqual(WORKSPACE_MODES, ["vinyl", "console", "studio"]);
  for (const invalid of [null, "", "unknown", "STUDIO", "/backspin96", {}, 3])
    assert.equal(normalizeWorkspace(invalid), "vinyl");
  for (const mode of WORKSPACE_MODES) assert.equal(normalizeWorkspace(mode), mode);
});

test("standalone displays original rig only in studio mode; integrated toggle is unchanged", () => {
  assert.equal(isOriginalRigVisible(true, "vinyl", true), false);
  assert.equal(isOriginalRigVisible(true, "console", true), false);
  assert.equal(isOriginalRigVisible(true, "studio", false), true);
  assert.equal(isOriginalRigVisible(false, "studio", false), false);
  assert.equal(isOriginalRigVisible(false, "vinyl", true), true);
});

test("unloaded decks permit reset and loaded or playing decks require confirmation", () => {
  const empty = {A: {loaded:false, playing:false}, B:{loaded:false,playing:false}};
  assert.equal(hasMixInProgress(empty), false);
  assert.equal(hasMixInProgress(null), false);
  assert.equal(hasMixInProgress({A: {loaded:true}, B:{loaded:false}}), true);
  assert.equal(hasMixInProgress({A: {loaded:false}, B:{playing:true}}), true);
});

test("workspace changes do not remount the actual audio iframe", () => {
  const source = readFileSync(new URL("../src/components/BackspinDecks.tsx", import.meta.url), "utf8");
  assert.match(source, /key=\{resetKey\}/);
  assert.doesNotMatch(source, /key=\{workspace\}/);
  assert.match(source, /const showOriginalRig = isOriginalRigVisible/);
  assert.match(source, /hasMixInProgress\(snapshot\)/);
});
