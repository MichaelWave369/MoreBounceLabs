import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { decodeMix, encodeMix, queueMix, validateMix } from "../src/lib/mixExchange.ts";

const original = JSON.parse(readFileSync("tests/fixtures/mr-fl-golden-hour-to-funk-peak-and-back.json", "utf8"));
const catalog = JSON.parse(readFileSync("public/catalog/albums.json", "utf8")).albums;
const expected = [
  ["the-azure-inheritance", 0, "Portofino at Seven", "cut"],
  ["the-ocean-has-an-alibi", 4, "Dreamy Drift", "fade"],
  ["lucid-altitude", 3, "4. Tunnel Bloom", "blend"],
  ["anti-gravity-protocol", 0, "Onramp", "fade"],
  ["neon-afterglow-society", 0, "Disco Mirage", "cut"],
  ["funktendo-369", 3, "Funk Somethin' Will Ya!", "blend"],
  ["funktendo-369", 10, "OverFunk", "cut"],
  ["architectural-intuition", 5, "6. Signal Orchard", "fade"],
  ["the-ocean-has-an-alibi", 8, "Smooth Landing", "blend"],
  ["the-azure-inheritance", 13, "Last Light on the Côte d’Azur", "fade"],
];

test("Mr. FL's original exported Golden Hour set remains a valid ten-track real catalog mix", () => {
  assert.equal(original.format, "mbl-mix-v1");
  assert.equal(original.name, "Golden Hour to Funk Peak and Back");
  assert.deepEqual(original.creator, { type: "agent", name: "Grok Bot" });
  assert.equal(original.tracks.length, 10);

  const review = validateMix(original, catalog);
  assert.equal(review.ok, true, JSON.stringify(review.errors));
  assert.deepEqual(review.errors, []);
  assert.deepEqual(review.warnings, []);
  assert.equal(review.queue.length, 10);
  expected.forEach(([id, index, title, transition], i) => {
    const item = original.tracks[i];
    assert.equal(item.albumId, id, "Wrong album at placement " + (i + 1));
    assert.equal(item.index, index, "Wrong song index at placement " + (i + 1));
    assert.equal(item.transition, transition, "Wrong creative transition at placement " + (i + 1));
    const album = catalog.find((a) => a.id === id);
    assert.equal(album?.tracks[index]?.title, title, "Track changed at placement " + (i + 1));
  });
});

test("the independent agent export round-trips through share links without autoplay permission", () => {
  const review = validateMix(original, catalog);
  const reopened = decodeMix(encodeMix(original), catalog);
  assert.deepEqual(reopened.mix, review.mix);
  assert.deepEqual(reopened.queue, queueMix(original, catalog));
  assert.ok(original.tracks.every(t => !("src" in t) && !("audio" in t)), "Mix must not bundle protected music");
  assert.ok(original.tracks.every(t => ["cut", "fade", "blend"].includes(t.transition)));
});

test("real fixture is rejected for a missing catalog album instead of partially playing", () => {
  const corrupted = structuredClone(original);
  corrupted.tracks[6].albumId = "not-an-album";
  const review = validateMix(corrupted, catalog);
  assert.equal(review.ok, false);
  assert.equal(review.errors[0]?.code, "album_missing");
  assert.equal(review.errors[0]?.trackIndex, 6);
  assert.equal(review.queue.length, 9);
  assert.throws(() => queueMix(corrupted, catalog), /missing catalog/);
});
