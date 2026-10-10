import test from "node:test";
import assert from "node:assert/strict";
import { buildGraph, nextUp, progress, visibleGraph, isSide, isSpine, trackOf, stepNumber, STATUS, TRACK } from "./model.js?v=022c412-202610100125";
import { buildQueue } from "../tasks.js?v=022c412-202610100125";

const families = [
  { id: "ccvv", track: "spine" },
  { id: "lab", track: "depth" },
  { id: "graph", track: "depth" },
];

function curriculum(nodes) {
  return { families, phases: [], nodes };
}

test("track is derived from the family when the node does not set one", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "lab.local", n: 9, family: "lab", requires: [] },
    ]),
    { evidence: {} }
  );
  assert.equal(graph.byId.get("or.start").track, TRACK.SPINE);
  assert.equal(graph.byId.get("lab.local").track, TRACK.DEPTH);
});

test("nextUp prefers an open spine node over an open depth node", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "lab.local", n: 9, family: "lab", requires: [] },
    ]),
    { evidence: {} }
  );
  assert.equal(graph.byId.get("or.start").status, STATUS.OPEN);
  assert.equal(graph.byId.get("lab.local").status, STATUS.OPEN);
  assert.equal(nextUp(graph).id, "or.start");
});

test("nextUp may pick depth only when no spine node is open", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "lab.local", n: 9, family: "lab", requires: [] },
    ]),
    { evidence: { "or.start": { url: "https://example.com/note" } } }
  );
  assert.equal(graph.byId.get("or.start").status, STATUS.LIT);
  assert.equal(nextUp(graph).id, "lab.local");
});

test("an in-app onboarding node lights only when every task and required answer is complete", () => {
  const nodes = [
    {
      id: "or.start",
      n: 0,
      family: "ccvv",
      completion: "tasks",
      requires: [],
      tasks: [
        { id: "goal", fields: [{ id: "answer", required: true }] },
        { id: "room" },
      ],
    },
    { id: "or.setup", n: 1, family: "ccvv", requires: ["or.start"] },
  ];
  const incomplete = buildGraph(curriculum(nodes), {
    evidence: {},
    tasks: { goal: { state: "done", answers: { answer: "" } }, room: { state: "done" } },
  });
  assert.equal(incomplete.byId.get("or.start").status, STATUS.OPEN);
  assert.equal(incomplete.byId.get("or.setup").status, STATUS.LOCKED);

  const complete = buildGraph(curriculum(nodes), {
    evidence: {},
    tasks: { goal: { state: "done", answers: { answer: "A specific goal" } }, room: { state: "done" } },
  });
  assert.equal(complete.byId.get("or.start").status, STATUS.LIT);
  assert.equal(complete.byId.get("or.setup").status, STATUS.OPEN);
  assert.equal(complete.byId.get("or.start").proof, null, "in-app completion does not invent an evidence URL");
});

test("progress splits spine from depth and ignores future nodes", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "pf.runs", n: 1, family: "ccvv", requires: [] },
      { id: "lab.local", n: 9, family: "lab", requires: [] },
      { id: "lab.mark", n: 12, family: "lab", kind: "future", requires: [] },
    ]),
    { evidence: { "or.start": { url: "https://example.com/note" } } }
  );
  const prog = progress(graph);
  assert.equal(prog.spine.lit, 1);
  assert.equal(prog.spine.total, 2);
  assert.equal(prog.depth.lit, 0);
  assert.equal(prog.depth.total, 0, "unpicked depth is not on the student's plate");
  assert.equal(prog.depth.offered, 1);
  assert.equal(prog.depth.available, 1);
  assert.equal(prog.lit, 1);
  assert.equal(prog.total, 3);
});

test("a depth node is offered when its prerequisites light, hidden while they do not, and counted once picked", () => {
  const nodes = [
    { id: "or.start", n: 0, family: "ccvv", requires: [] },
    { id: "gr.parse", n: 9, family: "graph", requires: ["or.start"] },
    { id: "gr.query", n: 10, family: "graph", requires: ["gr.parse"] },
  ];
  const dark = buildGraph(curriculum(nodes), { evidence: {} });
  assert.equal(dark.byId.get("gr.parse").hidden, true);
  assert.equal(visibleGraph(dark).nodes.map((node) => node.id).join(), "or.start");

  const lit = buildGraph(curriculum(nodes), { evidence: { "or.start": { url: "https://x/a" } } });
  assert.equal(lit.byId.get("gr.parse").offered, true);
  assert.equal(lit.byId.get("gr.parse").hidden, false);
  assert.equal(lit.byId.get("gr.query").hidden, true);
  assert.deepEqual(visibleGraph(lit).edges.map((edge) => edge.id), ["or.start->gr.parse"]);
  assert.equal(progress(lit).depth.total, 0);

  const picked = buildGraph(curriculum(nodes), {
    evidence: { "or.start": { url: "https://x/a" } },
    chosen: ["gr.parse"],
  });
  assert.equal(picked.byId.get("gr.parse").offered, false);
  assert.equal(picked.byId.get("gr.parse").chosen, true);
  assert.equal(progress(picked).depth.total, 1);
  assert.equal(nextUp(picked).id, "gr.parse");
});

