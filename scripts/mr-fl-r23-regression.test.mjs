import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateMix, queueMix, prepareMixForExport, decodeMix, encodeMix } from "../src/lib/mixExchange.ts";
import { cleanCatalogTrackNumber } from "../src/lib/displayTrackTitle.ts";

const albums = JSON.parse(readFileSync("public/catalog/albums.json","utf8")).albums;
const mix = JSON.parse(readFileSync("tests/fixtures/mr-fl-golden-hour-annotated-recheck.json","utf8"));

test("Mr. FL's 10-track annotated set preserves real album positions and full energy arc", () => {
  const review = validateMix(mix, albums);
  assert.equal(review.ok, true, JSON.stringify(review.errors));
  assert.deepEqual(review.errors, []);
  assert.deepEqual(review.warnings, []);
  assert.equal(review.queue.length, 10);
  assert.deepEqual(mix.tracks.map((t) => t.energy), [0.25,0.3,0.4,0.5,0.7,0.8,0.95,0.5,0.3,0.2]);
  assert.equal(mix.tracks[6].trackTitle, "OverFunk");
  assert.deepEqual(decodeMix(encodeMix(mix),albums).mix, review.mix);
});

test("catalog track numbering is presentation-only and set ordinals remain sequential", () => {
  assert.equal(cleanCatalogTrackNumber("4. Tunnel Bloom"), "Tunnel Bloom");
  assert.equal(cleanCatalogTrackNumber("6. Signal Orchard"), "Signal Orchard");
  assert.equal(cleanCatalogTrackNumber("OverFunk"), "OverFunk");
  assert.equal(cleanCatalogTrackNumber("5) Part Two"), "Part Two");
  assert.equal(mix.tracks[2].trackTitle, "4. Tunnel Bloom", "Original catalog title is never changed");
  assert.equal((2+1)+". "+cleanCatalogTrackNumber(mix.tracks[2].trackTitle),"3. Tunnel Bloom");
  assert.equal((7+1)+". "+cleanCatalogTrackNumber(mix.tracks[7].trackTitle),"8. Signal Orchard");
});

test("strict exact album IDs do not silently trim spaces", () => {
  const wrong = structuredClone(mix);
  wrong.tracks[0].albumId = "the-azure-inheritance ";
  assert.throws(() => validateMix(wrong, albums), /Track 1.*albumId must match the catalog exactly/);
  assert.throws(() => validateMix({...mix,tracks:[{...mix.tracks[0],albumId:" the-azure-inheritance"}]},albums), /leading\/trailing whitespace/);
});

test("out-of-range song is a structured, track-specific unplayable error", () => {
  const wrong = structuredClone(mix);
  wrong.tracks[4].index = 100;
  const review = validateMix(wrong,albums);
  assert.equal(review.ok,false);
  assert.equal(review.errors[0].code,"track_missing");
  assert.equal(review.errors[0].trackIndex,4);
  assert.match(review.errors[0].message,/Track 5 \(neon-afterglow-society\)/);
  assert.throws(() => queueMix(review.mix,albums),/missing catalog/);
});

test("exports enrich missing readable names without altering DJ creative metadata", () => {
  const oldShape = structuredClone(mix);
  oldShape.tracks.forEach((t) => {
    delete t.albumTitle; delete t.artist; delete t.trackTitle;
  });
  const hydrated = prepareMixForExport(oldShape,albums);
  assert.ok(hydrated.tracks.every(t => t.albumTitle && t.artist && t.trackTitle));
  assert.deepEqual(hydrated.tracks.map(t=>t.energy),mix.tracks.map(t=>t.energy));
  assert.equal(hydrated.tracks[2].trackTitle,"Tunnel Bloom", "Exported display title omits legacy numbering");
  assert.deepEqual(decodeMix(encodeMix(hydrated),albums).mix,
    validateMix(hydrated,albums).mix, "Reloaded mix remains catalog-safe");
});

test("title mismatch produces an advisory receipt on export, never trusted for authorization", () => {
  const stale=structuredClone(mix);
  stale.tracks[2].trackTitle="Historic Tunnel Bloom";
  const checked=validateMix(stale,albums);
  assert.equal(checked.ok,true);
  assert.equal(checked.warnings[0].code,"metadata_mismatch");
  const exported=prepareMixForExport(stale,albums);
  assert.equal(exported.tracks[2].trackTitle,"Historic Tunnel Bloom",
    "Never silently rewrite user-authored historic title");
  assert.equal(exported.catalogWarnings?.[0].trackIndex,2);
  assert.equal(exported.catalogWarnings?.[0].code,"metadata_mismatch");
  const forged=structuredClone(exported);
  forged.tracks[2].albumId="made-up-album";
  forged.catalogWarnings=[];
  assert.equal(validateMix(forged,albums).ok,false, "Old receipt cannot grant playback");
});

test("responsive UI provides Desk switch, per-position errors and version history", () => {
  const ui=readFileSync("src/components/AgentMixStudio.tsx","utf8");
  const desk=readFileSync("src/components/FieldDesk.tsx","utf8");
  const player=readFileSync("src/components/HouseApp.tsx","utf8");
  assert.match(ui, /const error = review.errors.find/);
  assert.match(ui, /Track error: \{error.message\}/);
  assert.match(ui, /Catalog warning: \{warning.message\}/);
  assert.match(ui, /prepareMixForExport\(selected, albums\)/);
  assert.match(ui, /Copy validation JSON/);
  assert.match(desk, /Open Agent Mix Studio/);
  assert.match(desk, /Desk QA R25/);
  assert.match(desk, /mix-changelog\.txt/);
  assert.match(desk, /cleanCatalogTrackNumber\(song.title\)/);
  assert.match(player,/house.room === "lab" \|\| house.room === "desk"/);
  assert.match(player,/installReadOnlyMixApi\(house.albums\)/);
});

test("agent discovery text, manifest and schema publish read-only API and warning receipt", () => {
  const llms=readFileSync("public/llms.txt","utf8");
  const changelog=readFileSync("public/agent/mix-changelog.txt","utf8");
  const schema=JSON.parse(readFileSync("public/agent/mix-schema-v1.json","utf8"));
  const manifest=JSON.parse(readFileSync("public/agent/mix-manifest-v1.json","utf8"));
  assert.match(llms,/window\.mblMix\.validate/);
  assert.match(changelog,/R23/);
  assert.match(manifest.llms,/\/MoreBounceLabs\/llms\.txt$/);
  assert.equal(manifest.validation.readOnlyBrowserAPI.canPlayAudio,false);
  assert.equal(manifest.validation.readOnlyBrowserAPI.sideEffects,false);
  assert.ok(schema.properties.catalogWarnings,"Exported mismatch receipt must be included in public JSON Schema");
  const api=readFileSync("src/lib/mixAgentApi.ts","utf8");
  assert.doesNotMatch(api,/\.playQueue\(|\.playAlbum\(|getAudio\(|eval\(/);
});
