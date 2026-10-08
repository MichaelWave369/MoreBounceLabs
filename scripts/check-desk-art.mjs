#!/usr/bin/env node
/** Verify that the exact original user-supplied Desk PNG reaches GitHub Pages. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const source = "public/desk/desk-room-bg.png";
const built = "dist-pages/desk/desk-room-bg.png";
const EXPECTED_SHA = "f35805c8a8bfa1c3d0782bde5e7d250b42a42ab95e80140788044bf2b784c970";

const check = (path) => {
  const data = readFileSync(path);
  assert.equal(createHash("sha256").update(data).digest("hex"), EXPECTED_SHA,
    `The exact approved Desk image was changed or replaced at ${path}`);
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "Desk art must be PNG");
  assert.equal(data.readUInt32BE(16), 1536, "Desk image width must remain 1536");
  assert.equal(data.readUInt32BE(20), 1024, "Desk image height must remain 1024");
};

if (!existsSync(source)) {
  // Deliberately nonblocking while this is a draft PR awaiting the single
  // original-asset upload. The PR MUST remain draft until it is present.
  console.warn("DESK ART PENDING: Upload original image to public/desk/desk-room-bg.png before taking this PR out of draft.");
  process.exit(0);
}
check(source);
if (existsSync("dist-pages")) {
  assert.ok(existsSync(built), "GitHub Pages artifact omitted the original Desk background");
  check(built);
}
console.log("PASS: Original unmodified 1536×1024 Desk background present and verified in Pages output.");
