import test from "node:test";
import assert from "node:assert/strict";
import { doneIds, stepStates, firstOpen } from "./steps.js?v=200c41d-202610261730";
import { stepsFor, hasOutput } from "./resume-stages.js?v=200c41d-202610261730";

const S = [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }];

test("a line is green only when both of its ends are done", () => {
  const out = stepStates(S, { done: ["a", "c"], here: "b" });
  assert.deepEqual(out.map((s) => s.linked), [false, false, false]);
  const all = stepStates(S, { done: ["a", "b"], here: "c" });
  assert.deepEqual(all.map((s) => s.linked), [false, true, false]);
});

test("here and done are separate: here never implies done", () => {
  const [a, b] = stepStates(S, { done: ["a"], here: "b" });
  assert.equal(a.done, true);
  assert.equal(a.here, false);
  assert.equal(b.done, false);
  assert.equal(b.here, true);
});

test("a step without a test is never done; firstOpen finds the first unfinished", () => {
  assert.deepEqual(doneIds([{ id: "x" }, { id: "y", done: () => true }], {}), ["y"]);
  assert.equal(firstOpen(S, ["a"]), "b");
  assert.equal(firstOpen(S, ["a", "b", "c"]), "c");
});

/* The resume's own rules, one record at a time. */
const claim = (over = {}) => ({ id: "c1", status: "draft", facts: { action: "x" }, ...over });
const rec = (graph, more = {}) => ({ graph: { roles: [], projects: [], claims: [], queue: [], ...graph }, preview: "", next: null, ...more });
const done = (snapshot, embedded = true) => doneIds(stepsFor(embedded), { saves: [], nodeDone: false, ...snapshot });

test("nothing yet: no step is done", () => {
  assert.deepEqual(done({ rec: rec({}) }), []);
});

test("read, with questions open: only Start", () => {
  assert.deepEqual(done({ rec: rec({ roles: [{ id: "r1" }], claims: [claim()] }, { next: { id: "q1" } }) }), ["start"]);
});

test("stopped early and wrote lines: Questions counts as finished", () => {
  const r = rec({ roles: [{ id: "r1" }], claims: [claim({ line: "Did x." })] }, { next: { id: "q2" } });
  assert.deepEqual(done({ rec: r }), ["start", "questions", "write"]);
});

test("every line kept: Check; saved but not downloaded is not Save", () => {
  const r = rec({ roles: [{ id: "r1" }], claims: [claim({ line: "Did x.", status: "confirmed" })] }, { preview: "Did x." });
  assert.deepEqual(done({ rec: r }), ["start", "questions", "write", "check"]);
  assert.deepEqual(done({ rec: r, saves: [{ text: "Did x.", downloads: 0 }] }), ["start", "questions", "write", "check"]);
  assert.deepEqual(done({ rec: r, saves: [{ text: "Did x.", downloads: 1 }] }), ["start", "questions", "write", "check", "save"]);
});

test("changed after saving: Save is open again until a new version is saved", () => {
  const r = rec({ roles: [{ id: "r1" }], claims: [claim({ line: "Did x better.", status: "confirmed" })] }, { preview: "Did x better." });
  assert.ok(!done({ rec: r, saves: [{ text: "Did x.", downloads: 2 }] }).includes("save"));
});

test("Finish only on the node, only when the student said so", () => {
  const r = rec({ roles: [{ id: "r1" }] });
  assert.ok(done({ rec: r, nodeDone: true }).includes("finish"));
  assert.ok(!done({ rec: r, nodeDone: true }, false).includes("finish"));
});

test("the preview waits until a line is on the resume (kept), not just written", () => {
  assert.equal(hasOutput(rec({ roles: [{ id: "r1" }], claims: [claim()] })), false);
  assert.equal(hasOutput(rec({ claims: [claim({ line: "Did x." })] })), false);
  assert.equal(hasOutput(rec({ claims: [claim({ line: "Did x.", status: "confirmed" })] })), true);
});
