#!/usr/bin/env node
/**
 * Browser regression for blank-screen navigation when closing an embedded
 * SoundCloud player. Uses the *real* built MBL React bundle with a simulated
 * SoundCloud iframe/widget; does not request or play third-party audio.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve("dist-pages");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    const prefix = "/MoreBounceLabs/";
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404); res.end("Not Found"); return;
    }
    const decoded = decodeURIComponent(pathname.slice(prefix.length));
    // GitHub Pages serves directory/index.html for URLs ending in slash.
    // Our local regression server must match that behavior for Backspin.
    const rel = !decoded || decoded.endsWith("/") ? decoded + "index.html" : decoded;
    const absolute = resolve(root, rel);
    if (absolute !== root && !absolute.startsWith(root + sep)) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(absolute);
    res.writeHead(200, { "content-type": contentTypes[extname(absolute)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("Not Found");
  }
});

async function checkPage(page) {
  await page.getByRole("navigation", { name: "Rooms" }).waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await page.locator("#root").isVisible(), true, "React app root must stay visible");
  assert.equal(await page.locator("#root").getByText("The music house hit a snag.").count(), 0, "Error recovery should not have to activate");
}

async function main() {
  await new Promise((res, rej) => {
    server.once("error", rej);
    server.listen(0, "127.0.0.1", res);
  });
  const base = "http://127.0.0.1:" + server.address().port + "/MoreBounceLabs/";
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on("pageerror", (err) => errors.push(err.message));

    // No SoundCloud audio/network is used in this test. Mock the documented
    // Widget API, including unbind() throwing on removal. This previously
    // risked taking down the whole React tree during navigation.
    await page.route("https://w.soundcloud.com/player/api.js", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/javascript", body: `
        window.SC = {
          Widget: Object.assign(function(_iframe) {
            return {
              bind: function(event, cb) { if (event === "READY") setTimeout(cb, 0); },
              unbind: function() { throw Error("Simulated SoundCloud iframe already disposed"); },
              play: function() {},
              next: function() {},
              skip: function() {},
              getSounds: function(cb) { cb([]); },
              getCurrentSoundIndex: function(cb) { cb(0); },
              isPaused: function(cb) { cb(true); }
            };
          }, { Events: { READY: "READY", PLAY: "PLAY", PAUSE: "PAUSE", ERROR: "ERROR", FINISH: "FINISH" } })
        };
      ` });
    });
    await page.route("https://w.soundcloud.com/player/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/player/api.js") {
        // Playwright gives the most recently registered route precedence.
        // Leave the official widget API script to the exact mock above.
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body><button>Play</button><p>Mock SoundCloud player</p></body></html>" });
    });

    // Offline, deterministic InfinityLens stand-in for testing the MBL
    // visual bridge and verifying Lab has no second legacy renderer.
    // This does not claim to test the live WebGL engine.
    await page.route("https://michaelwave369.github.io/infinitylens369/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: `
        <!doctype html><html lang="en"><body>
          <p id="scene" role="status">MOCK INFINITYLENS LOADED</p>
          <script>
            const scene = document.getElementById("scene");
            const modes = ["cosmic-drift","kaleido-trip","tunnel-bloom","acid-melt","pixel-melt","black-hole-lens","mandelbrot","julia"];
            const palettes = ["aurora-phi","abyss-cyan","solar-ember","violet-gold-duality"];
            let mode = "cosmic-drift", palette = "aurora-phi";
            const ready = () => parent.postMessage({
              channel:"mbl-infinitylens-v1",kind:"ready",version:1,
              mode,palette,modes,palettes
            }, "*");
            window.addEventListener("message", (event) => {
              if (event.data?.channel !== "mbl-infinitylens-v1") return;
              if (event.data.kind === "hello") return ready();
              if (event.data.kind !== "command") return;
              if (event.data.action === "mode") mode = event.data.value;
              if (event.data.action === "palette") palette = event.data.value;
              scene.textContent = "MODE: " + mode + " PALETTE: " + palette;
              parent.postMessage({channel:"mbl-infinitylens-v1",kind:"ack",version:1,
                action:event.data.action,requestId:event.data.requestId}, "*");
              ready();
            });
            ready();
          </script>
        </body></html>` });
    });

    await page.goto(base + "#/vault", { waitUntil: "domcontentloaded" });
    await checkPage(page);
    const nav = page.getByRole("navigation", { name: "Rooms" });
    // The owner release-update panel must exist on the actual Pages UI.
    // Prevent accidental duplicate imports without touching public audio.
    await page.getByRole("button", { name: "Update albums" }).click();
    await page.getByRole("heading", { name: "Bring your next release home" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Auto new album ↗" }).waitFor({ state: "visible" });
    await page.getByRole("textbox", { name: "New album URL" }).fill("https://soundcloud.com/microneesia/sets/reflections");
    await page.getByRole("button", { name: "Auto new album ↗" }).click();
    await page.getByRole("alert").getByText("Already in the MBL catalog", { exact: false }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Manual details", exact: false }).click();
    await page.getByRole("textbox", { name: "Public album link" })
      .fill("https://soundcloud.com/microneesia/sets/reflections");
    await page.getByRole("spinbutton", { name: "Number of songs on this SoundCloud album" }).fill("9");
    await page.getByRole("button", { name: "Prepare update on GitHub" }).click();
    await page.getByRole("alert").getByText("already in the MBL catalog", { exact: false })
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Close album updater" }).click();
    await page.getByRole("button", { name: /Dimensional Shift/ }).first().click();
    await page.locator('iframe[title^="SoundCloud playlist:"]').waitFor({ state: "visible" });
    // Allow widget READY bindings to register before navigating away.
    await page.waitForTimeout(250);
    await nav.getByRole("button", { name: "Timeline" }).click();
    await page.getByRole("heading", { name: "Every record is a little universe." }).waitFor({ state: "visible" });
    await checkPage(page);
    assert.equal(await page.locator('iframe[title^="SoundCloud playlist:"]').count(), 0);

    // Original illustrated radio station buttons are now real, distinct
    // catalog-backed playlists. No SoundCloud/Suno audio is triggered without
    // explicit interaction with the official external player.
    await nav.getByRole("button", { name: "Radio" }).click();
    await page.getByRole("heading", { name: "Radio Control Room" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /Solar Bounce FM · 104\.3/ }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /Night Trucker · 92\.6/ }).click();
    await page.getByRole("heading", { name: "Night Trucker", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "AM band", exact: true }).click();
    await page.getByRole("heading", { name: "Deep Desert AM", exact: true }).waitFor({ state: "visible" });
    await page.getByText("On this frequency", { exact: false }).waitFor({ state: "visible" });
    await checkPage(page);

    await nav.getByRole("button", { name: "Vault" }).click();
    await page.getByRole("button", { name: /Reflections/ }).first().click();
    await page.locator('iframe[title^="SoundCloud playlist:"]').waitFor({ state: "visible" });
    await page.waitForTimeout(250);
    await nav.getByRole("button", { name: "Lobby" }).click();
    await page.getByText("Mikey More Bounce · Rotating album spotlight").waitFor({ state: "visible" });
    const spotlightBefore = await page.locator("main h1").first().textContent();
    await page.getByRole("button", { name: "Next album spotlight ↻" }).click();
    const spotlightAfter = await page.locator("main h1").first().textContent();
    assert.notEqual(spotlightBefore, spotlightAfter, "Lobby spotlight must change featured album in the hero");
    await checkPage(page);
    assert.equal(await page.locator('iframe[title^="SoundCloud playlist:"]').count(), 0);

    await nav.getByRole("button", { name: "Vault" }).click();
    await page.getByRole("button", { name: /Foundations/ }).first().click();
    await page.locator('iframe[title^="SoundCloud playlist:"]').waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Close player" }).click();
    await checkPage(page);
    assert.equal(await page.locator('iframe[title^="SoundCloud playlist:"]').count(), 0);

    // Route should also work after direct hash refresh.
    await page.goto(base + "#/timeline", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Every record is a little universe." }).waitFor({ state: "visible" });
    await checkPage(page);
    // Radio is a real room with usable controls even before the final art
    // is committed. The visual is a backdrop, not an inaccessible image map.
    await page.route("https://suno.com/embed/**", async (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Official media test placeholder</body></html>" }),
    );
    await nav.getByRole("button", { name: "Radio" }).click();
    await page.getByRole("heading", { name: "Radio Control Room" }).waitFor({ state: "visible" });
    await checkPage(page);
    await page.getByRole("button", { name: "Scan next", exact: true }).click();
    await page.getByRole("heading", { name: "Night Trucker" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Tune & Play" }).click();
    await page.getByText("Night Trucker").first().waitFor({ state: "visible" });
    await nav.getByRole("button", { name: "Vault" }).click();
    await checkPage(page);
    await page.getByRole("heading", { name: "Record vault" }).waitFor({ state: "visible" });
        // Full Backspin is loaded from the integrity-pinned archive. Verify the
    // original app module exposes the same-origin scratch adapter through
    // its iframe, and that poster mode can open the original advanced rig.
    await nav.getByRole("button", { name: "Decks" }).click();
    await page.getByRole("heading", { name: "Backspin '96 · The Vinyl World" }).waitFor({ state: "visible" });
    // Regression for the real user-reported bug: a filename mismatch between
    // uploaded artwork and the URL in the component silently showed a
    // placeholder. Browser must actually decode the original image.
    await page.locator("img.backspin-poster-art").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const art = document.querySelector("img.backspin-poster-art");
      return art?.complete && art.naturalWidth === 1055 && art.naturalHeight === 1491;
    }, undefined, { timeout: 10000 });
    assert.equal(await page.getByText("The original poster artwork is being staged.").count(), 0,
      "Backspin must display the poster, never the missing-art placeholder");
    const rig = page.locator('iframe[title="Original Backspin 96 DJ engine and advanced controls"]');
    await rig.waitFor({ state: "attached", timeout: 15000 });
    try {
      await page.waitForFunction(() => {
        const frame = document.querySelector('iframe[title="Original Backspin 96 DJ engine and advanced controls"]');
        try { return frame?.contentWindow?.__MBL_BACKSPIN?.version === 1; }
        catch { return false; }
      }, undefined, { timeout: 12000 });
    } catch (error) {
      const detail = await rig.evaluate((frame) => {
        try {
          return {
            src: frame.getAttribute("src"),
            frameUrl: frame.contentWindow?.location.href,
            readyState: frame.contentDocument?.readyState,
            audioStartPresent: Boolean(frame.contentDocument?.getElementById("startAudio")),
            adapterPresent: Boolean(frame.contentWindow?.__MBL_BACKSPIN),
          };
        } catch (e) { return { inaccessible: String(e) }; }
      });
      throw new Error("Backspin iframe adapter not ready: " + JSON.stringify(detail)
        + "; browser exceptions: " + errors.join(" | ") + "; " + String(error));
    }
    const bridge = await rig.evaluate((frame) => {
      const controller = frame.contentWindow.__MBL_BACKSPIN;
      return controller.snapshot();
    });
    assert.equal(bridge.ready, false, "Audio must require an explicit user gesture");
    assert.equal(bridge.A.loaded, false, "No bundled DJ audio may preload");
    assert.equal(bridge.B.loaded, false, "No bundled DJ audio may preload");
    await page.getByRole("button", { name: "Advanced rig & crates" }).click();
    await page.frameLocator('iframe[title="Original Backspin 96 DJ engine and advanced controls"]')
      .locator("#startAudio").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Hide advanced rig" }).click();
    await nav.getByRole("button", { name: "Vault" }).click();
    await checkPage(page);

    // Lab is exclusively the InfinityLens engine. The same hosted iframe
    // handles scene controls, and the old MBL VizCanvas must not be mounted.
    await nav.getByRole("button", { name: "Lab", exact: true }).click();
    await page.getByRole("heading", { name: "Infinity Lab", exact: true }).waitFor({ state: "visible" });
    const lensIframe = page.locator('iframe[title="InfinityLens369 interactive fractal visualizer"]');
    await lensIframe.waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await page.locator("main canvas").count(), 0, "No legacy VizCanvas is allowed in Lab");
    assert.equal(await page.getByRole("button", { name: "signature", exact: true }).count(), 0,
      "Legacy MBL visual modes must not be in Lab");
    assert.equal(await lensIframe.count(), 1, "Only one InfinityLens stage may render");
    await page.getByText("Visual bridge connected", { exact: false }).waitFor({ state: "visible", timeout: 10000 });
    await page.getByLabel("Fractal scene").selectOption("mandelbrot");
    await page.frameLocator('iframe[title="InfinityLens369 interactive fractal visualizer"]')
      .locator("#scene").getByText("MODE: mandelbrot", { exact: false }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Safe mode", exact: true }).click();
    await nav.getByRole("button", { name: "Vault" }).click();
    assert.equal(await lensIframe.count(), 0, "Navigating away must unload the Lab WebGL iframe");
    await checkPage(page);

    // New Desk: user-supplied background + all former Lounge queue actions.
    // Old Lounge deep links must canonicalize to the Desk rather than blank out.
    assert.equal(await nav.getByRole("button", { name: "Lounge", exact: true }).count(), 0,
      "Lounge tab should be removed");
    await nav.getByRole("button", { name: "Desk", exact: true }).click();
    await page.getByRole("heading", { name: "The Desk", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("heading", { name: "Now playing & queue" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Save queue" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Export catalog" }).waitFor({ state: "visible" });
    // Desk keeps its artwork and queue in Workbench mode; the Mix Studio
    // opens near the top on demand instead of hiding below the long desk.
    await page.getByRole("button", { name: "Open Agent Mix Studio" }).click();
    await page.getByRole("heading", { name: "Agent Mix Studio" }).waitFor({ state: "visible" });
    const api = await page.evaluate(() => {
      const safe = window.mblMix;
      if (!safe) return null;
      return safe.validate({
        format: "mbl-mix-v1", name: "QA", creator: { type: "agent", name: "QA Bot" },
        description: "A guarded agent sample",
        tracks: [{ albumId: "does-not-exist", index: 0, transition: "cut" }],
      });
    });
    assert.equal(api?.ok, false, "Read-only agent validator should reject missing catalog tracks");
    assert.equal(api?.errors[0]?.code, "album_missing", "Agent validation errors must be structured");
    assert.deepEqual(api?.queue, [], "Read-only API must never load or change the music queue");
    const invalidAlbumId = await page.evaluate(() => window.mblMix?.validate({
      format: "mbl-mix-v1", name: "Whitespace case", creator: { type: "agent", name: "QA Bot" },
      description: "Exact IDs only",
      tracks: [{ albumId: "trunk-funk ", index: 0, transition: "cut" }],
    }));
    assert.equal(invalidAlbumId?.ok, false);
    assert.equal(invalidAlbumId?.errors[0]?.code, "albumId_whitespace");
    assert.equal(invalidAlbumId?.errors[0]?.trackIndex, 0);
    assert.equal(invalidAlbumId?.errors[0]?.albumId, "trunk-funk ");
    assert.deepEqual(invalidAlbumId?.queue, [], "Whitespace error must not create a playable queue");
    const importButton = await page.getByRole("button", { name: "Review imported JSON" }).boundingBox();
    assert.ok(importButton && importButton.y + importButton.height <= 800,
      "Quick import action must be above the 800px fold after opening Mix Studio at 1280px width");
    await page.getByRole("button", { name: "Review imported JSON" }).click();
    await page.getByRole("status").getByText("Invalid JSON", { exact: false }).waitFor({ state: "visible" });
    await page.getByRole("textbox", { name: "Import agent-created mix JSON" }).fill(
      JSON.stringify({ format:"mbl-mix-v1", name:"Mr FL Field Set",
        creator:{type:"agent",name:"Mr. FL"}, description:"A collaborative test set",
        tracks:[{albumId:"missing-in-public-catalog",index:0,transition:"cut"}] })
    );
    await page.getByRole("button", { name: "Review imported JSON" }).click();
    await page.getByRole("alert").getByText("missing-in-public-catalog", { exact: false }).waitFor({ state: "visible" });
    assert.equal(await page.getByRole("button", { name: "Play approved mix" }).isDisabled(), true,
      "Untrusted mixes with missing tracks must never play without a valid catalog");
    // A second save of the same named set must overwrite the browser-local
    // chip, not create two identical-looking choices.
    await page.getByRole("textbox", { name: "Import agent-created mix JSON" }).fill(
      JSON.stringify({ format:"mbl-mix-v1", name:"R25 Browser Set",
        creator:{type:"agent",name:"QA Bot"}, description:"Valid real album song",
        tracks:[{albumId:"trunk-funk",index:0,transition:"cut"}] })
    );
    await page.getByRole("button", { name: "Review imported JSON" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /R25 Browser Set · QA Bot/ }).count(), 1,
      "Double saving should update the existing browser-local mix chip");
    await page.getByRole("status").getByText("Existing mix updated", {exact:false}).waitFor({state:"visible"});
    const agentIndex = await page.request.get(base + "agent/");
    assert.equal(agentIndex.status(), 200, "Agent directory must resolve on project GitHub Pages");
    assert.match(await agentIndex.text(), /Agent Mix Exchange v1/);
    const agentPointer = await page.request.get(base + ".well-known/mbl-agent.json");
    assert.equal(agentPointer.status(), 200);
    assert.equal((await agentPointer.json()).authority.playbackRequiresHumanApproval, true);
    await checkPage(page);

    // The approved artwork may still be awaiting the one-time owner upload
    // on a draft PR. Once present, require that the browser decoded it.
    const deskArtPath = resolve(root, "desk/desk-room-bg.png");
    const deskArtPresent = await stat(deskArtPath).then((info) => info.isFile(), () => false);
    if (deskArtPresent) {
      await page.locator("img.mbl-field-desk-art").waitFor({ state: "visible", timeout: 10000 });
      await page.waitForFunction(() => {
        const image = document.querySelector("img.mbl-field-desk-art");
        return image?.complete && image.naturalWidth === 1536 && image.naturalHeight === 1024;
      }, undefined, { timeout: 10000 });
    } else console.warn("Desk original image is pending owner upload; original-art browser assertion deferred.");

    await page.goto(base + "#/lounge", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "The Desk", exact: true }).waitFor({ state: "visible" });
    await page.waitForFunction(() => location.hash === "#/desk", undefined, { timeout: 10000 });
    await checkPage(page);
    assert.equal(await page.getByRole("button", { name: "Lounge", exact: true }).count(), 0);

    assert.deepEqual(errors, [], "No uncaught JS errors during SoundCloud navigation: " + errors.join(" | "));
    console.log("PASS SoundCloud navigation: player → Timeline → Vault → player → Lobby → Vault → close → direct Timeline refresh; no blank screen or JS exceptions.");
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
}

main().catch((e) => { console.error("FAIL SoundCloud navigation:", e); process.exitCode = 1; });
