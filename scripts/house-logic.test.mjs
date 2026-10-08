import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { collectStation, fmt, parseHash, runtime, safeEmbed, safeHttps } from "./house-logic.mjs";

test("catalog baseline stays 19 albums and 344 tracks", () => {
  const data = JSON.parse(readFileSync("public/catalog/albums.json", "utf8"));
  assert.equal(data.albums.length, 19);
  const tracks = data.albums.flatMap((a) => a.tracks);
  assert.equal(tracks.length, 344);
  assert.equal(new Set(data.albums.map((a) => a.id)).size, 19);
  for (const album of data.albums) {
    assert.ok(album.title);
    assert.ok(album.cover);
    for (const track of album.tracks) {
      assert.ok(track.title);
      assert.ok(track.sunoId);
      assert.ok(track.src.startsWith("https://"));
    }
  }
});

test("stations only use album titles and do not invent empty sets for known shelves", () => {
  const data = JSON.parse(readFileSync("public/catalog/albums.json", "utf8"));
  const funk = collectStation(data.albums, "funk");
  assert.ok(funk.some((t) => t.albumTitle.includes("Trunk Funk")));
  assert.ok(funk.some((t) => t.albumTitle.includes("Bap Science")));
  assert.equal(collectStation(data.albums, "all").length, 344);
  const hiphopish = collectStation(data.albums, "funk").every((t) => /funk|bap/i.test(t.albumTitle));
  assert.equal(hiphopish, true);
});

test("embed and https guards reject junk", () => {
  assert.equal(safeEmbed("not-an-id"), "");
  assert.match(safeEmbed("f3958d3d-24d1-4d45-bfd8-5181269dda4a"), /^https:\/\/suno.com\/embed\//);
  assert.equal(safeHttps("http://evil.test/a.mp3"), "");
  assert.equal(safeHttps("javascript:alert(1)"), "");
  assert.equal(fmt(65), "1:05");
  assert.equal(runtime([{ duration: 10 }, { duration: 5 }]), 15);
});

test("hash routes stay on known rooms", () => {
  assert.deepEqual(parseHash("#/album/trunk-funk/3"), { room: "album", albumId: "trunk-funk", track: "3" });
  assert.equal(parseHash("#/nope").room, "lobby");
  assert.equal(parseHash("").room, "lobby");
});
