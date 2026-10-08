import assert from "node:assert/strict";
import test from "node:test";
import { parsePlayerTime, shouldAdvance, createTrackWatch } from "./dj-bot-core.mjs";

test("visible player clock parses minutes and hours", () => {
  assert.equal(parsePlayerTime("0:04"), 4);
  assert.equal(parsePlayerTime(" 12:34 "), 754);
  assert.equal(parsePlayerTime("1:02:03"), 3723);
  for (const value of ["", "4", "4:78", "-1:02", "NaN", "0:03 / 0:04", "9:1", "1000:00"]) {
    assert.equal(parsePlayerTime(value), null, value);
  }
});

test("clock reaching duration does not imply completion", () => {
  assert.equal(shouldAdvance({ sawPlaying: true, state: "paused", currentText: "0:04", durationText: "0:04" }), false);
  assert.equal(shouldAdvance({ sawPlaying: true, state: "buffering", currentText: "0:04", durationText: "0:04" }), false);
  assert.equal(shouldAdvance({ sawPlaying: false, state: "ended", currentText: "0:04", durationText: "0:04" }), false);
  assert.equal(shouldAdvance({ sawPlaying: true, state: "ended", currentText: "0:03", durationText: "0:04" }), false);
  assert.equal(shouldAdvance({ sawPlaying: true, state: "ended", currentText: "0:04", durationText: "0:04" }), true);
});

test("watch observes playing before advancing", () => {
  const watch = createTrackWatch();
  assert.equal(watch.observe("ended", "0:04", "0:04"), false);
  assert.equal(watch.observe("ready", "0:00", "0:04"), false);
  assert.equal(watch.observe("playing", "0:02", "0:04"), false);
  assert.equal(watch.observe("paused", "0:04", "0:04"), false);
  assert.equal(watch.observe("ended", "0:04", "0:04"), true);
});
