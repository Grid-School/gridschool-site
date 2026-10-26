import test from "node:test";
import assert from "node:assert/strict";
import { roundState, factLine, gained, addRange, wantsNumber } from "./interview.js?v=200c41d-202610261730";

const rec = (done, open) => ({ round: { size: 8, done }, graph: { queue: Array.from({ length: open }, (_, i) => ({ id: `q${i}`, state: "open" })) } });

test("the round counts up to eight, never past what's open", () => {
  assert.equal(roundState(rec(0, 20)).title, "Question 1 of 8");
  assert.equal(roundState(rec(2, 3)).title, "Question 3 of 5");
  assert.match(roundState(rec(7, 9)).after, /last one in this round/);
});

test("after a round, the page offers to write; keep going lifts it", () => {
  assert.equal(roundState(rec(8, 4)).over, true);
  assert.equal(roundState(rec(8, 4), { keepGoing: true }).over, false);
  assert.equal(roundState(rec(8, 0)).over, false); // nothing left: the "every question" card handles it
});

test("what an answer gained: the lines it changed, and needs now shown", () => {
  const before = { needs: [{ id: "n1", label: "Kubernetes", state: "on", status: "missing" }, { id: "n2", label: "SQL", state: "on", status: "shown" }] };
  const after = {
    needs: [{ id: "n1", label: "Kubernetes", state: "on", status: "shown" }, { id: "n2", label: "SQL", state: "on", status: "shown" }],
    graph: { claims: [{ id: "c9", facts: { action: "Ran", object: "a k3s cluster", result: "deploys went from manual to one command" }, metrics: [{ value: "about 12", unit: "services" }] }] },
  };
  const g = gained(before, after, ["c9", "gone"]);
  assert.deepEqual(g.nowShown, ["Kubernetes"]);
  assert.deepEqual(g.lines, ["Ran a k3s cluster → deploys went from manual to one command · about 12 services"]);
});

test("a fact line falls back to their own words", () => {
  assert.equal(factLine({ original: "Trained new employees", facts: {} }), "Trained new employees");
});

test("a tapped range joins what they typed as its own sentence", () => {
  assert.equal(addRange("", "about 5–20"), "About 5–20.");
  assert.equal(addRange("Trained servers each season.", "about 5–20"), "Trained servers each season. About 5–20.");
  assert.equal(wantsNumber({ node: "T1" }), false);
  assert.equal(wantsNumber({ node: "N1" }), true);
});
