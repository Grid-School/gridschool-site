import test from "node:test";
import assert from "node:assert/strict";
import { isStepArgs, moduleIdFromArgs, tasksLead } from "./step.js?v=022c412-202610100125";

const graph = { byId: new Map([["or.start", {}], ["gr.parse", {}], ["cv.four", {}]]) };

test("list and bare map are not step pages", () => {
  assert.equal(isStepArgs([], graph), false);
  assert.equal(isStepArgs(["list"], graph), false);
  assert.equal(isStepArgs(undefined, graph), false);
});

test("a known node id is a step page", () => {
  assert.equal(isStepArgs(["or.start"], graph), true);
  assert.equal(isStepArgs(["nope"], graph), false);
});

test("module id is joined from /m/ segments", () => {
  assert.equal(moduleIdFromArgs(["gr.parse"]), null);
  assert.equal(moduleIdFromArgs(["gr.parse", "m"]), null);
  assert.equal(
    moduleIdFromArgs(["gr.parse", "m", "nanograph", "00-your-repo-is-a-graph"]),
    "nanograph/00-your-repo-is-a-graph"
  );
});

test("the task lead tells habits apart from the checklist", () => {
  assert.match(tasksLead({ tasks: [{ id: "a" }] }), /in order/);
  assert.match(tasksLead({ tasks: [{ id: "a" }] }, true), /Reading the task does not complete it/);
  const mixed = tasksLead({ tasks: [{ id: "a" }, { id: "h", kind: "count", target: 3, per: "day" }] });
  assert.match(mixed, /Habits reset each day; they never block this step/);
  const weekly = tasksLead({ tasks: [{ id: "h", kind: "count", target: 1, per: "week" }] });
  assert.match(weekly, /^Keep these habits going\. Habits reset each week/);
  const both = [{ id: "d", kind: "count", target: 1, per: "day" }, { id: "w", kind: "count", target: 1, per: "week" }];
  assert.match(tasksLead({ tasks: both }), /each day or week/);
});
