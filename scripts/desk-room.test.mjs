import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseHash } from "./house-logic.mjs";

const app = readFileSync("src/components/HouseApp.tsx", "utf8");
const desk = readFileSync("src/components/FieldDesk.tsx", "utf8");
const engine = readFileSync("src/lib/engine.ts", "utf8");

test("Lounge is completely removed from navigation and runtime UI", () => {
  assert.doesNotMatch(app, /\["lounge", "Lounge"\]/);
  assert.doesNotMatch(app, /function Lounge\(/);
  assert.doesNotMatch(app, /<Lounge/);
  assert.doesNotMatch(app, /<VizCanvas/);
  assert.doesNotMatch(app, /onLounge/);
  assert.match(app, /<FieldDesk/);
  assert.match(app, /<Player onQueue=\{\(\) => navigateRoom\("desk"\)\}/);
  assert.match(app, /aria-label="Open queue in Desk"/);
});

test("old lounge deep links redirect to Desk and the store canonicalizes old callers", () => {
  assert.equal(parseHash("#/lounge").room, "desk");
  assert.equal(parseHash("#/desk").room, "desk");
  assert.equal(parseHash("#/vault").room, "vault");
  assert.equal(parseHash("#/lab").room, "lab");
  assert.match(engine, /requestedRoom === "lounge" \? "desk" : requestedRoom/);
});

test("Desk retains current queue, playlist, history, timer and local catalog export", () => {
  for (const token of ["house.jump(", "house.moveQueue(", "house.armSleep(", "onSave(name)",
    "onPlay(list.items)", "onPlay([item])", "Export catalog", "Recently played here",
    "Now playing &amp; queue", "Playlists &amp; catalog"]) {
    assert.ok(desk.includes(token), "Desk lost core feature: " + token);
  }
  assert.match(desk, /desk\/desk-room-bg.png/);
  assert.match(desk, /mbl-field-desk-art/);
  assert.match(desk, /Vault → Update albums/);
  assert.doesNotMatch(desk, /onLounge|function Lounge/);
});
