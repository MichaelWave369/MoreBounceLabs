import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { analyzeVerse } from "./writers-flow.mjs";

const vault = readFileSync("src/components/HouseApp.tsx", "utf8");
const dojo = readFileSync("src/components/FreestyleDojo.tsx", "utf8");
const sampler = readFileSync("src/components/BarReviewSampler.tsx", "utf8");
const db = readFileSync("src/lib/dojoRecordings.ts", "utf8");

test("Vault renders the complete Suno catalog before the separate SoundCloud archive", () => {
  const start = vault.indexOf("function Vault(");
  const end = vault.indexOf("\nfunction Album", start);
  assert.ok(start >= 0 && end > start);
  const component = vault.slice(start, end);
  const suno = component.indexOf('>Suno releases</h2>');
  const soundcloud = component.indexOf("<SoundCloudShelf");
  assert.ok(suno >= 0, "Suno section must exist");
  assert.ok(soundcloud > suno, "SoundCloud shelf must appear AFTER Suno section");
  assert.equal(component.match(/<SoundCloudShelf/g)?.length, 1);
  assert.match(component, /sort === "listed"|value="listed"/);
  assert.match(component, /albums\.map\(\(album\)/);
});

test("Sampler is inside the Dojo and tied to the selected lyric page", () => {
  assert.match(dojo, /<BarReviewSampler key=\{page\?\.id \|\| "no-page"\} page=\{page\}/);
  assert.match(sampler, /analyzeVerse\(page\?\.body \|\| ""\)/);
  assert.match(sampler, /setBarText\(row\.text\.slice\(0, MAX_BAR_TEXT\)\)/);
  const rows = analyzeVerse("[Verse]\nI wanna be free\n16. The head nod is me\n# footnote");
  assert.deepEqual(rows.rows.map(r => r.text), ["I wanna be free", "The head nod is me"]);
});

test("The bar sampler captures permissioned microphone only and cannot upload lyrics or audio", () => {
  assert.match(sampler, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(sampler, /new MediaRecorder\(stream/);
  assert.match(sampler, /BAR_AUDIO_SECONDS \* 1000/);
  assert.match(sampler, /setCapturing\(true\)/);
  assert.match(sampler, /Save written bar/);
  assert.match(sampler, /Record 12-second take/);
  assert.match(sampler, /Try again/);
  assert.match(sampler, /URL\.revokeObjectURL/);
  assert.match(sampler, /stream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
  assert.doesNotMatch(sampler, /fetch\(|XMLHttpRequest|sendBeacon|SunoPlayer/);
});

test("The new IndexedDB store is upgraded non-destructively from existing full Dojo clips", () => {
  assert.match(db, /const DB_NAME = "mbl-freestyle-dojo-v1"/);
  assert.match(db, /const DB_VERSION = 2/);
  assert.match(db, /const STORE = "clips"/);
  assert.match(db, /const BAR_STORE = "bar-samples"/);
  assert.match(db, /if \(!db\.objectStoreNames\.contains\(STORE\)\)/);
  assert.match(db, /if \(!db\.objectStoreNames\.contains\(BAR_STORE\)\)/);
  assert.match(db, /MAX_BAR_SAMPLES_PER_PAGE = 24/);
  assert.match(db, /MAX_BAR_AUDIO_BYTES = 8 \* 1024 \* 1024/);
  assert.match(db, /BAR_AUDIO_SECONDS = 12/);
  assert.match(db, /index\("pageId"\)\.getAll\(pageId\)/);
  assert.match(db, /export async function saveBarSample/);
  assert.match(db, /export async function deleteBarSample/);
  assert.match(sampler, /Freestyle Book|Freestyle Book page/);
});

test("The bar-sample JSON boundary is distinct from the Freestyle Book text backup", () => {
  const book = readFileSync("src/components/WritersRoom.tsx", "utf8");
  assert.match(book, /JSON\.stringify\(validateBook\(book\)/);
  assert.match(sampler, /NOT included in your lyric-book JSON backup/);
  assert.match(sampler, /Export important takes individually/);
  assert.match(sampler, /saveBarSample\(sample\)/);
  assert.match(sampler, /download\(sample\)/);
});
