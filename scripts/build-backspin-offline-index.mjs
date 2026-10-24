import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Generate an exact, same-origin list after Vite hashes the real build assets.
 * This is an app-resource cache list, NOT an audio library or track downloader.
 */
const root = "dist-pages";
const base = "/MoreBounceLabs/";
const files = [
  "backspin.html", "backspin96.webmanifest", "backspin96-sw.js",
  "backspin96-icon.svg", "backspin96-icon-192.png", "backspin96-icon-512.png",
  "backspin96-decks-art.png",
];
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const item of readdirSync(dir).sort()) {
    const full = join(dir, item);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(relative(root, full).split(sep).join("/"));
  }
}
walk(join(root, "assets"));
walk(join(root, "backspin96"));
const stagePath = join(root, "backspin96", "mbl-stage.json");
const runtimeReady = existsSync(stagePath);
const stage = runtimeReady ? JSON.parse(readFileSync(stagePath, "utf8")) : null;
if (runtimeReady) {
  assert.equal(stage.engine, "Backspin96");
  assert.equal(stage.sourceVersion, "1.5.0");
}
const list = [...new Set(files)].sort();
for (const name of list) {
  assert.ok(!name.includes("..") && !name.startsWith("/") && existsSync(join(root, name)),
    "Offline asset not found: " + name);
}
writeFileSync(join(root, "backspin96-offline-index.json"), JSON.stringify({
  format: "backspin96-offline-v1",
  runtimeReady,
  sourceSHA256: stage?.sourceSHA256 ?? null,
  files: list.map((path) => base + path),
}, null, 2) + "\n");
console.log("BackSpin96 offline index: " + list.length + " local assets; source verified=" + runtimeReady);
