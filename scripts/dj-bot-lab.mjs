#!/usr/bin/env node
/**
 * Opt-in MBL DJ Bot Lab: local synthetic player only.
 * Never contacts Suno, bypasses autoplay protections, or scrapes third-party audio.
 */
import { chromium } from "playwright";
import { createTrackWatch } from "./dj-bot-core.mjs";
import { startDjBotFixture } from "./dj-bot-fixture.mjs";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node scripts/dj-bot-lab.mjs [--headed] [--tracks=10]");
  console.log("Runs a localhost-only simulated playlist; does not touch Suno.");
  process.exit(0);
}
if (args.some((arg) => arg !== "--headed" && !arg.startsWith("--tracks="))) {
  throw new Error("Unsupported argument. This prototype only operates on the local test fixture.");
}
const trackArg = args.find((arg) => arg.startsWith("--tracks="));
const trackCount = trackArg ? Number(trackArg.slice("--tracks=".length)) : 10;
if (!Number.isInteger(trackCount) || trackCount < 1 || trackCount > 25) {
  throw new Error("--tracks must be an integer between 1 and 25.");
}

const fixture = await startDjBotFixture(trackCount);
let browser;
const startTime = Date.now();
const receipt = {
  mode: "localhost-cross-origin-fixture",
  tracksRequested: trackCount,
  starts: 0,
  completed: 0,
  transitions: 0,
};

try {
  browser = await chromium.launch({ headless: !args.includes("--headed") });
  const page = await browser.newPage();
  await page.goto(fixture.url, { waitUntil: "load" });
  const frame = page.frameLocator("iframe[data-dj-frame]");
  for (let i = 0; i < trackCount; i++) {
    const selected = Number((await page.locator("[data-track-index]").textContent())?.trim());
    if (selected !== i + 1) {
      throw new Error("Expected track " + (i + 1) + ", got " + selected);
    }
    const play = frame.locator("[data-dj-play]");
    await play.waitFor({ state: "visible", timeout: 7000 });
    await play.click({ timeout: 7000 });
    receipt.starts++;

    const watch = createTrackWatch();
    const deadline = Date.now() + 8000;
    let finished = false;
    while (Date.now() < deadline) {
      const state = await frame.locator("[data-dj-state]").getAttribute("data-dj-state");
      const current = await frame.locator("[data-dj-current]").innerText();
      const duration = await frame.locator("[data-dj-duration]").innerText();
      if (watch.observe(state, current, duration)) {
        finished = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    if (!finished) throw new Error("Track " + (i + 1) + " did not signal playing-to-ended");
    receipt.completed++;
    if (i < trackCount - 1) {
      await page.locator("[data-dj-next]").click();
      receipt.transitions++;
    }
  }
  receipt.elapsedMs = Date.now() - startTime;
  console.log("PASS MBL DJ Bot Lab " + JSON.stringify(receipt));
} catch (error) {
  console.error("FAIL MBL DJ Bot Lab:", error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await fixture.close();
}
