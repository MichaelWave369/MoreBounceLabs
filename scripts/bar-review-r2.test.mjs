import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MAX_BAR_REVIEW_NOTE, validateBarReview } from "../src/lib/dojoRecordings.ts";

const sampler = readFileSync("src/components/BarReviewSampler.tsx", "utf8");
const store = readFileSync("src/lib/dojoRecordings.ts", "utf8");
const existingTests = readFileSync("scripts/bar-sampler.test.mjs", "utf8");

test("review payload is private, bounded and rejects invalid values", () => {
  assert.equal(MAX_BAR_REVIEW_NOTE, 600);
  const review = { note: "More breath after the setup", rating: 4, keeper: true };
  assert.deepEqual(validateBarReview(review), review);
  assert.deepEqual(validateBarReview({ note: "", rating: 0, keeper: false }),
    { note: "", rating: 0, keeper: false });
  assert.throws(() => validateBarReview({ note: "x".repeat(601), rating: 4, keeper: false }), /review/i);
  assert.throws(() => validateBarReview({ note: "ok", rating: 6, keeper: true }), /review/i);
  assert.throws(() => validateBarReview({ note: "ok", rating: -1, keeper: false }), /review/i);
  assert.throws(() => validateBarReview({ note: "ok", rating: 1.5, keeper: false }), /review/i);
  assert.throws(() => validateBarReview({ note: 123, rating: 3, keeper: false }), /review/i);
  assert.throws(() => validateBarReview({ note: "", rating: 4, keeper: "yes" }), /review/i);
});

test("saved review updates only one page; keeper promotion is atomic", () => {
  assert.match(store, /export async function saveBarReview\(pageId: string, sampleId: string, review: BarReview\)/);
  assert.match(store, /db\.transaction\(BAR_STORE, "readwrite"\)/);
  assert.match(store, /store\.index\("pageId"\)\.getAll\(pageId\)/);
  assert.match(store, /existing\.find\(item => item\.id === sampleId\)/);
  assert.match(store, /if \(validated\.keeper\)/);
  assert.match(store, /if \(item\.id !== sampleId && item\.keeper\) store\.put\(\{ \.\.\.item, keeper: false \}\)/);
  assert.match(store, /store\.put\(\{\s*\.\.\.target,\s*reviewNote: validated\.note,\s*rating: validated\.rating,\s*keeper: validated\.keeper/s);
  assert.match(store, /if \(!target\) \{\s*issue = new Error/);
  assert.match(store, /tx\.abort\(\)/);
  assert.match(store, /const DB_VERSION = 2/);
  assert.match(store, /const STORE = "clips"/);
  assert.match(store, /const BAR_STORE = "bar-samples"/);
  assert.ok(existingTests.includes('bar-samples'), "Existing bar sampler regression suite must remain.");
});

test("review supports old bar takes that lack review fields", () => {
  assert.match(sampler, /sample\.reviewNote \|\| ""/);
  assert.match(sampler, /sample\.rating \|\| 0/);
  assert.match(sampler, /Boolean\(sample\.keeper\)/);
  assert.match(sampler, /setSamples\(refreshed\)/);
  assert.match(sampler, /Save review/);
  assert.match(sampler, /Mark as keeper/);
  assert.match(sampler, /Your rating/);
  assert.match(sampler, /0–5|\/5/);
});

test("A/B comparison offers two separate takes and one switching audio player", () => {
  assert.match(sampler, /A\/B Bar Audition/);
  assert.match(sampler, /aria-label="A\/B comparison for bar deliveries"/);
  assert.match(sampler, /const selectedA = audioSamples\.find/);
  assert.match(sampler, /const selectedB = audioSamples\.find/);
  assert.match(sampler, /if \(id && id === compareB\) setCompareB\(""\)/);
  assert.match(sampler, /if \(id && id === compareA\) setCompareA\(""\)/);
  assert.match(sampler, /onClick=\{\(\) => listen\(selected\)\}/);
  assert.match(sampler, /\{preview && <audio controls autoPlay src=\{preview\.url\}/);
  assert.match(sampler, /no AI score/i);
});

test("review-sheet export contains text and user ratings, never audio blobs", () => {
  assert.match(sampler, /function exportReviewSheet\(\)/);
  assert.match(sampler, /Export review sheet/);
  assert.match(sampler, /item\.reviewNote/);
  assert.match(sampler, /item\.rating/);
  assert.match(sampler, /item\.keeper/);
  assert.match(sampler, /Audio stored locally/);
  assert.match(sampler, /Audio clips must be exported individually/);
  const exportFn = sampler.slice(sampler.indexOf("function exportReviewSheet()"),
    sampler.indexOf("async function copyBar("));
  assert.doesNotMatch(exportFn, /item\.audio\.arrayBuffer|item\.audio\.stream|FileReader|fetch\(/);
  assert.doesNotMatch(sampler, /XMLHttpRequest|sendBeacon|https:\/\/api\./);
});
