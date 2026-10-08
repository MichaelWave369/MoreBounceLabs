import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MixTrackInputError, validateMix, prepareMixForExport, newMixFromQueue, decodeMix, encodeMix } from "../src/lib/mixExchange.ts";
import { dedupeSavedMixes, savedMixKey, upsertSavedMix } from "../src/lib/savedMixes.ts";

const albums = JSON.parse(readFileSync("public/catalog/albums.json", "utf8")).albums;
const original = JSON.parse(readFileSync("tests/fixtures/mr-fl-golden-hour-annotated-recheck.json", "utf8"));

test("re-saving the same artist/name overwrites an earlier saved version rather than duplicating its chip", () => {
  const before = prepareMixForExport(original, albums);
  const updated = structuredClone(before);
  updated.description = "Refined set, same name and DJ, new arrangement";
  updated.tracks = [...updated.tracks].reverse();
  const first = upsertSavedMix(before, []);
  assert.equal(first.updated, false);
  const second = upsertSavedMix(updated, first.mixes);
  assert.equal(second.updated, true);
  assert.equal(second.mixes.length, 1);
  assert.equal(second.mixes[0].description, updated.description);
  assert.equal(second.mixes[0].tracks[0].albumId, updated.tracks[0].albumId);
  const third = upsertSavedMix(updated, second.mixes);
  assert.equal(third.mixes.length, 1);
  assert.equal(savedMixKey(updated), savedMixKey({ ...updated, name: " golden HOUR to Funk Peak and Back " }));
});

test("legacy browser storage duplicate chips collapse; differently credited mixes stay distinct", () => {
  const base = prepareMixForExport(original, albums);
  const other = { ...base, creator: { ...base.creator, name: "Another DJ" } };
  assert.equal(dedupeSavedMixes([base, base, structuredClone(base), other]).length, 2);
  assert.equal(dedupeSavedMixes(Array.from({length:45}, (_,i) => ({...base, name: "Set "+i}))).length, 20);
});

test("export strips numeric catalog prefixes, but keeps original catalog and canonical indexes unchanged", () => {
  const prepared = prepareMixForExport(original, albums);
  assert.equal(prepared.tracks[2].trackTitle, "Tunnel Bloom");
  assert.equal(prepared.tracks[7].trackTitle, "Signal Orchard");
  assert.equal(prepared.tracks[2].index, 3);
  assert.equal(prepared.tracks[7].index, 5);
  assert.deepEqual(prepared.tracks.map(t => t.energy), original.tracks.map(t => t.energy));
  assert.deepEqual(prepared.tracks.map(t => t.albumId), original.tracks.map(t => t.albumId));
  assert.equal(albums.find(a=>a.id==="lucid-altitude").tracks[3].title, "4. Tunnel Bloom");
  assert.equal(validateMix(prepared, albums).warnings.length, 0, "Presentation cleanups should not create false mismatch warnings");
  assert.deepEqual(decodeMix(encodeMix(prepared), albums).mix, validateMix(prepared, albums).mix);
  const queueMix = newMixFromQueue([{albumId:"lucid-altitude",index:3}], "One clean title", "DJ", "human", albums);
  assert.equal(queueMix.tracks[0].trackTitle, "Tunnel Bloom");
});

test("historically mismatched titles still survive export with an advisory receipt", () => {
  const historical = structuredClone(original);
  historical.tracks[2].trackTitle = "Previous master: Tunnel Bloom";
  const out = prepareMixForExport(historical, albums);
  assert.equal(out.tracks[2].trackTitle, historical.tracks[2].trackTitle);
  assert.equal(out.catalogWarnings?.[0]?.trackIndex,2);
  assert.equal(out.catalogWarnings?.[0]?.code,"metadata_mismatch");
  const forged = structuredClone(out);
  forged.tracks[2].albumId = "not-a-real-album";
  forged.catalogWarnings = [];
  assert.equal(validateMix(forged,albums).ok,false, "Receipt cannot authorize a missing track");
});

test("whitespace exceptions carry structured error code, exact zero-based position and raw albumId", () => {
  const bad = structuredClone(original);
  bad.tracks[4].albumId = "trunk-funk ";
  assert.throws(()=>validateMix(bad,albums), (err) => {
    assert.ok(err instanceof MixTrackInputError);
    assert.equal(err.code,"albumId_whitespace");
    assert.equal(err.trackIndex,4);
    assert.equal(err.albumId,"trunk-funk ");
    assert.match(err.message,/Track 5.*trunk-funk/);
    return true;
  });
});

test("UI puts import textarea before review and old creator form, while exposing deduplicated saves", () => {
  const ui=readFileSync("src/components/AgentMixStudio.tsx","utf8");
  const desk=readFileSync("src/components/FieldDesk.tsx","utf8");
  assert.ok(ui.indexOf("Import agent-created mix JSON") < ui.indexOf("{review && ("));
  assert.ok(ui.indexOf("Import agent-created mix JSON") < ui.indexOf("Create a mix from my queue"));
  assert.match(ui, /upsertSavedMix\(exported, saved\)/);
  assert.match(ui, /dedupeSavedMixes\(valid, MAX_SAVED\)/);
  assert.match(desk,/Desk QA R25/);
  assert.match(desk,/workspace === "desk"/);
});

test("public agent discovery is correctly project-scoped and only advertises read-only operations", () => {
  const index=readFileSync("public/agent/index.html","utf8");
  const pointer=JSON.parse(readFileSync("public/.well-known/mbl-agent.json","utf8"));
  const manifest=JSON.parse(readFileSync("public/agent/mix-manifest-v1.json","utf8"));
  const llms=readFileSync("public/llms.txt","utf8");
  assert.match(index,/Mix Exchange v1/);
  assert.match(index,/mix-manifest-v1.json/);
  assert.match(index,/window\.mblMix\.validate/);
  assert.equal(pointer.authority.playbackRequiresHumanApproval,true);
  assert.equal(pointer.manifest,manifest.schema.replace("mix-schema-v1.json","mix-manifest-v1.json"));
  assert.match(manifest.directory,/\/MoreBounceLabs\/agent\/$/);
  assert.match(llms,/MoreBounceLabs\/agent\/$/m);
  assert.equal(manifest.validation.readOnlyBrowserAPI.canPlayAudio,false);
});
