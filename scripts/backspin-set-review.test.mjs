import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseSetLedgerForReview, summarizeSetReview, setReviewCsv, filterSetReview,
  clockSetReview, SET_REVIEW_FORMAT, SET_REVIEW_MAX_BYTES,
} from "./backspin-set-review.mjs";

const iso = "2026-10-23T20:00:00.000Z";
const sampleEntries = [
  {id:7,at:iso,elapsedSeconds:42,source:"MANUAL",kind:"transition",detail:"Great blend"},
  {id:3,at:iso,elapsedSeconds:2,source:"OBSERVED",kind:"track-loaded",deck:"A",detail:"Deck A reported a track load."},
  {id:4,at:iso,elapsedSeconds:8,source:"OBSERVED",kind:"play",deck:"A",detail:"Deck A reported playback."},
  {id:9,at:iso,elapsedSeconds:100,source:"OBSERVED",kind:"crossfader-zone",detail:"Crossfader entered B region."},
  {id:10,at:iso,elapsedSeconds:120,source:"MANUAL",kind:"highlight",detail:"Crowd reaction"},
];
const good = () => ({
 format:SET_REVIEW_FORMAT,startedAt:iso,endedAt:null,trackTitlesIncluded:false,entries:sampleEntries,
});
const parse = (doc) => parseSetLedgerForReview(JSON.stringify(doc));

test("valid exported ledger is safely normalized and chronologically ordered",()=>{
 const review = parse({...good(),maliciousAdditionalField:{a:"ignored"}});
 assert.deepEqual(review.entries.map(x=>x.id),[3,4,7,9,10]);
 assert.equal(review.entries.length,5);
 assert.equal(review.trackTitlesIncluded,false);
 assert.equal(review.imported,true);
 assert.equal(review.maliciousAdditionalField,undefined);
});

test("reject malformed format, timestamps, IDs, provenance and excessive inputs",()=>{
 assert.throws(()=>parseSetLedgerForReview("{what"),/not valid JSON/);
 assert.throws(()=>parseSetLedgerForReview("x".repeat(SET_REVIEW_MAX_BYTES+1)),/too large/);
 assert.throws(()=>parse({...good(),format:"unknown"}),/Expected/);
 assert.throws(()=>parse({...good(),startedAt:"yesterday"}),/timestamp/);
 assert.throws(()=>parse({...good(),trackTitlesIncluded:null}),/privacy/);
 assert.throws(()=>parse({...good(),entries:"not-an-array"}),/entries array/);
 assert.throws(()=>parse({...good(),entries:Array.from({length:1001},(_,i)=>({...sampleEntries[0],id:i+1}))}),/at most/);
 assert.throws(()=>parse({...good(),entries:[sampleEntries[0],sampleEntries[0]]}),/duplicate/);
 assert.throws(()=>parse({...good(),entries:[{...sampleEntries[0],source:"VERIFIED"}]}),/provenance/);
 assert.throws(()=>parse({...good(),entries:[{...sampleEntries[0],elapsedSeconds:-1}]}),/elapsed time/);
 assert.throws(()=>parse({...good(),entries:[{...sampleEntries[0],detail:"bad\ntext"}]}),/details/);
 assert.throws(()=>parse({...good(),entries:[{...sampleEntries[0],deck:"C"}]}),/deck/);
});

test("set summary does not claim actual mix quality",()=>{
 const review=parse(good());
 const x=summarizeSetReview(review.entries);
 assert.equal(x.eventCount,5);
 assert.equal(x.manualTransitions,1);
 assert.equal(x.faderZones,1);
 assert.equal(x.highlights,1);
 assert.equal(x.decks.A.loads,1);
 assert.equal(x.decks.A.plays,1);
 assert.equal(x.durationSeconds,120);
 assert.match(x.caveat,/not a measurement/i);
});

test("filters keep declared provenance distinct from action kind",()=>{
 const r=parse(good()).entries;
 assert.equal(filterSetReview(r,"observed").length,3);
 assert.equal(filterSetReview(r,"manual").length,2);
 assert.equal(filterSetReview(r,"transitions").length,2);
 assert.equal(filterSetReview(r,"loads").length,1);
 assert.equal(filterSetReview(r,"all").length,5);
});

test("CSV escapes formulas and quoted notes, preserving the selected review",()=>{
 const input=[{...sampleEntries[0],detail:'=HYPERLINK("evil", "click")'}];
 const csv=setReviewCsv(input);
 assert.match(csv,/"'=HYPERLINK\(""evil"", ""click""\)"/);
 assert.ok(csv.includes("Timestamp (UTC)"));
 assert.equal(clockSetReview(3661),"01:01:01");
 assert.equal(setReviewCsv([]).split("\r\n").length,2);
});

test("review component is read-only and does not alter mounted audio engine",()=>{
 const src=readFileSync(new URL("../src/components/BackspinSetReview.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(src, /getUserMedia|MediaRecorder|\.play\(|contentWindow|contentDocument|localStorage|indexedDB|postMessage|fetch\(/);
 assert.match(src, /parseSetLedgerForReview/);
 assert.match(src, /setReviewCsv/);
 const ledger=readFileSync(new URL("../src/components/BackspinSetLedger.tsx",import.meta.url),"utf8");
 assert.match(ledger, /<BackspinSetReview/);
 const engine=readFileSync(new URL("../src/components/BackspinDecks.tsx",import.meta.url),"utf8");
 assert.match(engine,/key=\{resetKey\}/);
 assert.doesNotMatch(engine,/key=\{workspace\}/);
});
