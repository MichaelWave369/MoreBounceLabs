import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseHash } from "./house-logic.mjs";
import {
  BOOK_KEY, MAX_BODY, MAX_PAGES, cleanSuggestions, emptyBook, lexicalUrl, mergeBooks,
  newPage, rhymeTarget, validateBook
} from "./writers-room.mjs";

const now = "2026-11-03T20:00:00.000Z";
function page(id, body = "first bar", title = "My first song") {
  return { ...newPage("freestyle", id, now), title, body };
}
const book = (...pages) => ({ version: 1, pages });

test("Writers Room routes as a real, shareable hash room", () => {
  assert.equal(parseHash("#/writers").room, "writers");
  assert.equal(parseHash("#/lounge").room, "desk");
  const app = readFileSync("src/components/HouseApp.tsx", "utf8");
  assert.match(app, /\["writers", "Writers"\]/);
  assert.match(app, /house\.room === "writers" && <WritersRoom \/>/);
  assert.match(app, /import \{ WritersRoom \}/);
  assert.match(app, /inLab=\{house\.room === "lab" \|\| house\.room === "desk" \|\| house\.room === "writers"\}/);
});

test("versioned book validation accepts artist lyrics and rejects malformed/oversized imports", () => {
  assert.deepEqual(validateBook(emptyBook()), book());
  assert.deepEqual(validateBook(book(page("abcdef-12", "A line\nB line"))).pages[0].body, "A line\nB line");
  assert.equal(BOOK_KEY, "mbl-writers-book-v1");
  assert.throws(() => validateBook({ version: 2, pages: [] }), /supported/);
  assert.throws(() => validateBook(book(page("bad", "yo"))), /invalid/);
  assert.throws(() => validateBook(book(page("abc123", "hi"), page("abc123", "different"))), /invalid/);
  assert.throws(() => validateBook(book({ ...page("abc123"), kind: "intruder" })), /invalid/);
  assert.throws(() => validateBook(book(page("abc123", "x".repeat(MAX_BODY + 1)))), /invalid/);
  assert.throws(() => validateBook(book(...Array.from({length: MAX_PAGES + 1}, (_, i) =>
    page("page_" + String(i).padStart(5, "0"))))), /supported/);
});

test("import merges unique pages, skips identical pages and preserves conflicts as copies", () => {
  const a = page("artist_100", "the original");
  const same = { ...a };
  const changed = { ...a, body: "the remix" };
  const added = page("artist_200", "new bars");
  const result = mergeBooks(book(a), book(same, added));
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.book.pages[0].body, "the original");
  const conflict = mergeBooks(book(a), book(changed), () => "copied_100");
  assert.equal(conflict.added, 1);
  assert.equal(conflict.book.pages[0].body, "the original");
  assert.equal(conflict.book.pages[1].id, "copied_100");
  assert.match(conflict.book.pages[1].title, /imported copy/);
  assert.equal(conflict.book.pages[1].body, "the remix");
  assert.throws(() => mergeBooks(book(a), book(changed), () => "artist_100"), /conflicts/);
});

test("lookup uses only supported, encoded user term queries", () => {
  assert.equal(rhymeTarget("hit the vibration!"), "vibration");
  assert.equal(rhymeTarget("my double-time flow"), "flow");
  assert.equal(rhymeTarget(""), "");
  const url = new URL(lexicalUrl("rel_rhy", " back & forth "));
  assert.equal(url.origin, "https://api.datamuse.com");
  assert.equal(url.pathname, "/words");
  assert.equal(url.searchParams.get("rel_rhy"), "back & forth");
  assert.equal(url.searchParams.get("max"), "32");
  assert.equal(new URL(lexicalUrl("ml", "mountain road")).searchParams.get("ml"), "mountain road");
  assert.throws(() => lexicalUrl("danger", "bar"), /Unsupported/);
  assert.throws(() => lexicalUrl("rel_nry", ""), /Enter/);
  assert.throws(() => lexicalUrl("rel_trg", "x".repeat(81)), /Enter/);
});

test("suggestions display plain bounded words and deduplicate results", () => {
  assert.deepEqual(cleanSuggestions([
    { word: "flow", numSyllables: 1 }, { word: "FLOW" }, { word: "<script>", numSyllables: 999 },
    { word: "" }, null, { foo: "bar" }
  ]), [{ word: "flow", syllables: 1 }, { word: "<script>", syllables: null }]);
  assert.throws(() => cleanSuggestions({ word: "not an array" }), /Unexpected/);
});

test("Writers Room keeps full lyric text off the network and offers explicit backups", () => {
  const ui = readFileSync("src/components/WritersRoom.tsx", "utf8");
  assert.match(ui, /window\.localStorage\.setItem\(BOOK_KEY/);
  assert.match(ui, /Export book/);
  assert.match(ui, /Import book/);
  assert.match(ui, /mergeBooks\(book, incoming\)/);
  assert.match(ui, /fetch\(lexicalUrl\(mode\.code, target\)/);
  assert.doesNotMatch(ui, /fetch\([^)]*page\.body/);
  assert.doesNotMatch(ui, /dangerouslySetInnerHTML/);
});
