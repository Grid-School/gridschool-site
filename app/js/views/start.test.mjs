import test from "node:test";
import assert from "node:assert/strict";
import { communityHref, inviteReady, forgetInvite, roomLines, imInChanges, isStartDone, ON_ITS_WAY } from "./start.js?v=7288040-202610310409";
import { buildGraph, nextUp, stepCount, stepNumber } from "../graph/model.js?v=7288040-202610310409";
import { nextMove } from "../engine.js?v=7288040-202610310409";

// The shape server/start_step.py makes (start_step_test.py keeps the server side honest).
const START = {
  id: "s.start", n: 1, type: "step", kind: "core", phase: "now", family: "pipeline", title: "Start here", requires: [], completion: "tasks",
  tasks: [
    { id: "s.start.how", title: "How your map works", kind: "read" },
    { id: "s.start.plans", title: "What you get", kind: "read" },
    { id: "s.start.time", title: "Pick your weekly time", kind: "write", fields: [{ id: "slot", label: "Your weekly time", required: true, choices: [{ value: "weekends", label: "Weekends" }] }] },
    { id: "s.start.community", title: "Join the community", kind: "read" },
  ],
};
const builder = (id, n, requires = []) => ({ id, n, type: "builder", tool: id, kind: "core", phase: "now", family: "pipeline", title: id, requires, completion: "tasks", tasks: [{ id: `${id}.do`, title: "Do", kind: "write" }] });
const MAP = {
  version: "starter-6",
  families: [{ id: "pipeline", label: "Search", lane: 0, track: "spine" }],
  phases: [{ id: "now", label: "Start here" }],
  nodes: [START, builder("b.profile", 2), builder("p.path", 3, ["b.profile"]), builder("b.resume", 4, ["p.path"])],
};

test("the door is the server's /community route until LINKS.community is set", () => {
  assert.equal(communityHref({ community: "REPLACE_ME_COMMUNITY" }, { endpoint: "https://lab.example" }), "https://lab.example/community");
  assert.equal(communityHref({ community: "https://lab.example/community" }, { endpoint: "x" }), "https://lab.example/community");
});

test("the invite counts as ready only on a redirect", async () => {
  const cases = [
    [async () => ({ type: "opaqueredirect", status: 0 }), true],
    [async () => ({ type: "cors", status: 404 }), false],
    [async () => { throw new TypeError("offline"); }, false],
  ];
  for (const [fetcher, want] of cases) {
    forgetInvite();
    assert.equal(await inviteReady(fetcher, "https://lab.example/community"), want);
  }
  forgetInvite();
  let calls = 0;
  const counted = async () => { calls += 1; return { type: "opaqueredirect" }; };
  await inviteReady(counted, "u");
  await inviteReady(counted, "u");
  assert.equal(calls, 1); // asked once per page load
  forgetInvite();
  assert.doesNotMatch(ON_ITS_WAY, /—/);
});

test("rooms come from config CHANNELS, and none when it's empty", () => {
  assert.deepEqual(roomLines({ asks: { name: "#asks", purpose: "Questions" }, ship: { name: "#ship", purpose: "Finished work" } }), ["#asks: Questions.", "#ship: Finished work."]);
  assert.deepEqual(roomLines(null), []);
});

test("I'm in needs the weekly time, then checks every task", () => {
  assert.equal(imInChanges(START, {}).missing.field.id, "slot");
  const { missing, changes } = imInChanges(START, {}, { "s.start.time-slot": "weekends" });
  assert.equal(missing, null);
  assert.deepEqual(changes.map(([id]) => id), ["s.start.how", "s.start.plans", "s.start.time", "s.start.community"]);
  assert.deepEqual(changes[2][1], { slot: "weekends" });
  // A saved choice counts, and tasks already done aren't written again.
  const student = { tasks: { "s.start.how": { state: "done" }, "s.start.time": { state: "todo", answers: { slot: "weekends" } } } };
  assert.deepEqual(imInChanges(START, student).changes.map(([id]) => id), ["s.start.plans", "s.start.time", "s.start.community"]);
  const all = Object.fromEntries(changes.map(([id, answers]) => [id, { state: "done", answers }]));
  assert.equal(isStartDone(START, { tasks: all }), true);
  assert.equal(isStartDone(START, student), false);
});

test("Start here is 01, the rest shift, and a fresh map's next move is Start here", () => {
  const graph = buildGraph(MAP, {});
  assert.deepEqual(["s.start", "b.profile", "p.path", "b.resume"].map((id) => stepNumber(graph.byId.get(id))), ["01", "02", "03", "04"]);
  assert.equal(nextUp(graph).id, "s.start");
  assert.deepEqual(stepCount(graph), { at: 1, total: 4, done: 0 });
  assert.equal(nextMove({ student: {}, graph }).stepId, "s.start");
  // It locks nothing: Who you are is open before Start here is done.
  assert.equal(graph.byId.get("b.profile").status, "open");
  // Done, the next move is Who you are.
  const tasks = Object.fromEntries(START.tasks.map((t) => [t.id, { state: "done", answers: t.fields ? { slot: "weekends" } : {} }]));
  const after = buildGraph(MAP, { tasks });
  assert.equal(after.byId.get("s.start").status, "lit");
  assert.equal(nextMove({ student: { tasks }, graph: after }).stepId, "b.profile");
});
