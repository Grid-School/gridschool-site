import test from "node:test";
import assert from "node:assert/strict";
import { VIEW, stateFromArg, argFor, hashFor, reduce, createGridState } from "./grid-state.js";

test("#/map is the floor; #/map/list is the list", () => {
  assert.equal(stateFromArg(null).view, VIEW.MAP);
  assert.equal(stateFromArg("list").view, VIEW.LIST);
});

test("the old #/map/3d link lands on the floor, which is now the default", () => {
  assert.equal(stateFromArg("3d").view, VIEW.MAP);
  assert.equal(hashFor(stateFromArg("3d")), "#/map");
});

test("a node id as an argument is not a projection; it is the floor", () => {
  // Step pages own #/map/<nodeId>; this machine never holds a node.
  assert.equal(stateFromArg("pf.runs").view, VIEW.MAP);
});

test("state and argument round-trip", () => {
  for (const arg of [null, "list"]) {
    assert.equal(argFor(stateFromArg(arg)), arg);
  }
  assert.equal(hashFor(stateFromArg("list")), "#/map/list");
  assert.equal(hashFor(stateFromArg(null)), "#/map");
});

test("an unknown view falls back to the floor", () => {
  assert.equal(reduce({ view: VIEW.LIST }, { type: "view", view: "grid" }).view, VIEW.MAP);
});

test("the holder notifies once per real change", () => {
  const seen = [];
  const ui = createGridState({ onChange: (next, previous) => seen.push([previous.view, next.view]) });
  ui.setView(VIEW.LIST);
  ui.setView(VIEW.LIST);
  ui.route(null);
  assert.deepEqual(seen, [
    [VIEW.MAP, VIEW.LIST],
    [VIEW.LIST, VIEW.MAP],
  ]);
  assert.equal(ui.isList(), false);
});
