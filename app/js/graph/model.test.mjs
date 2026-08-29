import test from "node:test";
import assert from "node:assert/strict";
import { buildGraph, nextUp, progress, STATUS, TRACK } from "./model.js";

const families = [
  { id: "ccvv", track: "spine" },
  { id: "world", track: "depth" },
  { id: "graph", track: "depth" },
];

function curriculum(nodes) {
  return { families, phases: [], nodes };
}

test("track is derived from the family when the node does not set one", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "wd.local", n: 9, family: "world", requires: [] },
    ]),
    { evidence: {} }
  );
  assert.equal(graph.byId.get("or.start").track, TRACK.SPINE);
  assert.equal(graph.byId.get("wd.local").track, TRACK.DEPTH);
});

test("nextUp prefers an open spine node over an open depth node", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "wd.local", n: 9, family: "world", requires: [] },
    ]),
    { evidence: {} }
  );
  assert.equal(graph.byId.get("or.start").status, STATUS.OPEN);
  assert.equal(graph.byId.get("wd.local").status, STATUS.OPEN);
  assert.equal(nextUp(graph).id, "or.start");
});

test("nextUp may pick depth only when no spine node is open", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "wd.local", n: 9, family: "world", requires: [] },
    ]),
    { evidence: { "or.start": { url: "https://example.com/note" } } }
  );
  assert.equal(graph.byId.get("or.start").status, STATUS.LIT);
  assert.equal(nextUp(graph).id, "wd.local");
});

test("progress splits spine from depth and ignores future nodes", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "pf.runs", n: 1, family: "ccvv", requires: [] },
      { id: "wd.local", n: 9, family: "world", requires: [] },
      { id: "wd.mark", n: 12, family: "world", kind: "future", requires: [] },
    ]),
    { evidence: { "or.start": { url: "https://example.com/note" } } }
  );
  const prog = progress(graph);
  assert.equal(prog.spine.lit, 1);
  assert.equal(prog.spine.total, 2);
  assert.equal(prog.depth.lit, 0);
  assert.equal(prog.depth.total, 1);
  assert.equal(prog.lit, 1);
  assert.equal(prog.total, 3);
});
