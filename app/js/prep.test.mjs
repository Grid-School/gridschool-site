import test from "node:test";
import assert from "node:assert/strict";
import { prepOf, prepHint, opensLater, shortDay, isCompleteMap, stageTime, isFreeMap, upgradeHref } from "./prep.js?v=7b95dc3-202610272038";
import { buildGraph, nextUp, STATUS } from "./graph/model.js?v=7b95dc3-202610272038";

const STAGES = [
  { id: "roles", label: "Finding roles" },
  { id: "managers", label: "Finding hiring managers" },
  { id: "review", label: "Coach reviewing" },
  { id: "ready", label: "Ready for you" },
];
const NODE = { id: "b.reach", stages: STAGES };

test("nothing set: every stage waits, and the map says it's queued", () => {
  const prep = prepOf(NODE, {});
  assert.deepEqual(prep.stages.map((s) => s.state), ["todo", "todo", "todo", "todo"]);
  assert.equal(prep.started, false);
  assert.equal(prepHint(prep), "Starting soon");
});

test("a stage is done only when it was set and is behind the current one", () => {
  const prep = prepOf(NODE, { "b.reach": { stage: "review", at: { roles: "2026-10-19T15:00:00Z", review: "2026-10-20T15:00:00Z" } } });
  // managers was never set, so it never reads done
  assert.deepEqual(prep.stages.map((s) => s.state), ["done", "todo", "current", "todo"]);
  assert.equal(prepHint(prep), "Coach reviewing");
  assert.equal(prep.ready, false);
});

test("ready is done, and the hint says it's theirs", () => {
  const prep = prepOf(NODE, { "b.reach": { stage: "ready", at: { roles: "x", managers: "x", review: "x", ready: "2026-10-21T09:00:00Z" } } });
  assert.equal(prep.ready, true);
  assert.deepEqual(prep.stages.map((s) => s.state), ["done", "done", "done", "done"]);
  assert.equal(prepHint(prep), "Ready for you");
});

test("a node without stages has no tracker", () => {
  assert.equal(prepOf({ id: "a" }, {}), null);
  assert.equal(prepHint(null), null);
});

test("opens: later until that local day, then open", () => {
  const node = { opens: "2026-10-26" };
  assert.equal(opensLater(node, new Date(2026, 9, 25, 23, 59)), true);
  assert.equal(opensLater(node, new Date(2026, 9, 26, 0, 1)), false);
  assert.equal(opensLater({ opens: "soon" }, new Date()), false);
  assert.equal(shortDay("2026-10-26"), "Mon, Oct 26");
  assert.equal(stageTime("2026-10-19T09:05:00"), "Oct 19, 9:05 AM");
});

test("only maps complete_map.py built are Complete maps", () => {
  assert.equal(isCompleteMap({ version: "complete-2" }), true);
  assert.equal(isCompleteMap({ version: "2026-09-24" }), false);
  assert.equal(isCompleteMap({}), false);
});

const MAP = {
  version: "complete-2",
  families: [{ id: "pipeline", track: "spine", lane: 1 }],
  phases: [{ id: "now" }, { id: "week" }],
  nodes: [
    { id: "b.reach", n: 1, title: "Notes", family: "pipeline", phase: "now", requires: [], kind: "core", completion: "tasks", stages: STAGES, tasks: [{ id: "b.reach.send", title: "Send", kind: "ship" }] },
    { id: "b.final", n: 2, title: "Final", family: "pipeline", phase: "now", requires: [], kind: "core", completion: "tasks", stages: STAGES, prepFirst: false, tasks: [{ id: "b.final.recall", title: "Recall", kind: "write" }] },
    { id: "t.today", n: 3, title: "Today", family: "pipeline", phase: "now", requires: [], kind: "core", completion: "tasks", tasks: [{ id: "t.today.do", title: "Do", kind: "ship" }] },
    { id: "w.checkin", n: 4, title: "Check-in", family: "pipeline", phase: "week", requires: [], kind: "core", completion: "tasks", opens: "2026-10-26", tasks: [{ id: "w.checkin.feel", title: "Feel", kind: "write" }] },
  ],
};
const DAY_ONE = new Date(2026, 9, 19, 10, 0);

test("day one: a step waiting on our work is never next, so today's ten minutes is", () => {
  const graph = buildGraph(MAP, { tasks: {} }, { now: DAY_ONE });
  assert.equal(graph.byId.get("b.reach").preparing, true);
  assert.equal(graph.byId.get("b.reach").hint, "Starting soon");
  // A step whose task is what we work from never waits.
  assert.equal(graph.byId.get("b.final").preparing, false);
  assert.equal(nextUp(graph, DAY_ONE).id, "b.final");
  const done = buildGraph(MAP, { tasks: { "b.final.recall": { state: "done" } } }, { now: DAY_ONE });
  assert.equal(nextUp(done, DAY_ONE).id, "t.today");
  assert.equal(graph.version, "complete-2");
});

