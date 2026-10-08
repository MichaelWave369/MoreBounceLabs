import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { provider, profile, albums } = JSON.parse(readFileSync("src/data/soundcloud-albums.json", "utf8"));
const original = JSON.parse(readFileSync("public/catalog/albums.json", "utf8"));

test("ten actual public SoundCloud releases have unique verified album links", () => {
  assert.equal(provider, "soundcloud");
  assert.equal(profile, "https://soundcloud.com/microneesia/albums");
  assert.equal(albums.length, 10);
  assert.equal(new Set(albums.map((a) => a.id)).size, 10);
  assert.equal(new Set(albums.map((a) => a.url)).size, 10);
  assert.equal(albums.reduce((total, a) => total + a.trackCount, 0), 107);
  for (const album of albums) {
    assert.match(album.id, /^sc-[a-z0-9-]+$/);
    assert.ok(album.title.length > 2);
    assert.equal(album.artist, "MicTek");
    assert.ok(album.year >= 2023 && album.year <= 2026);
    assert.ok(album.trackCount > 0);
    const url = new URL(album.url);
    assert.equal(url.origin, "https://soundcloud.com");
    assert.match(url.pathname, /^\/microneesia\/sets\/[a-z0-9-]+$/);
    const cover = new URL(album.cover);
    assert.equal(cover.origin, "https://i1.sndcdn.com");
    assert.match(cover.pathname, /^\/artworks-[A-Za-z0-9-]+-t500x500\.jpg$/);
  }
});

test("the SoundCloud shelf supplements, not mutates, the original Suno catalog", () => {
  assert.equal(original.albums.length, 19);
  assert.equal(original.albums.reduce((total, a) => total + a.tracks.length, 0), 344);
  assert.ok(albums.every((a) => !original.albums.some((old) => old.id === a.id)));
});

test("SoundCloud uses only the official widget, not scraped streams", () => {
  const source = readFileSync("src/components/SoundCloudShelf.tsx", "utf8");
  const logic = readFileSync("src/lib/soundcloud.ts", "utf8");
  assert.match(logic, /https:\/\/w\.soundcloud\.com\/player\/\?/);
  assert.match(source, /https:\/\/w\.soundcloud\.com\/player\/api\.js/);
  assert.match(source, /e\.FINISH/);
  assert.doesNotMatch(source, /stream_url|download_url|client_secret|client_id/);
  assert.doesNotMatch(logic, /stream_url|download_url|client_secret|client_id/);
});
