import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 LEDGER_FORMAT, LEDGER_MAX_EVENTS, safeTrackTitle, safeMarkerNote,
 detectSetChanges, appendLedgerEvents, exportSetLedger,
} from "./backspin-set-ledger.mjs";

const deck=(loaded=false,playing=false,title="")=>({loaded,playing,title});
const state=(a=deck(),b=deck(),x=0,ready=true)=>({ready,A:a,B:b,crossfader:x});

test("only transitions are logged; identical polled states produce no log spam",()=>{
 const a=state(deck(true,true,"Private Filename.wav"),deck(),-1);
 assert.deepEqual(detectSetChanges(a,a),[]);
 const b=state(deck(true,false,"Private Filename.wav"),deck(true,true,"Banger.mp3"),1);
 const events=detectSetChanges(a,b);
 assert.deepEqual(events.map(e=>e.kind),["pause","track-loaded","play","crossfader-zone"]);
 assert.equal(events.some(e=>e.detail.includes("Private Filename")||e.detail.includes("Banger")),false);
 assert.ok(events.every(e=>e.source==="OBSERVED"));
});

test("track titles can be recorded only on explicit opt in, with bounded sanitization",()=>{
 const before=state(deck(false,false,""));
 const after=state(deck(true,false,"  Secret song\n.wav "));
 assert.ok(!detectSetChanges(before,after,false)[0].detail.includes("Secret"));
 assert.match(detectSetChanges(before,after,true)[0].detail,/Secret song .wav/);
 assert.equal(safeTrackTitle("x".repeat(200)).length,120);
 assert.equal(safeMarkerNote("\n one\r two "), "one  two");
});

test("boot and crossfader regions are observed, not falsely treated as audio evidence",()=>{
 const a=state(deck(),deck(),-1,false),b=state(deck(),deck(),0,true);
 assert.deepEqual(detectSetChanges(a,b).map(e=>e.kind),["audio-initialized","crossfader-zone"]);
});

test("event memory bounded to 1000 without mutating the original list",()=>{
 const old=Object.freeze([{id:1}]);
 const incoming=Array.from({length:LEDGER_MAX_EVENTS+4},(_,id)=>({id:id+2}));
 const next=appendLedgerEvents(old,incoming);
 assert.equal(next.length,LEDGER_MAX_EVENTS);
 assert.equal(next.at(-1).id,LEDGER_MAX_EVENTS+5);
 assert.equal(old.length,1);
});

test("export carries provenance, no audio bytes or device identifiers",()=>{
 const entry={id:1,source:"MANUAL",kind:"transition",detail:"Transition marker",elapsedSeconds:8,at:"2026-10-23T00:00:08Z"};
 const result=JSON.parse(exportSetLedger([entry],{startedAt:"2026-10-23T00:00:00Z",tracksIncluded:false}));
 assert.equal(result.format,LEDGER_FORMAT);
 assert.equal(result.entries.length,1);
 assert.match(result.provenance.automatic,/polling gaps/);
 assert.equal(result.trackTitlesIncluded,false);
 assert.ok(!("audioData" in result) && !("deviceId" in result));
});

test("ledger reads snapshot only and does not rekey, remount or control the DJ engine",()=>{
 const ledger=readFileSync(new URL("../src/components/BackspinSetLedger.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(ledger,/(getUserMedia|MediaRecorder|\.play\(|fetch\(|localStorage|indexedDB|postMessage|setInterval|contentWindow|contentDocument)/);
 assert.match(ledger,/anchor\.download/);
 assert.match(ledger,/anchor\.click\(\)/); // explicit local JSON download only
 const app=readFileSync(new URL("../src/components/BackspinDecks.tsx",import.meta.url),"utf8");
 assert.match(app,/<BackspinSetLedger key=\{resetKey\}/);
 assert.match(app,/key=\{resetKey\}/);
 assert.doesNotMatch(app,/key=\{workspace\}/);
});
