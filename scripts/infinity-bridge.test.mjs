import assert from "node:assert/strict";
import test from "node:test";
import {
  BRIDGE_CHANNEL, BRIDGE_VERSION, BRIDGE_MODES, BRIDGE_PALETTES,
  LENS_URL, LENS_ORIGIN, bridgeHello, bridgeCommand, isBridgeReady, isBridgeAck,
} from "../src/lib/infinityBridge.ts";

const ready = {
  channel: BRIDGE_CHANNEL, kind: "ready", version: BRIDGE_VERSION,
  mode: "cosmic-drift", palette: "aurora-phi",
  modes: BRIDGE_MODES.map(([m]) => m),
  palettes: BRIDGE_PALETTES.map(([p]) => p),
};

test("outbound handshake and modes use the explicitly trusted InfinityLens origin", () => {
  assert.equal(new URL(LENS_URL).origin, LENS_ORIGIN);
  assert.deepEqual(bridgeHello(), { channel: BRIDGE_CHANNEL, kind: "hello", version: 1 });
  for (const [mode] of BRIDGE_MODES) assert.deepEqual(bridgeCommand("mode", mode, "mbl-1"), {
    channel: BRIDGE_CHANNEL, kind: "command", action: "mode", value: mode, requestId: "mbl-1",
  });
  for (const [palette] of BRIDGE_PALETTES) assert.equal(bridgeCommand("palette", palette, "mbl-2")?.value, palette);
  assert.ok(bridgeCommand("safe", undefined, "mbl-3"));
  assert.ok(bridgeCommand("reset", undefined, "mbl-4"));
  for (const invalid of [
    bridgeCommand("mode", "unknown", "mbl-1"),
    bridgeCommand("palette", "unknown", "mbl-1"),
    bridgeCommand("safe", "unexpected", "mbl-2"),
    bridgeCommand("mode", "cosmic-drift", "evil-id"),
  ]) assert.equal(invalid, null);
});

test("ready/ack require exact channel, v1 and known scene values", () => {
  assert.equal(isBridgeReady(ready), true);
  assert.equal(isBridgeReady({ ...ready, version: 2 }), false);
  assert.equal(isBridgeReady({ ...ready, channel: "evil" }), false);
  assert.equal(isBridgeReady({ ...ready, mode: "javascript:alert(1)" }), false);
  assert.equal(isBridgeReady({ ...ready, modes: ["fake"] }), false);
  assert.equal(isBridgeReady(null), false);
  const ack = { channel: BRIDGE_CHANNEL, version: 1, kind: "ack", requestId: "mbl-2", action: "mode" };
  assert.equal(isBridgeAck(ack), true);
  assert.equal(isBridgeAck({ ...ack, requestId: "__proto__" }), false);
  assert.equal(isBridgeAck({ ...ack, action: "download" }), false);
  assert.equal(isBridgeAck({ ...ack, version: 4 }), false);
});
