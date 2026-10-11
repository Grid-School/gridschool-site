import test from "node:test";
import assert from "node:assert/strict";
import { planFloor, laneCenter, STEP, NODE_R, LANE_W } from "./floorplan.js?v=dc96989-202610110117";

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

/* ---------- side quests ---------- */

const mapFamilies = [
  { id: "proof", lane: 0, track: "spine" },
  { id: "presence", lane: 1, track: "spine" },
  { id: "network", lane: 2, track: "spine" },
  { id: "pipeline", lane: 3, track: "spine" },
  { id: "interview", lane: 4, track: "spine" },
  { id: "foundations", lane: 9, track: "side" },
];

function sideGraph() {
  return {
    families: mapFamilies,
    nodes: [
      { id: "a", n: 0, family: "proof" },
      { id: "b", n: 1, family: "interview" },
      { id: "c", n: 2, family: "network" },
      { id: "s1", n: 3, family: "foundations" },
      { id: "s2", n: 4, family: "foundations" },
      { id: "s3", n: 5, family: "foundations" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "s1", to: "s2" },
      { from: "a", to: "s3" },
    ],
  };
}

test("five lanes centre on their midpoint; side families do not pull the centre", () => {
  assert.equal(laneCenter(mapFamilies), 2);
  assert.equal(laneCenter(families), 1.5);
  const plan = planFloor(sideGraph());
  assert.equal(plan.at.get("c").x, 0);
});

test("side quests stand in their own column right of the main floor", () => {
  const plan = planFloor(sideGraph());
  assert.deepEqual(plan.order, ["a", "b", "c"]);
  assert.deepEqual(plan.side, ["s1", "s2", "s3"]);
  const mainMax = Math.max(...plan.order.map((id) => plan.at.get(id).x));
  const sideXs = plan.side.map((id) => plan.at.get(id).x);
  for (const x of sideXs) assert.ok(x > mainMax + LANE_W, `side x ${x} is not clear of the main floor (${mainMax})`);
  assert.notEqual(sideXs[0], sideXs[1]);
  // Their own sequence, level with the first main node.
  assert.deepEqual(plan.side.map((id) => plan.at.get(id).z + 0), [0, -STEP, -2 * STEP]);
  assert.equal(plan.at.get("a").z + 0, 0);
  // Main ranks are unaffected by side nodes interleaved in n.
  assert.equal(plan.at.get("c").z, -2 * STEP);
});

test("the road never reaches a side quest; edges touching one are ties", () => {
  const plan = planFloor(sideGraph());
  assert.deepEqual(plan.sequence, [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ]);
  assert.deepEqual(plan.ties, [
    { from: "s1", to: "s2" },
    { from: "a", to: "s3" },
  ]);
});

test("the floor box includes the side column, so Fit frames it", () => {
  const plan = planFloor(sideGraph());
  const rightmost = Math.max(...plan.side.map((id) => plan.at.get(id).x));
  assert.equal(plan.box.maxX, rightmost + NODE_R);
});

test("a node track overrides its family for the side column", () => {
  const graph = sideGraph();
  graph.nodes[1] = { ...graph.nodes[1], track: "side" };
  const plan = planFloor(graph);
  assert.deepEqual(plan.order, ["a", "c"]);
  assert.deepEqual(plan.side, ["b", "s1", "s2", "s3"]);
});
