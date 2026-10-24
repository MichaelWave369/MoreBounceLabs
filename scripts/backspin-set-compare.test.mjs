import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SET_COMPARE_METRICS, compareEventBands, compareSetLedgers,
  setComparisonCsv,
} from "./backspin-set-compare.mjs";

const at = "2026-10-23T20:00:00.000Z";
const evt = (id, seconds, source, kind, deck, detail = "private note") =>
  ({id, at, elapsedSeconds:seconds, source, kind, detail, ...(deck ? {deck} : {})});

const first=[
  evt(1,0,"MANUAL","monitoring-started"),
  evt(2,10,"OBSERVED","track-loaded","A"),
  evt(3,20,"OBSERVED","play","A"),
  evt(4,25,"MANUAL","transition"),
  evt(5,50,"OBSERVED","crossfader-zone"),
  evt(6,100,"MANUAL","highlight"),
];
const second=[
  evt(1,0,"MANUAL","monitoring-started"),
  evt(2,20,"OBSERVED","track-loaded","A"),
  evt(3,50,"OBSERVED","track-loaded","B"),
  evt(4,60,"OBSERVED","play","B"),
  evt(5,100,"MANUAL","transition"),
  evt(6,150,"MANUAL","transition"),
  evt(7,200,"OBSERVED","crossfader-zone"),
];

test("comparison counts events by fixed provenance-aware metrics and does not score a DJ", () => {
  const summary=compareSetLedgers(first,second);
  assert.equal(summary.ready,true);
  assert.equal(summary.eventCounts.a,6);
  assert.equal(summary.eventCounts.b,7);
  assert.deepEqual(summary.durations,{a:100,b:200});
  assert.equal(summary.metrics.length,SET_COMPARE_METRICS.length);
  assert.deepEqual(summary.metrics.find(x=>x.id==="manualTransitions"),
    {id:"manualTransitions",label:"Manual transitions",interpret:"Operator-marked transitions only",a:1,b:2,delta:1});
  assert.equal(summary.metrics.find(x=>x.id==="bLoads").delta,1);
  assert.match(summary.caution,/make skill or quality comparisons invalid/);
});

test("relative activity histograms are bounded to five percentages and reject invalid time", () => {
  assert.deepEqual(compareEventBands(first,100),[2,2,1,0,1]);
  assert.deepEqual(compareEventBands(second,200),[2,2,1,1,1]);
  assert.deepEqual(compareEventBands(first,0),[0,0,0,0,0]);
  assert.deepEqual(compareEventBands([{elapsedSeconds:-12},{elapsedSeconds:Infinity},{elapsedSeconds:12}],100),[1,0,0,0,0]);
});

test("empty comparison cannot be exported as if it were a real two-set comparison", () => {
  assert.equal(compareSetLedgers([],first).ready,false);
  assert.equal(compareSetLedgers(first,[]).ready,false);
  assert.equal(compareSetLedgers([],[]).ready,false);
});

test("CSV contains only fixed metric labels and numbers, never user notes or titles", () => {
  const malicious=evt(8,35,"MANUAL","note",undefined,'=HYPERLINK("https://evil.test","run")');
  const result=compareSetLedgers([...first,malicious],second);
  const csv=setComparisonCsv(result);
  assert.match(csv,/Manual transitions/);
  assert.match(csv,/B minus A/);
  assert.doesNotMatch(csv,/HYPERLINK|evil\.test|private note/);
  assert.equal(csv.trimEnd().split("\r\n").length,SET_COMPARE_METRICS.length+1);
});

test("R7 interface reads R6 selection and never touches player or network", () => {
  const ui=readFileSync(new URL("../src/components/BackspinSetCompare.tsx",import.meta.url),"utf8");
  const parent=readFileSync(new URL("../src/components/BackspinSetReview.tsx",import.meta.url),"utf8");
  const decks=readFileSync(new URL("../src/components/BackspinDecks.tsx",import.meta.url),"utf8");
  assert.match(parent,/<BackspinSetCompare/);
  assert.match(ui,/parseSetLedgerForReview/);
  assert.match(ui,/setComparisonCsv/);
  assert.doesNotMatch(ui,/getUserMedia|MediaRecorder|\.play\(|contentWindow|contentDocument|localStorage|indexedDB|postMessage|fetch\(/);
  assert.match(decks,/key=\{resetKey\}/);
  assert.doesNotMatch(decks,/key=\{workspace\}/);
});
