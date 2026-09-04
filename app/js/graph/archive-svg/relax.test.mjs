import test from "node:test";
import assert from "node:assert/strict";
import { relax, CLEAR_X, CLEAR_Y } from "./relax.js";

function grid() {
  return [
    { id: "a", n: 0, family: "ccvv", x: 0, y: 0 },
    { id: "b", n: 1, family: "ccvv", x: 200, y: 0 },
    { id: "c", n: 2, family: "ccvv", x: 200, y: 216 },
    { id: "d", n: 3, family: "graph", x: 200, y: 432 },
    { id: "e", n: 4, family: "graph", x: 400, y: 432 },
  ];
}
const edges = [
  { from: "a", to: "b" },
  { from: "b", to: "c" },
  { from: "c", to: "e" },
  { from: "d", to: "e" },
];

test("relaxing is deterministic", () => {
  const one = relax(grid(), edges).map((node) => [node.x, node.y]);
  const two = relax(grid(), edges).map((node) => [node.x, node.y]);
  assert.deepEqual(one, two);
});

test("no two nodes end inside each other's clearance box", () => {
  const nodes = relax(grid(), edges);
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b) continue;
      const clear = Math.abs(a.x - b.x) >= CLEAR_X || Math.abs(a.y - b.y) >= CLEAR_Y;
      assert.ok(clear, `${a.id} and ${b.id} overlap`);
    }
  }
});

test("x stays with its time column", () => {
  const nodes = relax(grid(), edges);
  for (const [i, node] of nodes.entries()) {
    assert.ok(Math.abs(node.x - grid()[i].x) <= 50, `${node.id} drifted in x`);
  }
});

test("a chain pulls level and the lattice loosens", () => {
  const before = grid();
  const nodes = relax(grid(), edges);
  const c = nodes.find((node) => node.id === "c");
  const e = nodes.find((node) => node.id === "e");
  assert.ok(Math.abs(e.y - c.y) < Math.abs(before[4].y - before[2].y), "edge c->e did not tighten");
  const ys = nodes.map((node) => node.y);
  assert.ok(new Set(ys).size > 2, "rows are still perfectly aligned");
});

test("pinned nodes do not move", () => {
  const nodes = grid();
  nodes[2].pinned = true;
  relax(nodes, edges);
  assert.equal(nodes[2].x, 200);
  assert.equal(nodes[2].y, 216);
});