test("ready opens the step's tasks and makes it next", () => {
  const prep = { "b.reach": { stage: "ready", at: { ready: "2026-10-20T09:00:00Z" } } };
  const graph = buildGraph(MAP, { prep, tasks: {} }, { now: DAY_ONE });
  assert.equal(graph.byId.get("b.reach").preparing, false);
  assert.equal(nextUp(graph, DAY_ONE).id, "b.reach");
});

test("ready work made by the prep runner reads on the step, and its tasks open", () => {
  const at = { roles: "x", managers: "x", review: "x", ready: "2026-10-19T10:05:00Z" };
  const out = { notes: "**1. Backend Engineer at Acme**\n> Hi, I saw your payments work.", links: [{ label: "Acme: Backend Engineer", url: "https://example.com/job" }] };
  assert.equal(prepOf(NODE, { "b.reach": { stage: "ready", at, by: "auto", out } }).out, out);
  // Not ready yet: nothing is shown, even if an out were there.
  assert.equal(prepOf(NODE, { "b.reach": { stage: "roles", at: { roles: "x" }, out } }).out, null);
  const graph = buildGraph(MAP, { tasks: {}, prep: { "b.reach": { stage: "ready", at, by: "auto", out } } }, { now: DAY_ONE });
  const node = graph.byId.get("b.reach");
  assert.equal(node.preparing, false);
  assert.equal(node.fromAden.notes, out.notes);
  assert.deepEqual(node.fromAden.links, out.links);
});

test("the check-in opens on its day, and finishing a Complete step lights it", () => {
  const before = buildGraph(MAP, { tasks: {} }, { now: DAY_ONE });
  const checkin = before.byId.get("w.checkin");
  assert.equal(checkin.status, STATUS.FUTURE);
  assert.equal(checkin.hint, "Opens Mon, Oct 26");
  assert.match(checkin.coming, /^Opens Mon, Oct 26\./);
  const after = buildGraph(MAP, { tasks: {} }, { now: new Date(2026, 9, 26, 8, 0) });
  assert.equal(after.byId.get("w.checkin").status, STATUS.OPEN);
  assert.equal(after.byId.get("w.checkin").hint, undefined);
  const lit = buildGraph(MAP, { tasks: { "t.today.do": { state: "done" } } }, { now: DAY_ONE });
  assert.equal(lit.byId.get("t.today").status, STATUS.LIT);
});

test("a residency map is untouched: no tracker, no hint, no date gate", () => {
  const residency = { ...MAP, version: "2026-09-24", nodes: MAP.nodes.map(({ stages, opens, prepFirst, ...node }) => node) };
  const graph = buildGraph(residency, { tasks: {} }, { now: DAY_ONE });
  for (const node of graph.nodes) {
    assert.equal(node.prep, undefined);
    assert.equal(node.preparing, undefined);
    assert.equal(node.hint, undefined);
    assert.equal(node.status, STATUS.OPEN);
  }
});

test("a free map: prepared steps are part of the paid plan, with no tracker even if prep were sent", () => {
  const free = { ...MAP, plan: "free", check: "ck_abcdefghijklmnop" };
  const prep = { "b.reach": { stage: "ready", at: { ready: "2026-10-20T09:00:00Z" } } };
  const graph = buildGraph(free, { prep, tasks: {} }, { now: DAY_ONE });
  assert.equal(isFreeMap(graph), true);
  for (const id of ["b.reach", "b.final"]) {
    const node = graph.byId.get(id);
    assert.equal(node.paidOnly, true);
    assert.equal(node.preparing, true);
    assert.equal(node.prep, undefined);
    assert.equal(node.hint, "We do this for you");
  }
  // The today step is what's next, fully usable; the check-in still opens on its day.
  assert.equal(nextUp(graph, DAY_ONE).id, "t.today");
  assert.equal(graph.byId.get("t.today").paidOnly, undefined);
  assert.equal(graph.byId.get("w.checkin").status, STATUS.FUTURE);
  // A paid Complete map is unchanged.
  const paid = buildGraph(MAP, { prep, tasks: {} }, { now: DAY_ONE });
  assert.equal(paid.byId.get("b.reach").paidOnly, undefined);
  assert.equal(paid.byId.get("b.reach").prep.ready, true);
  assert.equal(isFreeMap(paid), false);
});

test("Have us do this: the demo checkout on the demo board, the seat's own check offer otherwise", () => {
  const graph = { check: "ck_abcdefghijklmnop", nodes: [{ id: "t.today" }, { id: "b.reach", basis: { rule: "reach" } }] };
  assert.equal(upgradeHref(graph, { basis: { rule: "story" } }, { demo: true }), "../demo/checkout/?top=story");
  assert.equal(upgradeHref(graph, null, { demo: true }), "../demo/checkout/?top=reach");
  assert.equal(upgradeHref(graph, null), "../check/?id=ck_abcdefghijklmnop&step=offer");
  assert.equal(upgradeHref({ check: "javascript:alert(1)" }, null), "../check/?step=offer");
});
