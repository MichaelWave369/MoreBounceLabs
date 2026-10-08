import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = "dist-pages";
const base = "/MoreBounceLabs/";
const htmlFile = join(root, "index.html");
assert.ok(existsSync(htmlFile), "GitHub Pages build should contain root index.html");
const html = readFileSync(htmlFile, "utf8");
assert.match(html, /<div id="root"><\/div>/, "React mount must exist");
assert.match(html, /MoreBounceLabs/, "MoreBounceLabs identity should survive export");
assert.doesNotMatch(html, /MicTek House/i, "Legacy brand must not appear in published HTML");
assert.match(html, /\/MoreBounceLabs\/assets\//, "JS and CSS links must use the project base");
assert.doesNotMatch(html, /src=["']\/assets\//, "No root-relative JS paths");
assert.ok(existsSync(join(root, "catalog/albums.json")), "Catalog must be copied to Pages");
const data = JSON.parse(readFileSync(join(root, "catalog/albums.json"), "utf8"));
assert.ok(data.albums?.length >= 19, "The original 19 Suno albums must be preserved");
assert.ok(data.albums.reduce((n, a) => n + a.tracks.length, 0) >= 344, "The original 344 songs must be preserved");
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
assert.ok(js.includes("MoreBounceLabs"), "Bundled UI should use the new site identity");
assert.ok(js.includes("Update albums"), "Vault must expose the owner album update control");
assert.ok(js.includes("Sounds From the Mothership"), "SoundCloud archive releases must appear in the built Vault");
assert.ok(js.includes("Boga Beatz V.1"), "Oldest Boga Beatz archive must appear in the built Vault");
assert.ok(js.includes("Reflections"), "The 2022 Reflections release must appear in the built Vault");
assert.ok(js.includes("w.soundcloud.com/player/"), "Official SoundCloud widget URL must be bundled");
assert.ok(js.includes("The original record shelves"), "SoundCloud archive shelf must be visible in Vault");
assert.ok(js.includes("Radio Control Room"), "New MBL retro radio room must be bundled");
assert.ok(js.includes("Solar Bounce FM"), "Radio station controls must be bundled");
assert.ok(js.includes("mbl-radio-console.png"), "Radio backdrop must reference the approved static image");
assert.ok(js.includes("The music house hit a snag."), "React error boundary must avoid a blank app when embedded widgets fail");
assert.ok(js.includes("Restore MoreBounceLabs"), "Error boundary must expose a recovery action");
assert.ok(js.includes("Every record is a little universe."), "The Music Timeline must be included in the Pages JS");
assert.ok(js.includes("Timeline"), "Timeline room/navigation should appear in the static application");
assert.ok(js.includes("Foundations & Boga Beatz"), "The historical 2023 era must be present");
assert.ok(js.includes("Backspin"), "The Decks room must contain Backspin integration");
assert.ok(js.includes("backspin96-decks-art.png"), "The Decks UI must request the checked-in original poster filename");
assert.ok(existsSync(join(root, "backspin96-decks-art.png")), "The actual Backspin poster must be copied to the Pages output");
assert.ok(js.includes("Backspin '96 · The Vinyl World"), "The retro Backspin performance mode must be present");
const backspinManifest = join(root, "backspin96/mbl-stage.json");
if (existsSync(backspinManifest)) {
  const manifest = JSON.parse(readFileSync(backspinManifest, "utf8"));
  assert.equal(manifest.overlayBridgeVersion, 1, "Staged source must include the Backspin overlay control adapter");
  assert.ok(readFileSync(join(root, "backspin96/app.js"), "utf8").includes("window.__MBL_BACKSPIN"),
    "Staged Backspin must expose its real scratch controller");
}
const backspinStaged = existsSync("vendor/backspin96-source.zip");
if (backspinStaged) {
  const staged = join(root, "backspin96");
  for (const path of ["index.html", "app.js", "audio/engine.js", "audio/backspin-processor.js", "library/suno-crate-bridge.js", "LICENSE", "mbl-stage.json"]) {
    assert.ok(existsSync(join(staged, path)), `Backspin runtime missing ${path} from Pages output`);
  }
  const manifest = JSON.parse(readFileSync(join(staged, "mbl-stage.json"), "utf8"));
  assert.equal(manifest.engine, "Backspin96");
  assert.equal(manifest.sourceVersion, "1.5.0");
} else {
  assert.ok(!existsSync(join(root, "backspin96/mbl-stage.json")), "Cannot advertise an unverified Backspin booth");
}
assert.ok(js.includes("The Desk"), "Desk must contain the new image-first HQ");
assert.ok(js.includes("Agent Mix Studio"), "A public agent/human mix exchange must be present in Desk");
assert.ok(existsSync(join(root, "agent/mix-schema-v1.json")), "Public agent Mix Exchange schema must ship with Pages");
assert.ok(existsSync(join(root, "agent/mix-manifest-v1.json")), "Public agent discovery manifest must ship with Pages");
assert.ok(existsSync(join(root, "llms.txt")), "Agent discovery llms.txt must be in project root");
assert.ok(existsSync(join(root, "agent/mix-changelog.txt")), "Desk version history must be available publicly");
const mixManifest = JSON.parse(readFileSync(join(root, "agent/mix-manifest-v1.json"), "utf8"));
assert.equal(mixManifest.format, "mbl-mix-v1", "Agent manifest must retain the supported mix format");
assert.equal(mixManifest.validation.requiresHumanApproval, true, "Agent manifest must preserve human playback approval");
assert.ok(js.includes("Play approved mix"), "Imported mixes must require explicit user approval before playback");
assert.ok(js.includes("desk-room-bg.png"), "Desk must request its approved original background");
if (existsSync("public/desk/desk-room-bg.png")) {
  assert.ok(existsSync(join(root, "desk/desk-room-bg.png")), "The original Desk image must reach Pages output");
}
assert.ok(js.includes("Infinity Lab"), "Lab must have the dedicated InfinityLens-only heading");
assert.ok(js.includes("InfinityLens369"), "Visual Lab should contain InfinityLens guest stage");
assert.ok(js.includes("mbl-infinitylens-v1"), "Visual Lab should include the versioned visual bridge");
assert.ok(js.includes("cosmic-drift"), "Guest scene controls must appear in MBL build");
assert.ok(js.includes("https://michaelwave369.github.io/infinitylens369/"), "Guest stage should point to the maintained original");
assert.ok(!js.includes("MicTek House"), "Legacy site name must not remain in the player UI");
assert.ok(js.includes("/MoreBounceLabs/"), "Built app must know project base");
console.log("PASS GitHub Pages static build: index, hashed assets, Tailwind layout, scoped URLs, at least 19 Suno albums and 344 original tracks.");
