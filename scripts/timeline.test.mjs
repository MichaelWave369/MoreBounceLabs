import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildTimeline, filterTimeline, groupTimeline, timelineYears, TIMELINE_ERAS } from "../src/lib/timeline.ts";
import { parseHash } from "./house-logic.mjs";

const sunoCatalog = JSON.parse(readFileSync("public/catalog/albums.json", "utf8")).albums;
const soundcloudCatalog = JSON.parse(readFileSync("src/data/soundcloud-albums.json", "utf8")).albums;
const entries = buildTimeline(sunoCatalog, soundcloudCatalog);

test("the timeline combines all 19 Suno and 18 SoundCloud releases without inventing records", () => {
  assert.equal(sunoCatalog.length, 19);
  assert.equal(soundcloudCatalog.length, 18);
  assert.equal(entries.length, 37);
  assert.equal(entries.filter((e) => e.provider === "suno").length, 19);
  assert.equal(entries.filter((e) => e.provider === "soundcloud").length, 18);
  assert.equal(entries.reduce((n, entry) => n + entry.tracks, 0), 544);
  assert.equal(new Set(entries.map((entry) => `${entry.provider}:${entry.id}`)).size, 37);
  assert.ok(entries.every((entry) => entry.title && entry.cover && entry.tracks > 0));
});

test("verified release years, not synthetic month/day dates, define chronological chapters", () => {
  assert.deepEqual(timelineYears(entries), [2026, 2025, 2024, 2023, 2022]);
  assert.deepEqual(groupTimeline(entries).map(({year,entries})=>[year,entries.length]), [
    [2026,21], [2025,1], [2024,3], [2023,11], [2022,1],
  ]);
  for (const year of timelineYears(entries)) assert.ok(TIMELINE_ERAS[year], `Missing visual era ${year}`);
  for (let i=1; i<entries.length; i++) {
    assert.ok(entries[i-1].year >= entries[i].year);
    if (entries[i-1].year === entries[i].year)
      assert.ok(entries[i-1].title.localeCompare(entries[i].title) <= 0);
  }
});

test("source filters, year filters and text search work without mutating albums", () => {
  const inputCount = entries.length;
  assert.equal(filterTimeline(entries, {provider:"soundcloud",year:2023,query:"boga beatz"}).length, 9);
  assert.equal(filterTimeline(entries, {provider:"suno",year:2026,query:""}).length, 19);
  assert.equal(filterTimeline(entries, {provider:"soundcloud",year:2022,query:"reflections"}).length, 1);
  assert.equal(filterTimeline(entries, {provider:"suno",year:2022,query:""}).length, 0);
  assert.equal(filterTimeline(entries, {provider:"all",year:"all",query:"NoSuchAlbum1234"}).length, 0);
  assert.equal(filterTimeline(entries, {provider:"all",year:"all",query:"  BOGA BEATZ V.1 "}).length, 1);
  assert.equal(entries.length, inputCount);
});

test("timeline is a refresh-safe hash route on project GitHub Pages", () => {
  assert.equal(parseHash("#/timeline").room, "timeline");
  assert.equal(parseHash("#/timeline").albumId, "");
  assert.equal(parseHash("#/vault").room, "vault");
  assert.equal(parseHash("#/album/trunk-funk").room, "album");
});

test("provider-specific links are handled in-house, not by direct unauthorized streams", () => {
  const component = readFileSync("src/components/MusicTimeline.tsx", "utf8");
  const shell = readFileSync("src/components/HouseApp.tsx", "utf8");
  assert.match(component, /onOpenSuno\(entry\.id\)/);
  assert.match(component, /onOpenSoundCloud\(entry\.id\)/);
  assert.match(shell, /house\.go\("vault"\);\s*selectSoundCloud\(id\)/);
  assert.match(shell, /\["timeline", "Timeline"\]/);
  assert.doesNotMatch(component, /stream_url|download_url|client_id|client_secret/);
});
