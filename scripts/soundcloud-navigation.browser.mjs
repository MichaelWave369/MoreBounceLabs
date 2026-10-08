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

    await page.goto(base + "#/vault", { waitUntil: "domcontentloaded" });
    await checkPage(page);
    const nav = page.getByRole("navigation", { name: "Rooms" });
    await page.getByRole("button", { name: /Dimensional Shift/ }).first().click();
    await page.locator('iframe[title^="SoundCloud playlist:"]').waitFor({ state: "visible" });
    // Allow widget READY bindings to register before navigating away.
    await page.waitForTimeout(250);
    await nav.getByRole("button", { name: "Timeline" }).click();
    await page.getByRole("heading", { name: "Every record is a little universe." }).waitFor({ state: "visible" });
    await checkPage(page);
    assert.equal(await page.locator('iframe[title^="SoundCloud playlist:"]').count(), 0);

    await nav.getByRole("button", { name: "Vault" }).click();
    await page.getByRole("button", { name: /Reflections/ }).first().click();
    await page.locator('iframe[title^="SoundCloud playlist:"]').waitFor({ state: "visible" });
    await page.waitForTimeout(250);
    await nav.getByRole("button", { name: "Lobby" }).click();
    await page.getByRole("heading", { name: /The Azure Inheritance|MoreBounceLabs/i }).first().waitFor({ state: "visible" });
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

    assert.deepEqual(errors, [], "No uncaught JS errors during SoundCloud navigation: " + errors.join(" | "));
    console.log("PASS SoundCloud navigation: player → Timeline → Vault → player → Lobby → Vault → close → direct Timeline refresh; no blank screen or JS exceptions.");
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
}

main().catch((e) => { console.error("FAIL SoundCloud navigation:", e); process.exitCode = 1; });
