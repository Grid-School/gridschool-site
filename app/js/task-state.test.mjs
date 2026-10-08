import test from "node:test";
import assert from "node:assert/strict";
import {
  taskAnswersReady,
  taskIsComplete,
  isCountTask,
  periodKey,
  taskStateId,
  savedTask,
  countOf,
  withSavedState,
} from "./task-state.js?v=b6ca108-202610080352";
import { buildQueue } from "./tasks.js?v=b6ca108-202610080352";
import { buildGraph } from "./graph/model.js?v=b6ca108-202610080352";

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

test("habit periods: local calendar day and ISO week", () => {
  const d = new Date(2026, 9, 3, 23, 30); // Sat 3 Oct 2026, late evening local
  assert.equal(periodKey("day", d), "2026-10-03");
  assert.equal(periodKey("week", d), "2026-W40");
  assert.equal(periodKey("week", new Date(2026, 9, 4)), "2026-W40"); // Sunday closes the week
  assert.equal(periodKey("week", new Date(2026, 9, 5)), "2026-W41"); // Monday opens the next
  // ISO edge cases: the week belongs to the year holding its Thursday.
  assert.equal(periodKey("week", new Date(2021, 0, 1)), "2020-W53");
  assert.equal(periodKey("week", new Date(2024, 11, 30)), "2025-W01");
});

test("a count task keeps its state per period and a plain task keeps its id", () => {
  const habit = { id: "n.comments", kind: "count", target: 3, per: "day" };
  const now = new Date(2026, 9, 3, 9);
  assert.equal(isCountTask(habit), true);
  assert.equal(taskStateId(habit, now), "n.comments#2026-10-03");
  assert.equal(taskStateId({ id: "plain" }, now), "plain");
  assert.equal(taskStateId({ id: "w.ship", weekKey: "w.ship#w3" }, now), "w.ship#w3");

  const student = {
    tasks: {
      "n.comments#2026-10-02": { state: "done", answers: { count: 3 } },
      "n.comments#2026-10-03": { answers: { count: 2 } },
    },
  };
  const today = withSavedState(habit, student, now);
  assert.equal(today.weekKey, "n.comments#2026-10-03");
  assert.equal(today.state, "todo");
  assert.equal(countOf(today), 2);
  // Yesterday's full tally does not carry into today.
  assert.equal(taskIsComplete(habit, savedTask(student, habit, now)), false);
  assert.equal(taskIsComplete(habit, savedTask(student, habit, new Date(2026, 9, 2, 12))), true);
  assert.equal(countOf({}), 0);
  assert.equal(countOf({ answers: { count: -4 } }), 0);
});

test("a habit leaves the queue once this period's tally is met", () => {
  const map = {
    families: [{ id: "f", lane: 0, track: "spine" }],
    phases: [],
    nodes: [
      {
        id: "n",
        n: 0,
        family: "f",
        kind: "core",
        requires: [],
        tasks: [{ id: "n.posts", title: "Post", kind: "count", target: 2, per: "week" }],
      },
    ],
  };
  const now = new Date(2026, 9, 3);
  const student = (tasks) => ({ tasks });
  const queue = (tasks) => buildQueue({ graph: buildGraph(map, student(tasks)), curriculum: map, student: student(tasks), week: 1, now });
  const [task] = queue({ "n.posts#2026-W40": { answers: { count: 1 } } });
  assert.equal(task.weekKey, "n.posts#2026-W40");
  assert.equal(countOf(task), 1);
  assert.deepEqual(queue({ "n.posts#2026-W40": { state: "done", answers: { count: 2 } } }), []);
  assert.equal(queue({ "n.posts#2026-W39": { state: "done", answers: { count: 2 } } }).length, 1);
});
