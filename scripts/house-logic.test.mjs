import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { collectStation, fmt, parseHash, playbackSource, reorderQueue, runtime, safeEmbed, safeHttps, sharedTrackIndex } from "./house-logic.mjs";

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


test("queue reordering preserves the playing item in both directions", () => {
  const queue = ["a", "b", "c", "d"];
  const forward = reorderQueue(queue, 1, 1, 1);
  assert.deepEqual(forward, { queue: ["a", "c", "b", "d"], cursor: 2 });
  assert.equal(forward.queue[forward.cursor], "b");

  const acrossFromBefore = reorderQueue(queue, 2, 1, 1);
  assert.deepEqual(acrossFromBefore, { queue: ["a", "c", "b", "d"], cursor: 1 });
  assert.equal(acrossFromBefore.queue[acrossFromBefore.cursor], "c");

  const acrossFromAfter = reorderQueue(queue, 1, 2, -1);
  assert.deepEqual(acrossFromAfter, { queue: ["a", "c", "b", "d"], cursor: 2 });
  assert.equal(acrossFromAfter.queue[acrossFromAfter.cursor], "b");

  const backward = reorderQueue(queue, 2, 2, -1);
  assert.deepEqual(backward, { queue: ["a", "c", "b", "d"], cursor: 1 });
  assert.equal(backward.queue[backward.cursor], "c");
  assert.deepEqual(queue, ["a", "b", "c", "d"], "original queue remains unchanged");
});

test("queue reordering rejects invalid indices without modifying playback", () => {
  const queue = ["a", "b"];
  assert.deepEqual(reorderQueue(queue, 0, -1, 1), { queue, cursor: 0 });
  assert.deepEqual(reorderQueue(queue, 0, 0, -1), { queue, cursor: 0 });
  assert.deepEqual(reorderQueue(queue, 1, 1, 1), { queue, cursor: 1 });
  assert.deepEqual(reorderQueue(queue, 0, 0, 0), { queue, cursor: 0 });
});


test("share links resolve the correct zero-based track index", () => {
  assert.equal(sharedTrackIndex(parseHash("#/album/trunk-funk/0").track, 54), 0);
  assert.equal(sharedTrackIndex(parseHash("#/album/trunk-funk/3").track, 54), 3);
  assert.equal(sharedTrackIndex(parseHash("#/album/trunk-funk/53").track, 54), 53);
});

test("shared song links reject malformed and out-of-bounds indexes", () => {
  for (const position of ["", "-1", "1.5", "abc", "03", "54", "999999999999999999999", "NaN", " 2"]) {
    assert.equal(sharedTrackIndex(position, 54), null, `rejected ${position}`);
  }
  assert.equal(sharedTrackIndex("0", 0), null);
  assert.equal(sharedTrackIndex("0", -1), null);
});

test("Suno clip hosts open one official embedded player instead of duplicate native controls", () => {
  const songId = "f3958d3d-24d1-4d45-bfd8-5181269dda4a";
  assert.deepEqual(
    playbackSource({ sunoId: songId, src: `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a` }),
    { kind: "embed", url: `https://suno.com/embed/${songId}` },
  );
  assert.equal(playbackSource({ sunoId: songId }).kind, "embed");
  assert.equal(playbackSource({ sunoId: songId, src: "https://cdn1.suno.ai/audio.mp3" }).kind, "embed");
  assert.equal(playbackSource({ sunoId: songId, src: "https://cdn2.suno.ai/audio.mp3" }).kind, "embed");
  assert.equal(playbackSource({ src: "https://d2lwuy8qc234o3.cloudfront.net/1/clip/test.m4a" }).kind, "none");
});

test("artist-controlled HTTPS files use native audio, malformed sources remain unavailable", () => {
  const songId = "f3958d3d-24d1-4d45-bfd8-5181269dda4a";
  assert.deepEqual(
    playbackSource({ sunoId: songId, src: "https://media.example.org/music/song.mp3" }),
    { kind: "native", url: "https://media.example.org/music/song.mp3" },
  );
  assert.equal(playbackSource({ src: "http://example.org/song.mp3" }).kind, "none");
  assert.equal(playbackSource({ src: "javascript:alert(1)" }).kind, "none");
  assert.equal(playbackSource(undefined).kind, "none");
});

test("all existing Suno catalog tracks resolve to a single official embed", () => {
  const data = JSON.parse(readFileSync("public/catalog/albums.json", "utf8"));
  const tracks = data.albums.flatMap((a) => a.tracks);
  assert.equal(tracks.length, 344);
  assert.ok(tracks.every((t) => playbackSource(t).kind === "embed"));
});
