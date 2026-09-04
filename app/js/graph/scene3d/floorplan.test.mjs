import test from "node:test";
import assert from "node:assert/strict";
import { planFloor, STEP, NODE_R } from "./floorplan.js";

const families = [
  { id: "signal", lane: 0 },
  { id: "ccvv", lane: 1 },
  { id: "portfolio", lane: 2 },
  { id: "graph", lane: 3 },
];

function graph(nodes, edges = []) {
  return { nodes, edges, families };
}

test("every node stands strictly further ahead than the one before it, in n order", () => {
  const plan = planFloor(
    graph([
      { id: "c", n: 2, family: "ccvv" },
      { id: "a", n: 0, family: "ccvv" },
      { id: "b", n: 1, family: "portfolio" },
    ])
  );
  assert.deepEqual(plan.order, ["a", "b", "c"]);
  const zs = plan.order.map((id) => plan.at.get(id).z);
  for (let i = 1; i < zs.length; i += 1) {
    assert.ok(zs[i - 1] - zs[i] >= 2 * NODE_R, `${plan.order[i]} is not a full ring ahead of ${plan.order[i - 1]}`);
    assert.equal(zs[i - 1] - zs[i], STEP);
  }
});

test("two consecutive nodes never share an x, even in one family", () => {
  const plan = planFloor(
    graph([
      { id: "a", n: 0, family: "ccvv" },
      { id: "b", n: 1, family: "ccvv" },
      { id: "c", n: 2, family: "ccvv" },
    ])
  );
  const xs = plan.order.map((id) => plan.at.get(id).x);
  assert.notEqual(xs[0], xs[1]);
  assert.notEqual(xs[1], xs[2]);
});

test("lanes spread families left to right", () => {
  const plan = planFloor(
    graph([
      { id: "s", n: 0, family: "signal" },
      { id: "k", n: 1, family: "ccvv" },
      { id: "r", n: 2, family: "portfolio" },
      { id: "g", n: 3, family: "graph" },
    ])
  );
  const x = (id) => plan.at.get(id).x;
  assert.ok(x("s") < x("k") && x("k") < x("r") && x("r") < x("g"));
});

test("the road is n to n+1; every other requirement is a tie", () => {
  const plan = planFloor(
    graph(
      [
        { id: "a", n: 0, family: "ccvv" },
        { id: "b", n: 1, family: "ccvv" },
        { id: "c", n: 2, family: "ccvv" },
      ],
      [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "c" },
      ]
    )
  );
  assert.deepEqual(plan.sequence, [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ]);
  assert.deepEqual(plan.ties, [{ from: "a", to: "c" }]);
});

test("an empty graph plans an empty floor without throwing", () => {
  const plan = planFloor(graph([]));
  assert.equal(plan.order.length, 0);
  assert.deepEqual(plan.box, { minX: 0, maxX: 1, minZ: 0, maxZ: 1 });
});