test("nextUp prefers picked depth over offered depth once the spine is clear", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "lab.local", n: 9, family: "lab", requires: [] },
      { id: "gr.parse", n: 12, family: "graph", requires: [] },
    ]),
    { evidence: { "or.start": { url: "https://x/a" } }, chosen: ["gr.parse"] }
  );
  assert.equal(nextUp(graph).id, "gr.parse");
});

test("a signoff node unlocks its dependents on submit and lights on an accepting verdict", () => {
  const nodes = [
    { id: "pj.ship", n: 1, family: "ccvv", signoff: true, requires: [] },
    { id: "pj.users", n: 2, family: "ccvv", requires: ["pj.ship"] },
    { id: "cap.defend", n: 3, family: "capstone", gate: true, requires: ["pj.ship"] },
  ];
  const submitted = buildGraph(curriculum(nodes), {
    evidence: { "pj.ship": { url: "https://x/app" } },
    reviews: [{ id: "r1", nodeId: "pj.ship", state: "in-review", link: "https://x/app" }],
  });
  assert.equal(submitted.byId.get("pj.ship").status, STATUS.OPEN);
  assert.equal(submitted.byId.get("pj.ship").awaitingSignoff, true);
  assert.equal(submitted.byId.get("pj.users").status, STATUS.OPEN, "the next ticket does not wait on the review");
  assert.equal(submitted.byId.get("cap.defend").status, STATUS.LOCKED, "a gate waits for the verdict");

  const signed = buildGraph(curriculum(nodes), {
    evidence: { "pj.ship": { url: "https://x/app" } },
    reviews: [{ id: "r1", nodeId: "pj.ship", state: "returned", outcome: "accepted", link: "https://x/app" }],
  });
  assert.equal(signed.byId.get("pj.ship").status, STATUS.LIT);
  assert.equal(signed.byId.get("pj.ship").awaitingSignoff, false);
  assert.equal(signed.byId.get("cap.defend").status, STATUS.OPEN);
});

test("a review sent back for changes never re-locks, and hands the student a fix task", () => {
  const nodes = [
    { id: "pj.ship", n: 1, family: "ccvv", signoff: true, requires: [], tasks: [{ id: "t1", title: "Ship" }] },
    { id: "pj.users", n: 2, family: "ccvv", requires: ["pj.ship"] },
  ];
  const back = buildGraph(curriculum(nodes), {
    evidence: { "pj.ship": { url: "https://x/app" } },
    reviews: [
      { id: "r1", nodeId: "pj.ship", state: "returned", outcome: "changes", link: "https://x/app", verdict: "Add tests. Then we talk.", taughtMove: "" },
    ],
  });
  const ship = back.byId.get("pj.ship");
  assert.equal(ship.status, STATUS.OPEN);
  assert.equal(ship.needsFix, true);
  assert.equal(back.byId.get("pj.users").status, STATUS.OPEN, "what opened on submit stays open");
  assert.deepEqual(
    ship.tasks.map((task) => task.title),
    ["Ship", "Address the review: Add tests."]
  );
  assert.equal(ship.tasks.at(-1).id, "pj.ship.fix.r1", "the fix task id is stable per review");

  // Resubmitting at a new link clears the fix; the old verdict is stale.
  const moved = buildGraph(curriculum(nodes), {
    evidence: { "pj.ship": { url: "https://x/app-v2" } },
    reviews: [{ id: "r1", nodeId: "pj.ship", state: "returned", outcome: "changes", link: "https://x/app" }],
  });
  assert.equal(moved.byId.get("pj.ship").needsFix, false);
  assert.equal(moved.byId.get("pj.ship").awaitingSignoff, true);
  assert.equal(moved.byId.get("pj.ship").tasks.length, 1);
});

