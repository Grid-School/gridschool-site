import test from "node:test";
import assert from "node:assert/strict";
import { validateMap } from "./map-rules.mjs?v=89ee485-202610270204";
import { applyOps, checkOps, opsShapeErrors, opShapeErrors, describeOp, withoutOp, newOpId, renumber, newNodeId } from "./map-proposal.mjs?v=89ee485-202610270204";

const map = () => ({
  version: "1",
  title: "Cal's map",
  phases: [],
  weekly: [],
  families: [
    { id: "proof", label: "Proof", lane: 0, track: "spine" },
    { id: "pipeline", label: "Pipeline", lane: 3, track: "spine" },
    { id: "side", label: "Side", lane: 5, track: "side" },
  ],
  groups: [{ id: "g.camp", mode: "all" }],
  nodes: [
    { id: "a", n: 1, title: "Rewrite LinkedIn", family: "proof", requires: [], kind: "core", tasks: [{ id: "a.1", title: "Write it", kind: "ship" }] },
    { id: "b", n: 2, title: "Loom call", family: "pipeline", requires: ["a"], kind: "core", tasks: [] },
    { id: "c1", n: 3, title: "Draftwise", family: "pipeline", requires: ["b"], kind: "core", group: "g.camp", tasks: [] },
    { id: "c2", n: 4, title: "Dill", family: "pipeline", requires: ["b"], kind: "core", group: "g.camp", tasks: [] },
    { id: "d", n: 5, title: "Screen", family: "pipeline", requires: ["g.camp"], kind: "core", tasks: [] },
    { id: "h", n: 6, title: "Apply weekly", family: "pipeline", type: "habit", requires: ["b"], kind: "core", tasks: [] },
    { id: "lib", n: 7, title: "Mock", module: "mock-interview@1", family: "proof", requires: ["a"], kind: "core", tasks: [], fill: { notes: "- Bring stories" } },
  ],
});

test("the fixture map is valid", () => assert.deepEqual(validateMap(map()), []));

test("op ids are short, lower-case and unique enough", () => {
  const id = newOpId(1_700_000_000_000, () => 0.5);
  assert.match(id, /^[a-z0-9]{4,16}$/);
  assert.notEqual(newOpId(), newOpId());
});

test("shape: every kind needs its fields, notes are bounded", () => {
  assert.deepEqual(opShapeErrors({ id: "abcd", kind: "add", after: "a", title: "Ship a Chrome extension" }), []);
  assert.ok(opShapeErrors({ id: "abcd", kind: "add", after: "a" }).some((e) => e.includes("title")));
  assert.ok(opShapeErrors({ id: "abcd", kind: "retire", node: "a" }).some((e) => e.includes("note")));
  assert.ok(opShapeErrors({ id: "abcd", kind: "move", node: "a", after: "a" }).some((e) => e.includes("itself")));
  assert.ok(opShapeErrors({ id: "AB", kind: "ask", note: "hi" }).some((e) => e.includes("id")));
  assert.deepEqual(opShapeErrors({ id: "abcd", kind: "ask", note: "What should I learn next?" }), []);
  assert.ok(opShapeErrors({ id: "abcd", kind: "drop" })[0].includes("kind"));
  assert.ok(opsShapeErrors([]).length);
  assert.ok(opsShapeErrors([{ id: "abcd", kind: "ask", note: "x" }, { id: "abcd", kind: "ask", note: "y" }]).some((e) => e.includes("share")));
});

test("add: a new step after a real step, in its lane, renumbered, marked in preview", () => {
  const op = { id: "aaaa", kind: "add", after: "a", title: "Ship a Chrome extension", tasks: ["Pick the idea", "Publish it"] };
  const { map: out, results } = applyOps(map(), [op]);
  assert.equal(results[0].ok, true);
  const node = out.nodes.find((n) => n.id === newNodeId(op));
  assert.equal(node.family, "proof");
  assert.deepEqual(node.requires, ["a"]);
  assert.deepEqual(node.tasks.map((t) => t.id), ["sg.aaaa.t1", "sg.aaaa.t2"]);
  assert.deepEqual(node.suggested, [{ kind: "add", id: "aaaa" }]);
  assert.equal(node.n, 2);
  assert.deepEqual(validateMap(out), []);
  assert.equal(map().nodes.length, 7, "the input is never edited");
});

test("add between: the step after waits on the new one; a milestone keeps its type", () => {
  const op = { id: "bbbb", kind: "add", after: "a", before: "b", type: "milestone", title: "First offer call" };
  const { map: out, results } = applyOps(map(), [op], { mode: "merge" });
  assert.equal(results[0].ok, true);
  const added = out.nodes.find((n) => n.id === newNodeId(op));
  assert.deepEqual([added.type, added.requires, added.completion], ["milestone", ["a"], "tasks"]);
  assert.deepEqual(out.nodes.find((n) => n.id === "b").requires, [newNodeId(op)]);
  assert.deepEqual(validateMap(out), []);
  assert.match(describeOp(op, (id) => id), /New milestone between “a” and “b”/);
});

