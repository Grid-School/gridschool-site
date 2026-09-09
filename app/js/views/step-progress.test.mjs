import test from "node:test";
import assert from "node:assert/strict";
import { stepRows, readyToSave, isStepComplete, readFlag, ROW } from "./step-progress.js";

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
