import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMONS_XR_CHANNEL, COMMONS_XR_VERSION, parseCommonsXRCommand, isTrustedCommonsParent } from "./commons-xr-protocol.mjs";
const cmd = (type, extra = {}) => ({ channel: COMMONS_XR_CHANNEL, version: COMMONS_XR_VERSION, type, ...extra });
test("explicit channel and version required", () => {
  assert.equal(parseCommonsXRCommand({ type: "play", deck: "A" }), null);
  assert.equal(parseCommonsXRCommand({ ...cmd("play", { deck: "A" }), version: 2 }), null);
});
test("only allowlisted deck actions", () => {
  assert.deepEqual(parseCommonsXRCommand(cmd("cue", { deck: "B" })), { type: "cue", deck: "B" });
  assert.equal(parseCommonsXRCommand(cmd("upload", { path: "/private" })), null);
  assert.equal(parseCommonsXRCommand(cmd("play", { deck: "C" })), null);
});
test("scratch and crossfader must be finite and bounded", () => {
  assert.deepEqual(parseCommonsXRCommand(cmd("scratch", { deck: "A", value: -2 })), { type: "scratch", deck: "A", value: -2 });
  for (const value of [NaN, Infinity, "0.4", 5, -5]) {
    assert.equal(parseCommonsXRCommand(cmd("scratch", { deck: "A", value })), null);
  }
  assert.equal(parseCommonsXRCommand(cmd("crossfade", { value: 1.01 })), null);
});
test("handshake is not authority", () => {
  assert.deepEqual(parseCommonsXRCommand(cmd("hello")), { type: "hello" });
});
test("only exact origin and Commons path accepted", () => {
  assert.equal(isTrustedCommonsParent("https://michaelwave369.github.io", "https://michaelwave369.github.io", "/Infinite-Commons/"), true);
  assert.equal(isTrustedCommonsParent("https://other.host", "https://michaelwave369.github.io", "/Infinite-Commons/"), false);
  assert.equal(isTrustedCommonsParent("https://michaelwave369.github.io", "https://michaelwave369.github.io", "/MoreBounceLabs/"), false);
});
