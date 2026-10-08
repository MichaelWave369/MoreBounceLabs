import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { decodeMix, encodeMix, newMixFromQueue, queueMix, validateMix } from "../src/lib/mixExchange.ts";

const catalog = JSON.parse(readFileSync("public/catalog/albums.json", "utf8")).albums;
const [album] = catalog;
const original = {
  format: "mbl-mix-v1", name: "Golden Hour", creator: {type:"agent",name:"Grok Bot"},
  description: "Golden hour to funk peak and back",
  tracks: [{albumId:album.id,index:0,transition:"cut",note:"Warm entrance"}],
};

test("distinct missing/long descriptions and precise per-song error locations", () => {
  assert.throws(() => validateMix({...original,description:undefined},catalog), /Description is missing/);
  assert.throws(() => validateMix({...original,description:"   "},catalog), /Description is missing/);
  assert.throws(() => validateMix({...original,description:"z".repeat(801)},catalog), /Description too long/);
  assert.throws(() => validateMix({...original,tracks:[{...original.tracks[0],index:-1}]},catalog),
    /Track 1 \(.+\): invalid track index/);
  assert.throws(() => validateMix({...original,tracks:[
    original.tracks[0],{...original.tracks[0],albumId:"broken-planet",index:-1}
  ]},catalog), /Track 2 \(broken-planet\): invalid track index/);
});

test("missing catalog album is an unplayable structured error with exact position", () => {
  const mix = {...original,tracks:[original.tracks[0],{...original.tracks[0],albumId:"does-not-exist"}]};
  const review = validateMix(mix,catalog);
  assert.equal(review.ok,false);
  assert.deepEqual(review.errors.map(e=>({code:e.code,trackIndex:e.trackIndex,albumId:e.albumId})),
    [{code:"album_missing",trackIndex:1,albumId:"does-not-exist"}]);
  assert.match(review.errors[0].message,/Track 2 \(does-not-exist\)/);
  assert.throws(()=>queueMix(review.mix,catalog),/missing catalog/);
  assert.equal(decodeMix(encodeMix(review.mix),catalog).ok,false);
  const badTrack = {...original,tracks:[{...original.tracks[0],index:199}]};
  assert.equal(validateMix(badTrack,catalog).errors[0].code,"track_missing");
});

test("dangerous schemes in notes are rejected even when React would escape them", () => {
  for(const value of ["file:///etc/passwd","javascript:alert(1)","data:text/html,a","vbscript:MsgBox(1)"]) {
    assert.throws(()=>validateMix({...original,tracks:[{...original.tracks[0],note:value}]},catalog), /Track 1.*file and script URLs/);
  }
  assert.throws(()=>validateMix({...original,description:"read file:///secret"},catalog),/unsupported file or script URL/);
  assert.equal(validateMix({...original,tracks:[{...original.tracks[0],note:"Warm waves. No scripts."}]},catalog).ok,true);
});

test("optional DJ fields remain annotations, never claimed as measured or executed", () => {
  const decorated = {...original,tracks:[{...original.tracks[0],
    bpm:124,key:"Am",energy:0.7,startAtSec:12.5,
    albumTitle:album.title,artist:album.artist,trackTitle:album.tracks[0].title,
  }]};
  const review=validateMix(decorated,catalog);
  assert.equal(review.ok,true);
  assert.deepEqual(decodeMix(encodeMix(review.mix),catalog).mix,review.mix);
  assert.deepEqual(review.warnings,[]);
  assert.equal(validateMix({...decorated,tracks:[{...decorated.tracks[0],trackTitle:"Former title"}]},catalog).warnings[0].code,"metadata_mismatch");
  for (const invalid of [{energy:1.5},{bpm:-4},{startAtSec:-1},{key:"x".repeat(40)}]) {
    assert.throws(()=>validateMix({...original,tracks:[{...original.tracks[0],...invalid}]},catalog),/Track 1/);
  }
});

test("mixes from queued songs contain readable names without losing stable catalog references", () => {
  const mix=newMixFromQueue([{albumId:album.id,index:0}],"Funk Set","DJ Human","human",catalog);
  assert.equal(mix.tracks[0].albumTitle,album.title);
  assert.equal(mix.tracks[0].artist,album.artist);
  assert.equal(mix.tracks[0].trackTitle,album.tracks[0].title);
  assert.equal(mix.tracks[0].albumId,album.id);
  assert.equal(queueMix(mix,catalog)[0].index,0);
});

test("machine-readable schema and manifest describe the real public contract", () => {
  const schema=JSON.parse(readFileSync("public/agent/mix-schema-v1.json","utf8"));
  const manifest=JSON.parse(readFileSync("public/agent/mix-manifest-v1.json","utf8"));
  assert.equal(schema.$id,manifest.schema);
  assert.equal(schema.properties.format.const,"mbl-mix-v1");
  assert.equal(schema.properties.tracks.maxItems,40);
  assert.equal(schema.properties.tracks.items.properties.energy.maximum,1);
  assert.match(manifest.catalog,/\/catalog\/albums\.json$/);
  assert.equal(manifest.validation.requiresHumanApproval,true);
});

test("compact accessible UI reveals review errors before import and blocks saving invalid mix", () => {
  const ui=readFileSync("src/components/AgentMixStudio.tsx","utf8");
  const preview=ui.indexOf("{review && (");
  const importBox=ui.indexOf("Import agent-created mix JSON");
  assert.ok(importBox>0 && importBox<preview,"Quick import must appear before review for above-fold access");
  assert.match(ui,/UNPLAYABLE MIX/);
  assert.match(ui,/Can't play/);
  assert.match(ui,/disabled=\{!valid\} onClick=\{saveMix\}/);
  assert.match(ui,/disabled=\{!valid\} onClick=\{.*downloadMix/);
  assert.match(ui,/disabled=\{!valid\} onClick=\{\(\) => void copyLink\(\)\}/);
  assert.match(ui,/useState\(""\)/);
  assert.doesNotMatch(ui,/useState\("Mr\. FL"\)/);
  assert.doesNotMatch(ui,/useState\("Dimensional Bounce Session"\)/);
});
