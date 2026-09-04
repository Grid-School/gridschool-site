import test from "node:test";
import assert from "node:assert/strict";
import { STANDING, STANDING_LABEL, STANDING_TONE, LEGEND, standingOf, inSequence } from "./standing.js";

test("standing reads the board, and the sign-off states win over plain status", () => {
  assert.equal(standingOf({ id: "a", status: "open" }, "a"), STANDING.NEXT);
  assert.equal(standingOf({ id: "b", status: "open" }, "a"), STANDING.OPEN);
  assert.equal(standingOf({ id: "c", status: "lit" }, "a"), STANDING.LIT);
  assert.equal(standingOf({ id: "d", status: "locked" }, "a"), STANDING.LOCKED);
  assert.equal(standingOf({ id: "e", status: "future" }, "a"), STANDING.FUTURE);
  assert.equal(standingOf({ id: "f", status: "open", offered: true }, "a"), STANDING.OFFERED);
  assert.equal(standingOf({ id: "g", status: "open", awaitingSignoff: true }, "g"), STANDING.REVIEW, "in review beats next");
  assert.equal(standingOf({ id: "h", status: "open", awaitingSignoff: true, needsFix: true }, "a"), STANDING.FIX);
});

test("every standing has a label and a palette tone, and the legend covers them all", () => {
  for (const standing of Object.values(STANDING)) {
    assert.ok(STANDING_LABEL[standing], `${standing} label`);
    assert.ok(STANDING_TONE[standing], `${standing} tone`);
    assert.ok(LEGEND.includes(standing), `${standing} in legend`);
  }
});

test("inSequence is n order and does not mutate", () => {
  const nodes = [{ n: 2 }, { n: 0 }, { n: 1 }];
  assert.deepEqual(inSequence(nodes).map((node) => node.n), [0, 1, 2]);
  assert.deepEqual(nodes.map((node) => node.n), [2, 0, 1]);
});
