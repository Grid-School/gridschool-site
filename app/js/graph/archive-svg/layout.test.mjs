import test from "node:test";
import assert from "node:assert/strict";
import { applyLayout, LANE_H, phaseBands, edgePath } from "./layout.js";
import { CLEAR_Y } from "./relax.js";

function graph(nodes, phases = []) {
  return { nodes: nodes.map((node) => ({ r: 33, ...node })), phases };
}

/**
 * The lattice is a seed; relax.js settles it. What must survive: stacked nodes
 * never sit inside each other's clearance, and the rail order holds.
 */
test("stacked nodes in one column keep clear of each other, in rail order", () => {
  const g = graph([
    { id: "li", col: 2, family: "linkedin", n: 1, lane: 0, x: 0, y: 0 },
    { id: "a", col: 2, family: "ccvv", n: 2, lane: 0.62, x: 0, y: 0 },
    { id: "b", col: 2, family: "ccvv", n: 3, lane: 1, x: 0, y: 0 },
    { id: "c", col: 2, family: "ccvv", n: 4, lane: 1.38, x: 0, y: 0 },
    { id: "pf", col: 2, family: "portfolio", n: 5, lane: 2, x: 0, y: 0 },
  ]);
  applyLayout(g);
  const ys = g.nodes.map((node) => node.y);
  for (let i = 1; i < ys.length; i += 1) {
    assert.ok(ys[i] - ys[i - 1] >= CLEAR_Y, `${g.nodes[i].id} crowds ${g.nodes[i - 1].id}`);
  }
});

test("a fat column swells from the center; thin rails stay in order", () => {
  const g = graph([
    { id: "li0", col: 0, family: "linkedin", n: 1, lane: 0 },
    { id: "cv0", col: 0, family: "ccvv", n: 2, lane: 1 },
    { id: "pf0", col: 0, family: "portfolio", n: 3, lane: 2 },
    { id: "li1", col: 1, family: "linkedin", n: 4, lane: 0 },
    { id: "pf1", col: 1, family: "portfolio", n: 5, lane: 2 },
    { id: "li2", col: 2, family: "linkedin", n: 6, lane: 0 },
    { id: "a", col: 2, family: "ccvv", n: 7, lane: 0.62 },
    { id: "b", col: 2, family: "ccvv", n: 8, lane: 1 },
    { id: "c", col: 2, family: "ccvv", n: 9, lane: 1.38 },
    { id: "pf2", col: 2, family: "portfolio", n: 10, lane: 2 },
  ]);
  applyLayout(g);
  const at = (id) => g.nodes.find((node) => node.id === id).y;
  assert.ok(at("li0") < at("cv0") && at("cv0") < at("pf0"), "column 0 rail order");
  assert.ok(at("li1") < at("pf1"), "column 1 rail order");
  assert.ok(at("li2") < at("a") && at("a") < at("b") && at("b") < at("c") && at("c") < at("pf2"), "column 2 rail order");
  assert.ok(at("li2") < at("li0") - LANE_H / 2, "the fat column's Career rail steps out");
  assert.ok(at("pf2") > at("pf0") + LANE_H / 2, "the fat column's portfolio rail steps out");
  assert.ok(Math.abs(at("b")) < LANE_H / 2, "the middle of the fat column stays near the skills line");
});

test("every edge leaves and arrives on the horizontal", () => {
  const pairs = [
    [
      { x: 0, y: 0, r: 33 },
      { x: 206, y: 216, r: 33 },
    ],
    [
      { x: 0, y: 0, r: 33 },
      { x: 0, y: 216, r: 33 },
    ],
    [
      { x: 412, y: -216, r: 33 },
      { x: 618, y: 0, r: 33 },
    ],
  ];
  for (const [a, b] of pairs) {
    const nums = edgePath(a, b).match(/-?\d+(\.\d+)?/g).map(Number);
    assert.equal(nums[1], a.y);
    assert.equal(nums[3], a.y);
    assert.equal(nums[5], b.y);
    assert.equal(nums[7], b.y);
  }
});

test("phase bands do not share an x range", () => {
  const g = graph(
    [
      { id: "li0", col: 0, family: "linkedin", n: 1, phase: "foundation", x: 0, y: 0, r: 33 },
      { id: "cv", col: 0, family: "ccvv", n: 2, phase: "proof", x: 0, y: 216, r: 33 },
      { id: "li3", col: 3, family: "linkedin", n: 3, phase: "proof", x: 618, y: 0, r: 33 },
    ],
    [
      { id: "foundation", label: "Start simple", weeks: "1 to 2" },
      { id: "proof", label: "Add skill", weeks: "3 to 6" },
    ]
  );
  applyLayout(g);
  const bands = phaseBands(g);
  for (let i = 1; i < bands.length; i += 1) {
    assert.ok(bands[i].minX >= bands[i - 1].maxX);
  }
});
