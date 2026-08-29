import test from "node:test";
import assert from "node:assert/strict";
import { isStepArgs, moduleIdFromArgs } from "./step.js";

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