test("an accepting verdict on an older link does not light the current one; a legacy verdict without outcome does", () => {
  const nodes = [{ id: "pj.ship", n: 1, family: "ccvv", signoff: true, requires: [] }];
  const stale = buildGraph(curriculum(nodes), {
    evidence: { "pj.ship": { url: "https://x/v2" } },
    reviews: [{ id: "r1", nodeId: "pj.ship", state: "returned", outcome: "accepted", link: "https://x/v1" }],
  });
  assert.equal(stale.byId.get("pj.ship").status, STATUS.OPEN);
  const legacy = buildGraph(curriculum(nodes), {
    evidence: { "pj.ship": { url: "https://x/v2" } },
    reviews: [{ id: "r1", nodeId: "pj.ship", state: "returned" }],
  });
  assert.equal(legacy.byId.get("pj.ship").status, STATUS.LIT);
});

test("Career signal family can mix spine core and depth expansion on one rail", () => {
  const graph = buildGraph(
    {
      families: [
        { id: "capstone", track: "spine" },
        { id: "signal", track: "spine" },
      ],
      phases: [],
      nodes: [
        { id: "cap.change", n: 5, family: "capstone", requires: [] },
        { id: "sg.profile", n: 9, family: "signal", track: "spine", requires: ["cap.change"] },
        { id: "sg.engine", n: 12, family: "signal", track: "depth", requires: ["sg.profile"] },
      ],
    },
    { evidence: { "cap.change": { url: "https://example.com/pr" } } }
  );
  assert.equal(graph.byId.get("sg.profile").track, TRACK.SPINE);
  assert.equal(graph.byId.get("sg.engine").track, TRACK.DEPTH);
  assert.equal(graph.byId.get("sg.profile").status, STATUS.OPEN);
  assert.equal(graph.byId.get("sg.engine").status, STATUS.LOCKED);
  const prog = progress(graph);
  assert.equal(prog.spine.total, 2);
  assert.equal(prog.depth.available, 1);
  assert.equal(prog.depth.total, 0);
  assert.equal(nextUp(graph).id, "sg.profile");
});

test("after mission receipt, nextUp stays on earlier spine before Career when both are open", () => {
  const graph = buildGraph(
    {
      families: [
        { id: "ccvv", track: "spine" },
        { id: "capstone", track: "spine" },
        { id: "signal", track: "spine" },
      ],
      phases: [],
      nodes: [
        { id: "cap.change", n: 5, family: "capstone", requires: [] },
        { id: "cv.check", n: 6, family: "ccvv", requires: ["cap.change"] },
        { id: "sg.profile", n: 9, family: "signal", track: "spine", requires: ["cap.change"] },
      ],
    },
    { evidence: { "cap.change": { url: "https://example.com/pr" } } }
  );
  assert.equal(graph.byId.get("cv.check").status, STATUS.OPEN);
  assert.equal(graph.byId.get("sg.profile").status, STATUS.OPEN);
  assert.equal(nextUp(graph).id, "cv.check");
});

test("unlockAll opens locked nodes without lighting them", () => {
  const graph = buildGraph(
    {
      families: [{ id: "ccvv", track: "spine" }],
      phases: [],
      nodes: [
        { id: "a", n: 0, family: "ccvv", requires: [] },
        { id: "b", n: 1, family: "ccvv", requires: ["a"] },
      ],
    },
    { evidence: {} },
    { unlockAll: true }
  );
  assert.equal(graph.byId.get("a").status, STATUS.OPEN);
  assert.equal(graph.byId.get("b").status, STATUS.OPEN);
  assert.equal(graph.byId.get("b").devForced, true);
  assert.equal(progress(graph).spine.lit, 0);
});

/* ---------- side quests and habits (per-student maps) ---------- */

const mapFamilies = [
  { id: "proof", lane: 0, track: "spine" },
  { id: "craft", lane: 2, track: "depth" },
  { id: "foundations", lane: 5, track: "side" },
];

function studentMap() {
  return {
    families: mapFamilies,
    phases: [],
    nodes: [
      { id: "a", n: 0, family: "proof", kind: "core", requires: [], tasks: [] },
      { id: "b", n: 1, family: "proof", kind: "core", requires: ["a"], tasks: [] },
      { id: "d", n: 2, family: "craft", kind: "core", requires: [], tasks: [] },
      { id: "s1", n: 0.5, family: "foundations", kind: "core", requires: [], tasks: [] },
      { id: "s2", n: 3, family: "foundations", kind: "core", requires: ["s1"], tasks: [] },
    ],
  };
}