test("add between refuses what the map rules refuse, and a step that isn't right after", () => {
  // Nothing may wait on a habit, so a habit between two steps is refused; after a step it's fine.
  const between = { id: "cccc", kind: "add", after: "a", before: "b", type: "habit", title: "Apply weekly" };
  assert.equal(checkOps(map(), [between])[0].ok, false);
  const { [0]: alone } = checkOps(map(), [{ ...between, before: undefined }]);
  assert.equal(alone.ok, true);
  const { results } = applyOps(map(), [{ id: "dddd", kind: "add", after: "a", before: "d", title: "X" }]);
  assert.match(results[0].conflict, /doesn't come right after/);
});

test("merge leaves no marks", () => {
  const { map: out } = applyOps(map(), [{ id: "aaaa", kind: "add", after: "a", title: "X" }, { id: "bbbb", kind: "ask", node: "b", note: "?" }], { mode: "merge" });
  assert.ok(out.nodes.every((n) => !n.suggested));
});

test("task: a free-form step gets a task; a library step gets it in its notes on merge", () => {
  const ops = [
    { id: "aaaa", kind: "task", node: "b", title: "Record a test Loom" },
    { id: "bbbb", kind: "task", node: "lib", title: "Practise the STAR story" },
  ];
  const preview = applyOps(map(), ops).map;
  assert.equal(preview.nodes.find((n) => n.id === "b").tasks[0].id, "b.aaaa");
  const merged = applyOps(map(), ops, { mode: "merge" }).map;
  const lib = merged.nodes.find((n) => n.id === "lib");
  assert.deepEqual(lib.tasks, []);
  assert.equal(lib.fill.notes, "- Bring stories\n- Practise the STAR story");
  assert.deepEqual(validateMap(merged), []);
});

test("move: changes what a step comes after, never into a loop", () => {
  const ok = applyOps(map(), [{ id: "aaaa", kind: "move", node: "lib", after: "d" }]);
  assert.equal(ok.results[0].ok, true);
  const lib = ok.map.nodes.find((n) => n.id === "lib");
  assert.deepEqual(lib.requires, ["d"]);
  assert.ok(lib.n > ok.map.nodes.find((n) => n.id === "d").n, "renumbered after its new prerequisite");
  assert.deepEqual(validateMap(ok.map), []);
  const loop = applyOps(map(), [{ id: "bbbb", kind: "move", node: "a", after: "d" }]);
  assert.equal(loop.results[0].ok, false);
  assert.match(loop.results[0].conflict, /loop/);
});

test("retire: marked in preview; on merge the steps after it wait on what it waited on", () => {
  const op = { id: "aaaa", kind: "retire", node: "b", note: "Loom call already happened" };
  const preview = applyOps(map(), [op]).map;
  assert.ok(preview.nodes.find((n) => n.id === "b").suggested);
  const merged = applyOps(map(), [op], { mode: "merge" }).map;
  assert.equal(merged.nodes.some((n) => n.id === "b"), false);
  assert.deepEqual(merged.nodes.find((n) => n.id === "c1").requires, ["a"]);
  assert.deepEqual(validateMap(merged), []);
});

test("retire in a two-step group dissolves the group and keeps the road connected", () => {
  const merged = applyOps(map(), [{ id: "aaaa", kind: "retire", node: "c2", note: "Dill closed the role" }], { mode: "merge" }).map;
  assert.equal(merged.groups.length, 0);
  assert.equal(merged.nodes.find((n) => n.id === "c1").group, undefined);
  assert.deepEqual(merged.nodes.find((n) => n.id === "d").requires, ["c1"]);
  assert.deepEqual(validateMap(merged), []);
});

test("rebase: an op on a step that has since gone is a conflict, the rest still apply", () => {
  const live = map();
  live.nodes = live.nodes.filter((n) => n.id !== "lib");
  const { results } = applyOps(live, [
    { id: "aaaa", kind: "rename", node: "lib", title: "Mock with Aden" },
    { id: "bbbb", kind: "add", after: "d", title: "Thank-you notes" },
  ]);
  assert.equal(results[0].ok, false);
  assert.match(results[0].conflict, /no longer on the map/);
  assert.equal(results[1].ok, true);
});

test("later ops can build on a step an earlier op added", () => {
  const ops = [
    { id: "aaaa", kind: "add", after: "a", title: "Chrome extension" },
    { id: "bbbb", kind: "task", node: "sg.aaaa", title: "Publish to the store" },
    { id: "cccc", kind: "add", after: "sg.aaaa", title: "Write it up" },
  ];
  const { map: out, results } = applyOps(map(), ops, { mode: "merge" });
  assert.ok(results.every((r) => r.ok));
  assert.deepEqual(validateMap(out), []);
  assert.deepEqual(withoutOp(ops, "aaaa"), [], "removing a new step removes what was built on it");
  assert.equal(withoutOp(ops, "bbbb").length, 2);
});

test("checkOps names the change the map rules refuse, and keeps checking the rest", () => {
  const checked = checkOps(map(), [
    { id: "aaaa", kind: "add", after: "h", title: "After the habit" },
    { id: "bbbb", kind: "add", after: "a", title: "Fine" },
  ]);
  assert.equal(checked[0].ok, false);
  assert.ok(checked[0].errors.some((e) => e.includes("nothing can wait on h")));
  assert.equal(checked[1].ok, true);
});

test("renumber keeps side quests from 101", () => {
  const m = map();
  m.nodes.push({ id: "s1", n: 140, title: "Read", family: "side", requires: [], kind: "core", tasks: [] });
  assert.equal(renumber(m).nodes.find((n) => n.id === "s1").n, 101);
});

test("describeOp reads as a sentence", () => {
  const title = (id) => map().nodes.find((n) => n.id === id)?.title ?? id;
  assert.equal(describeOp({ kind: "move", node: "lib", after: "d" }, title), "“Mock” comes after “Screen”");
  assert.equal(describeOp({ kind: "add", after: "a", title: "X", tasks: ["y"] }, title), "New step after “Rewrite LinkedIn”: “X” (1 task)");
});

import { readFileSync } from "node:fs";
const CASES = JSON.parse(readFileSync(new URL("../server/testdata/map-proposal-cases.json", import.meta.url)));
for (const c of CASES) {
  test(`op shapes, shared with map_proposals.py: ${c.name}`, () => assert.deepEqual(opShapeErrors(c.op), c.errors));
}

test("merging into the stored map: a new step after a library step takes the module's lane", () => {
  const stored = map();
  const lib = stored.nodes.find((n) => n.id === "lib");
  delete lib.family; // the instance leaves its lane to the module
  const resolved = new Map(map().nodes.map((n) => [n.id, n]));
  const { map: out } = applyOps(stored, [{ id: "aaaa", kind: "add", after: "lib", title: "Second mock" }], { mode: "merge", lookup: (id) => resolved.get(id) });
  assert.equal(out.nodes.find((n) => n.id === "sg.aaaa").family, "proof");
});

test("taskedit / taskdrop on a step of its own change the task in place", () => {
  const ops = [
    { id: "aaaa", kind: "taskedit", node: "a", task: "a.1", title: "Write it in my words" },
    { id: "bbbb", kind: "task", node: "a", title: "Show Aden" },
    { id: "cccc", kind: "taskdrop", node: "a", task: "a.bbbb" },
  ];
  const preview = applyOps(map(), ops).map.nodes.find((n) => n.id === "a");
  assert.deepEqual(preview.tasks.map((t) => [t.id, t.title]), [["a.1", "Write it in my words"]]);
  assert.ok(preview.suggested.some((m) => m.kind === "taskedit"));
  const merged = applyOps(map(), ops, { mode: "merge" }).map;
  assert.equal(merged.nodes.find((n) => n.id === "a").tasks[0].suggested, undefined);
  assert.deepEqual(validateMap(merged), []);
  const gone = applyOps(map(), [{ id: "dddd", kind: "taskdrop", node: "a", task: "a.9" }]).results[0];
  assert.match(gone.conflict, /no longer on the step/);
});

test("a task change on a library step gives it its own copy: same task ids, Aden's notes kept, placement kept", () => {
  const stored = map();
  const resolvedLib = {
    id: "lib", n: 7, title: "Mock", family: "proof", requires: ["a"], kind: "core", completion: "tasks",
    why: "Practice out loud", moduleRef: "mock-interview@1", fromAden: { notes: "- Bring stories", links: [], due: null },
    tasks: [{ id: "lib.record", title: "Record it", kind: "record" }, { id: "lib.review", title: "Review it", kind: "practice" }],
  };
  const ops = [
    { id: "aaaa", kind: "move", node: "lib", after: "d" },
    { id: "bbbb", kind: "taskedit", node: "lib", task: "lib.record", title: "Record it with a friend" },
    { id: "cccc", kind: "taskdrop", node: "lib", task: "lib.review", note: "Aden reviews it on the call" },
  ];
  const { map: out, results } = applyOps(stored, ops, { mode: "merge", lookup: (id) => (id === "lib" ? resolvedLib : null) });
  assert.ok(results.every((r) => r.ok), JSON.stringify(results));
  const lib = out.nodes.find((n) => n.id === "lib");
  assert.equal(lib.module, undefined);
  assert.equal(lib.moduleRef, undefined);
  assert.deepEqual(lib.requires, ["d"], "the earlier move still stands");
  assert.deepEqual(lib.tasks, [{ id: "lib.record", title: "Record it with a friend", kind: "record" }]);
  assert.equal(lib.fromAden.notes, "- Bring stories");
  assert.equal(lib.why, "Practice out loud");
  assert.deepEqual(validateMap(out), []);
});

test("describeOp names the task when it can", () => {
  const op = { kind: "taskdrop", node: "a", task: "a.1" };
  assert.equal(describeOp(op, () => "Rewrite LinkedIn", () => "Write it"), "On “Rewrite LinkedIn”, remove the task “Write it”");
  assert.equal(describeOp(op, () => "Rewrite LinkedIn"), "On “Rewrite LinkedIn”, remove a task");
});
