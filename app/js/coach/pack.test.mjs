import test from "node:test";
import assert from "node:assert/strict";
import { nodeLines } from "./pack.js";

const base = { n: 4, title: "You can read a system", evidence: "A trace note." };

test("no open node produces no lines", () => {
  assert.deepEqual(nodeLines(null), []);
});

test("an Open-mode node states title and evidence only", () => {
  const lines = nodeLines(base);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^Open node: 04 You can read a system\. Lights when: A trace note\.$/);
});

test("a Defense-mode node tells the coach the rule it must keep", () => {
  const lines = nodeLines({ ...base, mode: "defense" });
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^Mode: Defense\. The assistant is allowed before/);
});

test("the falsification line is passed through verbatim", () => {
  const falsification = "A fluent summary that cannot answer 'what happens if'.";
  const lines = nodeLines({ ...base, proves: { falsification } });
  assert.equal(lines.at(-1), `Would show they do not have it: ${falsification}`);
});

test("a submitted sign-off node tells the coach the light waits on the review", () => {
  const lines = nodeLines({ ...base, signoff: true, awaitingSignoff: true });
  assert.ok(lines.some((line) => line.startsWith("Standing: submitted, awaiting sign-off")));
});

test("an offered depth node tells the coach the student has not picked it", () => {
  const lines = nodeLines({ ...base, offered: true });
  assert.ok(lines.some((line) => line.startsWith("Standing: on offer")));
  assert.ok(!nodeLines(base).some((line) => line.startsWith("Standing:")));
});
