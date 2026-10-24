import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessPreflight, MANUAL_SOUNDCHECK, summarizePreflight, makeSoundcheckReport } from "./backspin-preflight.mjs";

const input = {
  manifestStatus: "ready",
  bridgeReady: true,
  snapshot: { ready: true, A: {loaded: true}, B: {loaded: true} },
  secureContext: true,
  audioWorkletSupported: true,
};

test("a fully initialized software environment is still not an operator-tested DJ output", () => {
  const checks = assessPreflight(input);
  assert.equal(checks.length, 7);
  assert.ok(checks.every((item) => item.state === "pass"));
  const summary = summarizePreflight(checks, new Set());
  assert.equal(summary.observedPass, 7);
  assert.equal(summary.manualPass, 0);
  assert.equal(summary.complete, false);
  assert.equal(summary.status, "incomplete");
});

test("missing runtime and browser capability produce honest attention flags", () => {
  const checks = assessPreflight({
    ...input,
    manifestStatus: "missing",
    bridgeReady: false,
    secureContext: false,
    audioWorkletSupported: false,
    snapshot: { ready: false, A: {loaded: false}, B: {loaded: false} },
  });
  assert.deepEqual(checks.filter((c) => c.state === "attention").map((c) => c.id), ["secure", "worklet", "runtime"]);
  assert.equal(summarizePreflight(checks, new Set(MANUAL_SOUNDCHECK.map((x) => x.id))).complete, false);
  assert.equal(summarizePreflight(checks, new Set()).status, "needs-attention");
});

test("preflight completion requires observed readiness AND explicit manual checks", () => {
  const checks = assessPreflight(input);
  const checked = new Set(MANUAL_SOUNDCHECK.map((x) => x.id));
  assert.deepEqual(summarizePreflight(checks, checked), {
    observedPass: 7, observedTotal: 7, manualPass: 5, manualTotal: 5,
    status: "operator-checked", complete: true,
  });
  assert.equal(summarizePreflight(checks, new Set([...checked].slice(1))).complete, false);
});

test("local report omits track titles and distinguishes observed from self-attested checks", () => {
  const report = makeSoundcheckReport(assessPreflight(input), new Set(["output-a"]), "2026-10-23T00:00:00Z");
  assert.match(report, /software signals only/);
  assert.match(report, /self-attested/);
  assert.match(report, /CHECKED\] Deck A is audible/);
  assert.match(report, /NOT CHECKED\] Deck B is audible/);
  assert.doesNotMatch(report, /filename:|recording content:|localStorage/);
});

test("component only reads engine signals; no auto-play or hidden recording introduced", () => {
  const source = readFileSync(new URL("../src/components/BackspinPreflight.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /getUserMedia|MediaRecorder|\.play\(|autoplay|\.click\(/);
  const decks = readFileSync(new URL("../src/components/BackspinDecks.tsx", import.meta.url), "utf8");
  assert.match(decks, /<BackspinPreflight/);
  assert.match(decks, /key=\{resetKey\}/);
});
