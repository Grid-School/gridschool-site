import test from "node:test";
import assert from "node:assert/strict";
import { stepRows, readyToSave, isStepComplete, canAdvance, readFlag, ROW } from "./step-progress.js";

const node = {
  id: "x",
  lesson: [{ h: "a", p: ["b"] }],
  modules: [{ id: "readings/one", title: "One" }],
  tasks: [{ id: "x.t", title: "Do it" }],
};

test("rows run reading, task, link, in the order they are done", () => {
  const rows = stepRows(node, {});
  assert.deepEqual(rows.map((r) => r.kind), [ROW.READ, ROW.TASK, ROW.LINK]);
  assert.ok(rows.every((r) => !r.ok));
});

test("a reading is required: Save waits for it, tasks do not gate Save", () => {
  assert.equal(readyToSave(node, {}), false);
  const read = { stepFlags: { x: { [readFlag("readings/one")]: true } } };
  assert.equal(readyToSave(node, read), true);
  assert.equal(isStepComplete(node, read), false, "no link, no task: not complete");
});

test("complete means every row: reading read, task done, link saved", () => {
  const student = {
    stepFlags: { x: { [readFlag("readings/one")]: true } },
    tasks: { "x.t": { state: "done" } },
    evidence: { x: { url: "https://a" } },
  };
  assert.equal(isStepComplete(node, student), true);
});

test("when the page is the whole step, the lesson is the one row before the link", () => {
  const welcome = { id: "w", lesson: [{ h: "a", p: ["b"] }] };
  const rows = stepRows(welcome, {});
  assert.deepEqual(rows.map((r) => r.kind), [ROW.LESSON, ROW.LINK]);
  assert.equal(readyToSave(welcome, {}), false);
  assert.equal(readyToSave(welcome, { stepFlags: { w: { read: true } } }), true);
});

test("a saved link on a node with no reading and no task is complete on its own", () => {
  const bare = { id: "b", proof: { url: "https://a" } };
  assert.equal(isStepComplete(bare, {}), true);
});

test("a future node has no actionable rows and cannot be completed", () => {
  const future = { id: "wd.mark", kind: "future", coming: "Later.", tasks: [{ id: "nope" }] };
  assert.deepEqual(stepRows(future, {}), []);
  assert.equal(isStepComplete(future, {}), false);
  assert.equal(canAdvance(future, {}), false);
});

test("a submitted sign-off is not complete, but the student can continue", () => {
  const node = {
    id: "pj.model",
    signoff: true,
    awaitingSignoff: true,
    status: "open",
    proof: { url: "https://a" },
    tasks: [{ id: "t1" }],
  };
  const student = { tasks: { t1: { state: "done" } }, evidence: { "pj.model": { url: "https://a" } } };
  assert.equal(isStepComplete(node, student), false);
  assert.equal(canAdvance(node, student), true);
});

test("an in-app node completes from tasks and does not invent a link row", () => {
  const node = {
    id: "cv.four",
    completion: "tasks",
    tasks: [{ id: "words", fields: [{ id: "a", required: true }] }],
  };
  const rows = stepRows(node, { tasks: { words: { state: "done", answers: { a: "ok" } } } });
  assert.deepEqual(rows.map((row) => row.kind), [ROW.TASK]);
  assert.equal(isStepComplete(node, { tasks: { words: { state: "done", answers: { a: "ok" } } } }), true);
});
