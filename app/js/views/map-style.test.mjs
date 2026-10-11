import test from "node:test";
import assert from "node:assert/strict";
import { mapStyleFor, MAP_STYLE } from "./map.js?v=fbad271-202610110101";
import { setProgressReadOnly } from "../store.js?v=fbad271-202610110101";

const seat = (prefs) => ({ slug: "calixte", student: prefs ? { prefs } : {} });

test("a student keeps the Floor until they pick", () => {
  assert.equal(mapStyleFor(seat(), null), MAP_STYLE.FLOOR);
  assert.equal(mapStyleFor(seat({ mapStyle: "route" }), null), MAP_STYLE.ROUTE);
  assert.equal(mapStyleFor(seat({ mapStyle: "floor" }), null), MAP_STYLE.FLOOR);
});

test("a junk pick on the seat reads as the Floor", () => {
  assert.equal(mapStyleFor(seat({ mapStyle: "neon" }), null), MAP_STYLE.FLOOR);
});

test("this browser's pick never overrides a student's own seat", () => {
  assert.equal(mapStyleFor(seat({ mapStyle: "floor" }), MAP_STYLE.ROUTE), MAP_STYLE.FLOOR);
  assert.equal(mapStyleFor(seat(), MAP_STYLE.ROUTE), MAP_STYLE.FLOOR);
});

test("the demo opens on the Route, and remembers a pick in this browser", () => {
  assert.equal(mapStyleFor({ slug: "demo", student: {} }, null), MAP_STYLE.ROUTE);
  assert.equal(mapStyleFor({ slug: "demo", student: {} }, MAP_STYLE.FLOOR), MAP_STYLE.FLOOR);
});

test("Aden viewing a seat read-only sees their pick unless they pick locally", () => {
  setProgressReadOnly(true);
  try {
    assert.equal(mapStyleFor(seat({ mapStyle: "route" }), null), MAP_STYLE.ROUTE);
    assert.equal(mapStyleFor(seat({ mapStyle: "route" }), MAP_STYLE.FLOOR), MAP_STYLE.FLOOR);
  } finally {
    setProgressReadOnly(false);
  }
});
