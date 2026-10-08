import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = "dist-pages";
const base = "/MoreBounceLabs/";
const htmlFile = join(root, "index.html");
assert.ok(existsSync(htmlFile), "GitHub Pages build should contain root index.html");
const html = readFileSync(htmlFile, "utf8");
assert.match(html, /<div id="root"><\/div>/, "React mount must exist");
assert.match(html, /MicTek House/, "Music house identity should survive export");
assert.match(html, /\/MoreBounceLabs\/assets\//, "JS and CSS links must use the project base");
assert.doesNotMatch(html, /src=["']\/assets\//, "No root-relative JS paths");
assert.ok(existsSync(join(root, "catalog/albums.json")), "Catalog must be copied to Pages");
const data = JSON.parse(readFileSync(join(root, "catalog/albums.json"), "utf8"));
assert.equal(data.albums?.length, 19, "All 19 albums must be preserved");
assert.equal(data.albums.reduce((n, a) => n + a.tracks.length, 0), 344, "All 344 songs must be preserved");
const assets = readdirSync(join(root, "assets"));
assert.ok(assets.some((name) => name.endsWith(".js")), "Bundled JS must exist");
assert.ok(assets.some((name) => name.endsWith(".css")), "Bundled CSS must exist");
const styles = assets.filter((name) => name.endsWith(".css")).map((name) => readFileSync(join(root, "assets", name), "utf8")).join("\n");
// The initial Pages export included only ~5.75 KB of Tailwind base CSS.
// That build passed despite missing every important layout utility, causing
// unstyled navigation and a hero image filling the entire browser.
for (const utility of [".max-w-6xl", ".grid", ".flex", ".rounded-3xl", ".bg-heat", ".text-mist"]) {
  assert.ok(styles.includes(utility), `GitHub Pages CSS is missing Tailwind utility ${utility}. Check @source paths in src/styles.css.`);
}
const js = assets.filter((name) => name.endsWith(".js")).map((name) => readFileSync(join(root, "assets", name), "utf8")).join("\n");
assert.ok(js.includes("catalog/albums.json"), "Built app must request its catalog");
assert.ok(js.includes("/MoreBounceLabs/"), "Built app must know project base");
console.log("PASS GitHub Pages static build: index, hashed assets, Tailwind layout utilities, scoped URLs, 19 albums, 344 tracks.");
