import test from "node:test";
import assert from "node:assert/strict";
import { systemLine } from "./system-line.js";

test("systemLine labels portfolio as Repo required", () => {
  assert.equal(
    systemLine({ family: "portfolio", track: "spine" }),
    "This week's system · Repo (required)"
  );
});

test("systemLine labels ccvv as Skills required", () => {
  assert.equal(
    systemLine({ family: "ccvv", track: "spine" }),
    "This week's system · Skills (required)"
  );
});

test("systemLine labels capstone as Mission required", () => {
  assert.equal(
    systemLine({ family: "capstone", track: "spine" }),
    "This week's system · Mission (required)"
  );
});

test("systemLine labels signal spine as Career required", () => {
  assert.equal(
    systemLine({ family: "signal", track: "spine" }),
    "This week's system · Career (required)"
  );
});

test("systemLine labels signal depth as Career depth", () => {
  assert.equal(
    systemLine({ family: "signal", track: "depth" }),
    "This week's system · Career (depth)"
  );
});

test("systemLine keeps world and graph as depth wording", () => {
  assert.equal(
    systemLine({ family: "world", track: "depth" }),
    "This week's system · The world (depth track)"
  );
  assert.equal(
    systemLine({ family: "graph", track: "depth" }),
    "This week's system · Graph / nanograph (depth)"
  );
});

test("systemLine labels the owned-system project family as depth", () => {
  assert.equal(
    systemLine({ family: "project", track: "depth" }),
    "This week's system · Your own system (depth)"
  );
});

test("systemLine returns null for unknown family (never invents the world)", () => {
  assert.equal(systemLine({ family: "mystery", track: "spine" }), null);
  assert.equal(systemLine(null), null);
});
