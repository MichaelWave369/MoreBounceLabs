#!/usr/bin/env node
/** An exact-fidelity gate for the user's original Parallax Backspin '96 poster. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const source = "public/backspin96-poster.png";
const output = "dist-pages/backspin96-poster.png";
const HASH = "0f2764175607d944ac3be89e62ba114953d3bb9b7307e5e20be0421806d47bcf";
if (!existsSync(source)) {
  console.warn("BACKSPIN POSTER PENDING: upload the original artwork as public/backspin96-poster.png before merge.");
  process.exit(0);
}
const check = (path) => {
  const content = readFileSync(path);
  assert.equal(createHash("sha256").update(content).digest("hex"), HASH,
    `Backspin poster at ${path} differs from the exact artwork provided by the artist`);
  assert.equal(content.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(content.readUInt32BE(16), 1055);
  assert.equal(content.readUInt32BE(20), 1491);
};
check(source);
if (existsSync("dist-pages")) {
  assert.ok(existsSync(output), "Backspin approved poster missing from GitHub Pages output");
  check(output);
}
console.log("PASS: Original 1055×1491 Backspin poster preserved without any modifications.");
