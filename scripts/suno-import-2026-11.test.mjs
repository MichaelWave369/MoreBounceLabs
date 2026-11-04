import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { playbackSource } from "./house-logic.mjs";
const data = JSON.parse(readFileSync("public/catalog/albums.json", "utf8"));
const albums = data.albums;
const imported = [
  ["Bonsai Bap", "7f87f5ba-2ab0-491a-ad3f-4e170f717c5d", 18],
  ["Head Nod Proof", "c870d9f2-0b2c-4eab-81cc-bb0f22f571e1", 18],
  ["Break The Matrix - The Soundtrack", "cfd63bd5-7908-4d32-abdf-3e965e4fef7a", 18],
  ["G-Funktendo", "ab637c8e-fa49-4f74-97d2-25419cfa58b8", 12],
  ["Visions of the Wax", "1cdfc5f2-d4e9-42b6-ab85-fd4d07b34077", 21],
  ["RTKO - Rip The Knob Off", "5ea13883-b3ec-4da2-9c78-52805a9c7a06", 24],
  ["I-5 Nights", "bbea8145-0b71-4a2c-b9c1-019e7b4fe6f8", 21]
];
const originalAlbumCounts = {
  "trunk-funk":54,
  "the-ocean-has-an-alibi":12,
  "the-azure-inheritance":15,
  "anti-gravity-protocol":9,
  "lucid-altitude":9,
  "cruising-altitude":9,
  "nine-2tha-0":12,
  "the-dreaming-tide":12,
  "architectural-intuition":12,
  "neon-afterglow-society":12,
  "glitch-remix":12,
  "funktendo-369":12,
  "parallax-nx-98971-funk-mode-engaged":7,
  "contact-integration-cycle":12,
  "cruise-departure-cycle":24,
  "departure-cruise-cycle":12,
  "parallax-nx-98971":7,
  "memetendo-5000":42,
  "bap-science-fundamentals":60
};

test("public album audit adds exactly seven releases and 132 track placements", () => {
  assert.equal(albums.length, 26);
  assert.equal(albums.reduce((sum, album) => sum + album.tracks.length, 0), 476);
  assert.deepEqual(albums.slice(0, 7).map(a => a.title), imported.map(row => row[0]));
  assert.equal(new Set(albums.map(a => a.id)).size, 26);
  assert.equal(new Set(albums.map(a => a.suno)).size, 26);
  assert.equal(imported.reduce((sum, row) => sum + row[2], 0), 132);
});

test("each imported release has genuine Suno UUIDs, official art, and official embed playback", () => {
  const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
  for (const [title, id, count] of imported) {
    const album = albums.find(x => x.suno === "https://suno.com/album/" + id);
    assert.ok(album, "Release missing: " + title);
    assert.equal(album.title, title);
    assert.equal(album.tracks.length, count);
    assert.match(album.cover, /^https:\/\/cdn[12]\.suno\.ai\//);
    assert.equal(album.artist, "Mikey More Bounce");
    assert.equal(album.year, "2026");
    assert.equal(album.id, "suno-" + id);
    assert.equal(new Set(album.tracks.map(t => t.sunoId)).size, count);
    for (const track of album.tracks) {
      assert.ok(track.title?.trim(), "Missing real title: " + album.title);
      assert.match(track.sunoId, uuid);
      assert.equal(track.src, undefined, "No invented stream URL");
      assert.equal(playbackSource(track).kind, "embed");
    }
  }
});

test("all original 19 releases are preserved with their historical track placements", () => {
  assert.equal(Object.keys(originalAlbumCounts).length, 19);
  for (const [id, count] of Object.entries(originalAlbumCounts)) {
    const album = albums.find(x => x.id === id);
    assert.ok(album, "Original album removed: " + id);
    assert.equal(album.tracks.length, count, "Original album track count changed: " + id);
  }
  assert.equal(Object.values(originalAlbumCounts).reduce((sum, count) => sum + count, 0), 344);
});

test("selected artist titles and ending songs match verified public album listing", () => {
  assert.equal(albums[0].tracks[0].title, "Shaolin SP-1200");
  assert.equal(albums[0].tracks[11].title, "Wandamian Krusificplate");
  assert.equal(albums[0].tracks.at(-1).title, "Garden Palace");
  assert.equal(albums[1].tracks[0].title, "01-Neck Insurance");
  assert.equal(albums[2].tracks[0].title, "01-Wake Up Runner");
  assert.equal(albums[3].tracks[0].title, "West Coast Wood Man");
  assert.equal(albums[4].tracks[0].title, "2 AM");
  assert.equal(albums[5].tracks[0].title, "API Key");
  assert.equal(albums[6].tracks[0].title, "Room for Me");
});
