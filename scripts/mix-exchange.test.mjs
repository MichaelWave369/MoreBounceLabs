import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateMix, encodeMix, decodeMix, newMixFromQueue, queueMix, mixShareUrl } from "../src/lib/mixExchange.ts";

const catalog = JSON.parse(readFileSync("public/catalog/albums.json", "utf8")).albums;
const items = [
  { albumId: catalog[0].id, index: 0 },
  { albumId: catalog[1].id, index: 1 },
  { albumId: catalog[0].id, index: 2 },
];
test("human and agent sets are transport-neutral, catalog-validated and explicitly playable", () => {
  const mix = newMixFromQueue(items, "Groove Through the Multiverse", "Mr. FL", "agent", catalog);
  assert.equal(mix.format, "mbl-mix-v1");
  assert.deepEqual(queueMix(mix, catalog), items);
  assert.equal(mix.creator.type, "agent");
  assert.equal(mix.tracks.length, 3);
  const withNotes = { ...mix, tracks: [{ ...mix.tracks[0], transition: "blend", note: "Build energy" }, ...mix.tracks.slice(1)] };
  assert.equal(validateMix(withNotes, catalog).mix.tracks[0].transition, "blend");
});

test("share links preserve unicode and do not autoplay or write to the repository", () => {
  const mix = newMixFromQueue(items, "Γειά 🎧", "DJ・Larrina", "human", catalog);
  const encoded = encodeMix(mix);
  assert.deepEqual(decodeMix(encoded, catalog).mix, mix);
  const shared = new URL(mixShareUrl(mix, "https://michaelwave369.github.io/MoreBounceLabs/#/radio"));
  assert.equal(shared.hash, "#/desk");
  assert.equal(decodeMix(shared.searchParams.get("mix"), catalog).mix.name, mix.name);
  assert.ok(!shared.href.includes("https://suno.com/embed"), "Audio streams cannot be packaged in a mix URL");
});

test("import requires review when catalog references are missing", () => {
  const mix = newMixFromQueue(items, "Field Set", "FL", "agent", catalog);
  mix.tracks[1].albumId = "not-an-album";
  const review = validateMix(mix, catalog);
  assert.equal(review.missing.length, 1);
  assert.equal(review.queue.length, 2);
  assert.throws(() => queueMix(mix, catalog), /missing catalog/);
});

test("reject malicious, malformed or excessive shared JSON safely", () => {
  const mix = newMixFromQueue(items, "Valid", "FL", "agent", catalog);
  assert.throws(() => validateMix({ ...mix, tracks: [] }, catalog), /1–40/);
  assert.throws(() => validateMix({ ...mix, tracks: Array(41).fill(mix.tracks[0]) }, catalog), /1–40/);
  assert.throws(() => validateMix({ ...mix, tracks: [{ ...mix.tracks[0], transition: "<script>" }] }, catalog), /Transition/);
  assert.throws(() => validateMix({ ...mix, creator: { type: "administrator", name: "bad" } }, catalog), /Creator type/);
  assert.throws(() => validateMix({ ...mix, tracks: [{ ...mix.tracks[0], index: -1 }] }, catalog), /index/);
  assert.throws(() => decodeMix("!unsafe!", catalog), /Invalid mix share/);
  assert.throws(() => decodeMix("A".repeat(30000), catalog), /Invalid mix share/);
  const oversized = { ...mix, description: "z".repeat(900) };
  assert.throws(() => validateMix(oversized, catalog), /Description/);
});

test("Desk exposes mix import/export and preserves the human playback gate", () => {
  const desk = readFileSync("src/components/FieldDesk.tsx", "utf8");
  const ui = readFileSync("src/components/AgentMixStudio.tsx", "utf8");
  assert.match(desk, /<AgentMixStudio albums=\{albums\} onPlay=\{onPlay\}/);
  assert.match(ui, /Mix Exchange v1/);
  assert.match(ui, /review\.missing\.length === 0/);
  assert.match(ui, /onPlay\(queueMix\(selected, albums\)\)/);
  assert.match(ui, /Play approved mix/);
  assert.doesNotMatch(ui, /eval\(|executeScript|fetch\(.*suno|apiKey|client_secret/);
});

test("field fixes retain persistent Backspin performance protection and an unobstructed Lab", () => {
  const decks = readFileSync("src/components/BackspinDecks.tsx", "utf8");
  const house = readFileSync("src/components/HouseApp.tsx", "utf8");
  assert.match(decks, /Performance protection/);
  assert.match(decks, /Visual pressure/);
  assert.match(decks, /Vault tracks from Suno\/SoundCloud cannot be imported directly/);
  assert.match(house, /player-safe-embed-lab/);
  assert.match(house, /inLab=\{house\.room === "lab"\}/);
  assert.match(house, /Suno owns playback inside this official widget/);
});
