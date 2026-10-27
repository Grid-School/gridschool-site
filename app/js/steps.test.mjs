import test from "node:test";
import assert from "node:assert/strict";
import { doneIds, stepStates, firstOpen } from "./steps.js?v=2c47259-202610271924";
import { stepsFor, hasOutput, nextAction } from "./resume-stages.js?v=2c47259-202610271924";

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

test("lines written but this title still has questions: Questions is not done (per title, no borrowing)", () => {
  const r = rec({ roles: [{ id: "r1" }], claims: [claim({ line: "Did x." })] }, { next: { id: "q2" } });
  assert.deepEqual(done({ rec: r }), ["start", "write"]);
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

test("the next action: one thing, in the title's own numbers", () => {
  const base = { roles: [{ id: "r1" }], claims: [claim({ line: "Did x.", status: "confirmed" })], targets: [{ titles: ["Implementation Specialist"] }], queue: [{ id: "q1", state: "open" }, { id: "q2", state: "open" }] };
  const needs = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, state: "on", status: i < 1 ? "shown" : "missing" }));
  const weak = nextAction({ rec: rec(base, { next: { id: "q1" }, needs, preview: "Did x.", round: { size: 8, done: 0 } }), saves: [{ text: "Did x.", downloads: 1 }] });
  assert.equal(weak.stage, "questions"); // saved and downloaded, but 1 of 8: the questions come first
  assert.match(weak.head, /1 of 8 things an Implementation Specialist screen checks/);
  assert.match(weak.text, /Answer 2 questions/);
  const strong = nextAction({ rec: rec(base, { next: { id: "q1" }, needs: needs.map((n) => ({ ...n, status: "shown" })), preview: "Did x." }), saves: [{ text: "Did x.", downloads: 1 }] });
  assert.equal(strong.stage, "send");
  assert.match(strong.text, /More questions can raise that/);
  assert.equal(nextAction({ rec: rec({}) }).stage, "start");
  const unsaved = nextAction({ rec: rec(base, { needs: needs.map((n) => ({ ...n, status: "shown" })), preview: "Did x." }), saves: [] });
  assert.equal(unsaved.stage, "save");
  const unchecked = nextAction({ rec: rec({ ...base, claims: [claim({ line: "Did x." })] }, { next: { id: "q1" }, needs }), saves: [] });
  assert.equal(unchecked.stage, "check"); // unchecked lines come before more questions
});

test("the preview waits until a line is on the resume (kept), not just written", () => {
  assert.equal(hasOutput(rec({ roles: [{ id: "r1" }], claims: [claim()] })), false);
  assert.equal(hasOutput(rec({ claims: [claim({ line: "Did x." })] })), false);
  assert.equal(hasOutput(rec({ claims: [claim({ line: "Did x.", status: "confirmed" })] })), true);
});
