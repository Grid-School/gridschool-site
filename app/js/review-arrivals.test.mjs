import test from "node:test";
import assert from "node:assert/strict";
import { arrivals, arrivalLine } from "./review-arrivals.js";

const rv = (id, state, extra = {}) => ({ id, state, nodeId: "pf.runs", ...extra });

test("a review that moves to returned is an arrival; one already returned is not", () => {
  const before = [rv("a", "in-review"), rv("b", "returned")];
  const after = [rv("a", "returned"), rv("b", "returned")];
  assert.deepEqual(arrivals(before, after).map((r) => r.id), ["a"]);
});

test("a review returned before the app opened is not announced again", () => {
  const same = [rv("b", "returned")];
  assert.deepEqual(arrivals(same, same), []);
});

test("a brand new returned review (first sync) is an arrival", () => {
  assert.deepEqual(arrivals([], [rv("c", "returned")]).map((r) => r.id), ["c"]);
});

test("the line names the node and the outcome", () => {
  const byId = new Map([["pf.runs", { n: 2, title: "It runs" }]]);
  assert.equal(arrivalLine(rv("a", "returned"), byId), "Accepted: 02 · It runs. It is lit.");
  assert.equal(
    arrivalLine(rv("a", "returned", { outcome: "changes" }), byId),
    "Changes came back on 02 · It runs. The fix is on the node."
  );
  assert.equal(arrivalLine({ id: "x", state: "returned", title: "Side quest" }, byId), "Accepted: Side quest. It is lit.");
});
