import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  acceptableRadioFile, matchRadioFiles, MAX_RADIO_FILE_BYTES, MAX_RADIO_FILES,
  nextRadioIndex, radioName
} from "./radio-local.mjs";
import { buildRadioProgram } from "./radio-programs.mjs";

const catalog = JSON.parse(readFileSync("public/catalog/albums.json", "utf8"));
const consoleUi = readFileSync("src/components/RadioConsole.tsx", "utf8");
const playerUi = readFileSync("src/components/LocalContinuousRadio.tsx", "utf8");
const house = readFileSync("src/components/HouseApp.tsx", "utf8");

test("local radio accepts user-selected audio and rejects invalid or oversized inputs", () => {
  assert.equal(MAX_RADIO_FILES, 500);
  assert.equal(acceptableRadioFile({ name: "funk.mp3", size: 1024, type: "audio/mpeg" }), true);
  assert.equal(acceptableRadioFile({ name: "beat.wav", size: 100, type: "" }), true);
  assert.equal(acceptableRadioFile({ name: "song.txt", size: 100, type: "text/plain" }), false);
  assert.equal(acceptableRadioFile({ name: "song.mp3", size: 0 }), false);
  assert.equal(acceptableRadioFile({ name: "song.mp3", size: MAX_RADIO_FILE_BYTES + 1 }), false);
  assert.equal(acceptableRadioFile({ name: "song.mp3", size: 100 }), true);
});

test("normalized artist-owned filenames match only unambiguous real catalog tracks", () => {
  assert.equal(radioName("01-Neck Insurance.mp3"), "neck insurance");
  assert.equal(radioName("01 - Neck Insurance (Master).wav"), "neck insurance master");
  assert.equal(radioName("02_Wake Up Runner.MP3"), "wake up runner");
  const station = [
    { albumId: "album-a", index: 0, title: "01-Neck Insurance", albumTitle: "Head Nod Proof" },
    { albumId: "album-b", index: 1, title: "02-The Pocket", albumTitle: "Head Nod Proof" },
    { albumId: "album-c", index: 0, title: "01-No Doubt", albumTitle: "Test Album" }
  ];
  const files = [
    { name: "02-The Pocket.wav", size: 50, type: "audio/wav" },
    { name: "01 - Neck Insurance - Head Nod Proof.mp3", size: 50, type: "audio/mpeg" },
    { name: "notes.txt", size: 10, type: "text/plain" }
  ];
  assert.deepEqual(matchRadioFiles(files, station).map(item=>item.title),
    ["01-Neck Insurance", "02-The Pocket"]);
  assert.equal(matchRadioFiles([
    { name: "the-pocket.mp3", size: 10 },
    { name: "the pocket.wav", size: 10 }
  ], station).length, 0, "Ambiguous exact matches must not be silently paired");
});

test("continuous queue advances on media end and loops only when explicitly enabled", () => {
  assert.equal(nextRadioIndex(0, 3, true, false), 1);
  assert.equal(nextRadioIndex(2, 3, true, false), 0);
  assert.equal(nextRadioIndex(2, 3, false, false), -1);
  assert.equal(nextRadioIndex(0, 1, true, false), 0);
  assert.equal(nextRadioIndex(0, 1, false, false), -1);
  assert.equal(nextRadioIndex(0, 3, true, true, () => 0), 1);
  assert.equal(nextRadioIndex(0, 3, true, true, () => 0.99), 2);
  assert.equal(nextRadioIndex(-1, 3, true, false), -1);
  assert.equal(nextRadioIndex(3, 3, true, false), -1);
});

test("local radio does not fetch Suno files or fake provider autoplay", () => {
  assert.match(playerUi, /<audio ref=\{audioRef\} controls preload="metadata"/);
  assert.match(playerUi, /onEnded=\{next\}/);
  assert.match(playerUi, /URL\.createObjectURL\(files\[entry\.fileIndex\]\)/);
  assert.match(playerUi, /URL\.revokeObjectURL\(sourceRef\.current\)/);
  assert.match(playerUi, /onStart\(\)/);
  assert.match(playerUi, /onLocalActiveChange\(true\)/);
  assert.match(playerUi, /onLocalActiveChange\(false\)/);
  assert.match(playerUi, /Choose music folder/);
  assert.match(playerUi, /browser.*(?:autoplay|codec)/i);
  assert.doesNotMatch(playerUi, /fetch\(|XMLHttpRequest|sendBeacon|cdn[12]\.suno\.ai|\/api\/song/);
  assert.match(consoleUi, /Use Play inside the official Suno player/);
  assert.match(consoleUi, /<LocalContinuousRadio/);
  assert.match(consoleUi, /localController\.current\?\.next\(\)/);
  assert.match(consoleUi, /localController\.current\?\.toggle\(\)/);
  assert.match(house, /localRadioActiveRef\.current/);
  assert.match(house, /!\(house\.room === "radio" && localRadioActive\)/);
});

test("local radio can map real preset tracks while maintaining original five station profiles", () => {
  for (const id of ["solar","trucker","porch","desert","orbit"]) {
    const program = buildRadioProgram(catalog.albums, id);
    assert.ok(program.length);
    const picked = { name: program[0].title.replace(/^\d{1,3}[-.) ]+/, "") + ".mp3", size: 1000 };
    const matches = matchRadioFiles([picked], program);
    assert.ok(matches.length > 0, "Expected local title match for " + id);
  }
});