test("a side-track family makes its nodes side quests", () => {
  const graph = buildGraph(studentMap(), { evidence: {} });
  assert.equal(graph.byId.get("s1").track, TRACK.SIDE);
  assert.equal(isSide(graph.byId.get("s1")), true);
  assert.equal(isSpine(graph.byId.get("s1")), false);
  assert.equal(trackOf({ family: "proof", track: "side" }, mapFamilies), TRACK.SIDE);
});

test("side quests are open and visible but never offered, hidden, or next", () => {
  const graph = buildGraph(studentMap(), { evidence: { a: { url: "https://example.com/a" } } });
  const s1 = graph.byId.get("s1");
  const s2 = graph.byId.get("s2");
  assert.equal(s1.status, STATUS.OPEN);
  assert.equal(s2.status, STATUS.LOCKED);
  assert.equal(s1.offered || s1.hidden || s2.offered || s2.hidden, false);
  assert.ok(visibleGraph(graph).nodes.some((node) => node.id === "s2"));
  assert.equal(nextUp(graph).id, "b");
});

test("nextUp never falls back to a side quest when nothing else is open", () => {
  const graph = buildGraph(studentMap(), {
    evidence: { a: { url: "https://x/a" }, b: { url: "https://x/b" }, d: { url: "https://x/d" } },
    chosen: ["d"],
  });
  assert.equal(graph.byId.get("s1").status, STATUS.OPEN);
  assert.equal(nextUp(graph), null);
});

test("progress counts side quests on their own and nowhere else", () => {
  const graph = buildGraph(studentMap(), {
    evidence: { a: { url: "https://x/a" }, s1: { url: "https://x/s1" } },
  });
  const prog = progress(graph);
  assert.deepEqual([prog.spine.lit, prog.spine.total], [1, 2]);
  assert.equal(prog.depth.available, 1);
  assert.equal(prog.total, 3);
  assert.deepEqual([prog.side.lit, prog.side.total], [1, 2]);
});

test("the task queue leaves side quests out", () => {
  const map = studentMap();
  map.nodes.find((node) => node.id === "s1").tasks = [{ id: "s1.read", title: "Read it", kind: "write" }];
  map.nodes.find((node) => node.id === "a").tasks = [{ id: "a.ship", title: "Ship it", kind: "ship" }];
  const graph = buildGraph(map, { evidence: {} });
  const queue = buildQueue({ graph, curriculum: map, student: { tasks: {} }, week: 1 });
  assert.deepEqual(queue.map((task) => task.id), ["a.ship"]);

  // Only side quests open: still nothing queued from them.
  const done = buildGraph(map, {
    evidence: { a: { url: "https://x/a" }, b: { url: "https://x/b" }, d: { url: "https://x/d" } },
  });
  assert.deepEqual(buildQueue({ graph: done, curriculum: map, student: { tasks: {} }, week: 1 }), []);
});

test("habit (count) tasks never gate a tasks-completed node", () => {
  const map = {
    families: mapFamilies,
    phases: [],
    nodes: [
      {
        id: "a",
        n: 0,
        family: "proof",
        kind: "core",
        completion: "tasks",
        requires: [],
        tasks: [
          { id: "a.intro", title: "Introduce yourself", kind: "write" },
          { id: "a.comments", title: "Comment", kind: "count", target: 3, per: "day" },
        ],
      },
    ],
  };
  const graph = buildGraph(map, { tasks: { "a.intro": { state: "done" } } });
  assert.equal(graph.byId.get("a").status, STATUS.LIT);
  assert.deepEqual(graph.byId.get("a").taskProgress, { done: 1, total: 1 });
});

test("side quests read S1, S2… in n order; path steps keep their padded n", () => {
  const graph = buildGraph(
    {
      phases: [],
      families: [{ id: "p", track: "spine" }, { id: "side", track: "side" }],
      nodes: [
        { id: "a", n: 1, family: "p", requires: [] },
        { id: "s2", n: 105, family: "side", requires: [] },
        { id: "s1", n: 101, family: "side", requires: [] },
      ],
    },
    { evidence: {}, tasks: {}, reviews: [] }
  );
  assert.equal(stepNumber(graph.byId.get("a")), "01");
  assert.equal(stepNumber(graph.byId.get("s1")), "S1");
  assert.equal(stepNumber(graph.byId.get("s2")), "S2");
  assert.equal(graph.byId.get("s2").n, 105, "stored n is untouched");
  assert.equal(stepNumber({ n: 7 }), "07");
});
