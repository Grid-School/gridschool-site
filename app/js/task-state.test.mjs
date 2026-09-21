import test from "node:test";
import assert from "node:assert/strict";
import { taskAnswersReady, taskIsComplete } from "./task-state.js";

test("required fields block completion until they have text", () => {
  const task = { fields: [{ id: "a", required: true }, { id: "b", required: false }] };
  assert.equal(taskAnswersReady(task, { answers: { a: "  " } }), false);
  assert.equal(taskAnswersReady(task, { answers: { a: "done" } }), true);
  assert.equal(taskIsComplete(task, { state: "done", answers: { a: "done" } }), true);
  assert.equal(taskIsComplete(task, { state: "todo", answers: { a: "done" } }), false);
});

test("a task with no fields completes from state alone", () => {
  assert.equal(taskIsComplete({ id: "x" }, { state: "done" }), true);
  assert.equal(taskIsComplete({ id: "x" }, {}), false);
});
