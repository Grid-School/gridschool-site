import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGraph, progress, nextUp } from "./model.js?v=ac1f443-202610240735";
import { routeGraph, biggestWin, previewHint, isLandmark } from "./route.js?v=ac1f443-202610240735";

const demo = (name) => JSON.parse(readFileSync(new URL(`../../../demo/${name}`, import.meta.url), "utf8"));
const DAY = new Date(2099, 0, 1);

function board(name, student = {}) {
  const doc = demo(name);
  return buildGraph(doc.map, { tasks: {}, prep: doc.prep, ...student }, { now: DAY });
}

test("a free map is one route: Scan done, today, the sample, what we do, two questions, the fold, the check-in, Interviews", () => {
  const graph = board("free-map.json");
  const route = routeGraph(graph);
  const ids = route.nodes.map((node) => node.id);
  assert.equal(ids[0], "_scan");
  assert.deepEqual(ids.slice(1, 4), ["t.today", "f.sample", "_waiting"]);
  assert.equal(ids.at(-1), "_goal");
  assert.equal(ids.at(-2), "w.checkin");
  const questions = ids.filter((id) => id.startsWith("q."));
  assert.equal(questions.length, 2);
  assert.ok(ids.includes("_more"));
  const more = route.byId.get("_more");
  const hidden = graph.nodes.filter((node) => node.id.startsWith("q.")).length - 2;
  assert.equal(more.title, `${hidden} more short steps`);
  // In order: the line runs by n.
  const ns = route.nodes.map((node) => node.n);
  assert.deepEqual(ns, [...ns].sort((a, b) => a - b));
  // Opened in place, every question shows and the fold is gone.
  const open = routeGraph(graph, { foldOpen: true });
  assert.equal(open.nodes.filter((node) => node.id.startsWith("q.")).length, hidden + 2);
  assert.ok(!open.byId.has("_more"));
  // The board's own graph never holds a landmark.
  assert.ok(graph.nodes.every((node) => !isLandmark(node.id)));
  assert.equal(route.byId.get("_scan").status, "lit");
});

test("done for you: labelled, their biggest win marked, and the preview never shows progress or a found person", () => {
  const graph = board("free-map.json");
  const route = routeGraph(graph);
  const dfy = route.nodes.filter((node) => node.paidOnly && !isLandmark(node.id));
  assert.ok(dfy.length >= 1);
  assert.ok(dfy.every((node) => node.hint === "We do this for you"));
  assert.equal(dfy.filter((node) => node.win).length, 1);
  assert.equal(dfy.find((node) => node.win).id, biggestWin(graph));
  const full = routeGraph(graph, { fullPlan: true });
  for (const node of full.nodes.filter((item) => item.preview && item.stages)) {
    assert.ok(node.hint && !/hiring manager|Ready for you/i.test(node.hint), node.hint);
  }
  assert.equal(previewHint({ stages: [] }, 0), null);
  // The preview changes nothing real.
  assert.equal(progress(graph).spine.total, progress(board("free-map.json")).spine.total);
});

test("a free map counts only the steps a free seat can finish", () => {
  const graph = board("free-map.json");
  const own = graph.nodes.filter((node) => !node.paidOnly).length;
  assert.equal(progress(graph).spine.total, own);
  assert.equal(nextUp(graph, DAY).id, "t.today");
});

test("a Complete map gets the same line, with no fold, no sample tag and no preview", () => {
  const graph = board("complete-map.json");
  const route = routeGraph(graph);
  assert.equal(route.nodes[0].id, "_scan");
  assert.equal(route.nodes.at(-1).id, "_goal");
  assert.ok(!route.byId.has("_more") && !route.byId.has("_waiting"));
  assert.equal(route.nodes.filter((node) => node.id.startsWith("q.")).length, graph.nodes.filter((node) => node.id.startsWith("q.")).length);
  assert.ok(route.nodes.every((node) => !node.win && !node.preview));
  // Trackers stay as the desk set them.
  assert.equal(route.byId.get("b.reach").hint, graph.byId.get("b.reach").hint);
});

test("a residency map is left exactly as it is", () => {
  const residency = { version: "2026-09-24", nodes: [{ id: "a", n: 1, requires: [] }] };
  assert.equal(routeGraph(residency), residency);
});
