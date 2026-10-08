import test from "node:test";
import assert from "node:assert/strict";
import { layoutRoad, roadPath, roadSegments, phaseBands, wrapLabel, curve } from "./road.js?v=43911d1-202610080529";

test("depth is sequence, height is lane", () => {
  const points = layoutRoad([{ lane: 0 }, { lane: 2 }, { lane: 1 }], { x0: 0, x1: 100, laneY: (lane) => lane * 10 });
  assert.deepEqual(points.map((p) => [p.x, p.y]), [[0, 0], [50, 20], [100, 10]]);
});

test("a fixed spacing overrides the span", () => {
  const points = layoutRoad([{}, {}, {}], { x0: 10, x1: 0, laneY: () => 0, spacing: 120 });
  assert.deepEqual(points.map((p) => p.x), [10, 130, 250]);
});

test("every edge is one curve that leaves and arrives horizontally", () => {
  const d = curve({ x: 0, y: 0 }, { x: 100, y: 40 });
  assert.equal(d, "C 55 0 45 40 100 40");
  const path = roadPath([{ x: 0, y: 0 }, { x: 100, y: 40 }, { x: 200, y: 0 }]);
  assert.equal((path.match(/C /g) ?? []).length, 2);
  assert.equal(roadSegments([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]).length, 2);
});

test("phase bands wrap their steps and skip empty phases", () => {
  const bands = phaseBands(
    [{ x: 10, phase: "a" }, { x: 50, phase: "a" }, { x: 90, phase: "c" }],
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    5
  );
  assert.deepEqual(bands.map((b) => [b.id, b.x0, b.x1]), [["a", 5, 55], ["c", 85, 95]]);
});

test("labels wrap and end with an ellipsis when cut", () => {
  assert.deepEqual(wrapLabel("Ship a reviewed change to code you inherited", 18, 3), ["Ship a reviewed", "change to code you", "inherited"]);
  const cut = wrapLabel("one two three four five six seven eight nine ten", 8, 2);
  assert.equal(cut.length, 2);
  assert.ok(cut[1].endsWith("…"));
});

test("on a grid of half-lane cells, every lane and every step lands on a line", () => {
  const cell = 28;
  const laneY = (lane) => 3 * cell + lane * 2 * cell;
  const points = layoutRoad([0, 4, 2, 1, 3].map((lane) => ({ lane })), { x0: 5 * cell, x1: 0, laneY, spacing: 2 * cell });
  for (const p of points) {
    assert.equal(p.x % cell, 0);
    assert.equal(p.y % cell, 0);
  }
});
