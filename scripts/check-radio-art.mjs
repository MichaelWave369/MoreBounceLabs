#!/usr/bin/env node
/**
 * The generated original artwork is provided separately as an exact binary.
 * Before publishing this PR, commit it to the expected public asset path.
 * When present, both content hash and PNG dimensions must match the approved art.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const path = "public/radio/mbl-radio-console.png";
const expected = "89af9a5564f5bb46a5e18048f4a8cef6aff41114cd297ae8199e397934867fb7";
if (!existsSync(path)) {
  console.warn("RADIO ART PENDING: Add the exact approved mbl-radio-console.png to public/radio/ before shipping the visual.");
  process.exit(0);
}
const bytes = readFileSync(path);
const hash = createHash("sha256").update(bytes).digest("hex");
assert.equal(hash, expected, "Radio artwork does not match the user's approved image; don't substitute or regenerate it.");
assert.equal(bytes.subarray(1, 4).toString(), "PNG");
assert.equal(bytes.readUInt32BE(16), 1448);
assert.equal(bytes.readUInt32BE(20), 1086);
const dist = join("dist-pages", "radio", "mbl-radio-console.png");
if (existsSync("dist-pages")) {
  assert.ok(existsSync(dist), "Static GitHub Pages build must include radio artwork");
  assert.equal(createHash("sha256").update(readFileSync(dist)).digest("hex"), expected, "Pages art differs from approved source");
}
console.log("PASS MBL Radio: exact approved 1448×1086 artwork preserved in public and Pages output.");
