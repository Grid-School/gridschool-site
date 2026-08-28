import test from "node:test";
import assert from "node:assert/strict";
import {
  VIEW,
  LIST_ARG,
  argFor,
  createGridState,
  hashFor,
  reduce,
  stateFromArg,
} from "./grid-state.js";

const known = new Set(["li.post", "pf.boot", "cv.four"]);
const hasNode = (id) => known.has(id);
const opts = { hasNode };

test("a route argument round-trips through state", () => {
  for (const arg of [null, LIST_ARG, "li.post"]) {
    assert.equal(argFor(stateFromArg(arg, hasNode)), arg);
  }
});

test("the list projection can never hold an open room", () => {
  const open = stateFromArg("li.post", hasNode);
  const list = reduce(open, { type: "view", view: VIEW.LIST }, opts);
  assert.equal(list.room, null);

  // and no event can sneak one back in without leaving the list
  const opened = reduce(list, { type: "open", id: "pf.boot" }, opts);
  assert.equal(opened.view, VIEW.GRID);
  assert.equal(opened.room, "pf.boot");
});

test("closing clears the room, and the URL follows it", () => {
  const open = stateFromArg("li.post", hasNode);
  assert.equal(hashFor(open), "#/map/li.post");
  const closed = reduce(open, { type: "close" }, opts);
  assert.equal(closed.room, null);
  assert.equal(hashFor(closed), "#/map");
});

test("a route with no argument closes whatever was open", () => {
  const open = stateFromArg("li.post", hasNode);
  const back = reduce(open, { type: "route", arg: null }, opts);
  assert.equal(back.room, null);
  assert.equal(back.view, VIEW.GRID);
});

test("an unknown node id opens nothing", () => {
  assert.equal(stateFromArg("nope", hasNode).room, null);
  const state = reduce(stateFromArg(null, hasNode), { type: "open", id: "nope" }, opts);
  assert.equal(state.room, null);
});

test("toggle opens a different node and closes the same one", () => {
  let state = stateFromArg(null, hasNode);
  state = reduce(state, { type: "toggle", id: "li.post" }, opts);
  assert.equal(state.room, "li.post");
  state = reduce(state, { type: "toggle", id: "pf.boot" }, opts);
  assert.equal(state.room, "pf.boot");
  state = reduce(state, { type: "toggle", id: "pf.boot" }, opts);
  assert.equal(state.room, null);
});

test("re-applying the route the state already describes changes nothing", () => {
  const seen = [];
  const ui = createGridState({ arg: "li.post", hasNode, onChange: (s) => seen.push(s) });
  ui.route("li.post");
  ui.route("li.post");
  assert.equal(seen.length, 0, "an idempotent route must not notify");
  assert.equal(ui.openRoom(), "li.post");
});

test("the store only notifies on a real transition", () => {
  const seen = [];
  const ui = createGridState({ hasNode, onChange: (s) => seen.push(s) });
  ui.close();
  assert.equal(seen.length, 0);
  ui.open("cv.four");
  ui.open("cv.four");
  assert.equal(seen.length, 1);
  ui.close();
  assert.equal(seen.length, 2);
  assert.equal(ui.openRoom(), null);
});

test("every reachable state agrees with its own URL", () => {
  const events = [
    { type: "open", id: "li.post" },
    { type: "toggle", id: "pf.boot" },
    { type: "view", view: VIEW.LIST },
    { type: "close" },
    { type: "route", arg: "cv.four" },
    { type: "view", view: VIEW.GRID },
    { type: "route", arg: LIST_ARG },
    { type: "open", id: "nope" },
  ];
  let state = stateFromArg(null, hasNode);
  for (const event of events) {
    state = reduce(state, event, opts);
    // the invariant the old code broke: the hash and the open room are one value
    const fromUrl = stateFromArg(argFor(state), hasNode);
    assert.deepEqual(fromUrl, state, `state desynced from its URL after ${event.type}`);
    if (state.view === VIEW.LIST) assert.equal(state.room, null);
  }
});
