import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chooseSpotlightIndex, spotlightNextIndex } from "./lobby-spotlight.mjs";
import { RADIO_PROGRAMS, buildRadioProgram, stationBandIndices } from "./radio-programs.mjs";
import { autoReleaseDraft, normalizeReleaseUrl, releaseIssueUrl } from "../src/lib/releaseSubmission.ts";
import { mergeRelease, parseReleaseIssue } from "./import-release.mjs";

const catalog = JSON.parse(readFileSync("public/catalog/albums.json", "utf8"));
const cloud = JSON.parse(readFileSync("src/data/soundcloud-albums.json", "utf8"));

test("Lobby hero changes on each entry and can spotlight all albums", () => {
  const albums = catalog.albums;
  assert.ok(albums.length >= 19);
  const last = albums[2].id;
  for (const rnd of [0, 0.2, 0.5, 0.99, 1]) {
    const chosen = chooseSpotlightIndex(albums, last, () => rnd);
    assert.ok(chosen >= 0 && chosen < albums.length);
    assert.notEqual(albums[chosen].id, last, "Never repeat previous hero");
  }
  assert.equal(chooseSpotlightIndex([], last), -1);
  assert.equal(chooseSpotlightIndex([albums[0]], albums[0].id), 0);
  assert.equal(spotlightNextIndex(albums.length, albums.length - 1), 0);
  assert.equal(spotlightNextIndex(albums.length, 0), 1);
});

test("Each existing console preset has a distinct real curated station", () => {
  assert.deepEqual(RADIO_PROGRAMS.map(p=>p.id), ["solar", "trucker", "porch", "desert", "orbit"]);
  assert.equal(RADIO_PROGRAMS[0].band, "FM", "Solar Bounce FM must be an FM band");
  assert.equal(RADIO_PROGRAMS[3].band, "AM", "Deep Desert AM must be an AM band");
  assert.equal(RADIO_PROGRAMS[4].band, "SAT");
  const keys = new Set();
  RADIO_PROGRAMS.forEach((station) => {
    const items = buildRadioProgram(catalog.albums, station.id);
    assert.ok(items.length >= 15 && items.length <= 48, station.title + " must have a full playable program");
    assert.ok(new Set(items.map(t=>t.albumId)).size >= 3, "Station should really mix records, not play a single album");
    assert.ok(items.every(item => catalog.albums.some(a => a.id === item.albumId && a.tracks[item.index]?.title === item.title)),
      "No synthetic songs or URLs");
    assert.notEqual(items[0].albumId, items[1].albumId, "Radio should interleave albums");
    keys.add(items.map(item => item.albumId + "/" + item.index).join("|"));
  });
  assert.equal(keys.size, RADIO_PROGRAMS.length, "All five buttons need distinct station programming");
  const counts = RADIO_PROGRAMS.map(s => buildRadioProgram(catalog.albums,s.id).length);
  assert.deepEqual(stationBandIndices(RADIO_PROGRAMS,"AM",counts),[3]);
  assert.deepEqual(stationBandIndices(RADIO_PROGRAMS,"FM",counts),[0,1,2]);
  assert.deepEqual(stationBandIndices(RADIO_PROGRAMS,"SAT",counts),[4]);
  assert.deepEqual(stationBandIndices(RADIO_PROGRAMS,"ALL",counts),[0,1,2,3,4]);
});

test("Auto New Album works from one public artist URL, with explicit unknown SoundCloud count", async () => {
  const draft=autoReleaseDraft("https://soundcloud.com/microneesia/sets/my-next-record?si=share",2026);
  assert.equal(draft.mode,"auto");
  assert.equal(draft.provider,"soundcloud");
  assert.equal(draft.url,"https://soundcloud.com/microneesia/sets/my-next-record");
  assert.equal(draft.trackCount,undefined);
  assert.deepEqual(parseReleaseIssue(new URL(releaseIssueUrl(draft)).searchParams.get("body")), draft);
  const result=await mergeRelease(catalog,cloud,draft,async()=>({
    provider_name:"SoundCloud",author_url:"https://soundcloud.com/microneesia",
    title:"My Next Record by MicTek", thumbnail_url:"https://i1.sndcdn.com/artworks-test-123-t500x500.jpg",
  }));
  assert.equal(result.changed,true);
  const album=result.soundcloud.albums.at(-1);
  assert.equal(album.title,"My Next Record");
  assert.equal(album.trackCount,0);
  assert.equal(album.trackCountVerified,false);
  assert.equal(result.suno.albums.length,catalog.albums.length);
  assert.equal((await mergeRelease(catalog,result.soundcloud,draft,async()=>{throw Error("No second fetch");})).changed,false);
});

test("Suno one-link submission stays owner-reviewed, never publishes songs guessed from URL", () => {
  const uuid="b6e9b38a-8c52-4da4-9de1-4208a676c8d0";
  const draft=autoReleaseDraft("https://suno.com/album/"+uuid,2026);
  assert.equal(draft.provider,"suno");
  assert.deepEqual(parseReleaseIssue(new URL(releaseIssueUrl(draft)).searchParams.get("body")),draft);
  assert.equal(draft.tracks,undefined);
  assert.throws(()=>autoReleaseDraft("https://suno.com/album/invalid",2026),/supported/);
  assert.throws(()=>autoReleaseDraft("https://evil.test/album/"+uuid,2026),/public SoundCloud/);
  assert.equal(normalizeReleaseUrl("soundcloud","https://soundcloud.com/anotheruser/sets/not-mine"),null);
  const workflow=readFileSync(".github/workflows/update-albums.yml","utf8");
  const importer=readFileSync("scripts/import-release.mjs","utf8");
  assert.match(importer,/NEEDS_METADATA_SUNO/);
  assert.match(workflow,/NEEDS_MANUAL_SUNO/);
  assert.match(workflow,/Nothing was imported or published/);
});

test("Current Vault exposes URL-only workflow and manual owner option", () => {
  const ui=readFileSync("src/components/UpdateAlbums.tsx","utf8");
  assert.match(ui,/Auto new album/);
  assert.match(ui,/autoReleaseDraft/);
  assert.match(ui,/Manual details/);
  assert.match(ui,/Prepare update on GitHub/);
  const house=readFileSync("src/components/HouseApp.tsx","utf8");
  assert.doesNotMatch(house,/const featured = albums\[2\]/);
  assert.match(house,/chooseSpotlightIndex/);
  assert.match(house,/Next album spotlight/);
  const radio=readFileSync("src/components/RadioConsole.tsx","utf8");
  assert.match(radio,/buildRadioProgram/);
  assert.match(radio,/Station playlist preview/);
});
