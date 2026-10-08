import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync("src/components/HouseApp.tsx", "utf8");
const lens = readFileSync("src/components/InfinityLensStage.tsx", "utf8");

test("the Lab renders exactly one visual system: InfinityLens", () => {
  const lab = shell.match(/\{house\.room === "lab" &&[^\n]+\}/)?.[0];
  assert.ok(lab, "The dedicated Lab room must exist");
  assert.match(lab, /<InfinityLensStage reduced=\{reduced\}/);
  assert.doesNotMatch(lab, /VizCanvas|VIZ_MODES|setViz|vizNote/);
  assert.equal((shell.match(/<InfinityLensStage /g) || []).length, 1);
  // The older house visualization is still available ONLY in Listening Lounge.
  assert.match(shell, /function Lounge\(/);
  assert.match(shell, /<VizCanvas mode=\{mode\} reduced=\{reduced\}/);
});

test("InfinityLens mounts on Lab entry and retains guarded controls", () => {
  assert.match(lens, /<h1[^>]*>Infinity Lab<\/h1>/);
  assert.match(lens, /setLaunched\(true\)/);
  assert.match(lens, /prefers-reduced-motion: reduce/);
  assert.match(lens, /iframe key=\{session\} ref=\{frame\}/);
  assert.match(lens, /src=\{LENS_URL\}/);
  assert.match(lens, /send\("mode"/);
  assert.match(lens, /send\("palette"/);
  assert.match(lens, /send\("safe"\)/);
  assert.match(lens, /send\("reset"\)/);
  assert.match(lens, /event\.source !== frame\.current\?\.contentWindow/);
  assert.match(lens, /event\.origin !== LENS_ORIGIN/);
});
