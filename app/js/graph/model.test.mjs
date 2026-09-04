import test from "node:test";
import assert from "node:assert/strict";
import { buildGraph, nextUp, progress, visibleGraph, STATUS, TRACK } from "./model.js";

const families = [
  { id: "ccvv", track: "spine" },
  { id: "world", track: "depth" },
  { id: "graph", track: "depth" },
];

function curriculum(nodes) {
  return { families, phases: [], nodes };
}

test("track is derived from the family when the node does not set one", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "wd.local", n: 9, family: "world", requires: [] },
    ]),
    { evidence: {} }
  );
  assert.equal(graph.byId.get("or.start").track, TRACK.SPINE);
  assert.equal(graph.byId.get("wd.local").track, TRACK.DEPTH);
});

test("nextUp prefers an open spine node over an open depth node", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "wd.local", n: 9, family: "world", requires: [] },
    ]),
    { evidence: {} }
  );
  assert.equal(graph.byId.get("or.start").status, STATUS.OPEN);
  assert.equal(graph.byId.get("wd.local").status, STATUS.OPEN);
  assert.equal(nextUp(graph).id, "or.start");
});

test("nextUp may pick depth only when no spine node is open", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "wd.local", n: 9, family: "world", requires: [] },
    ]),
    { evidence: { "or.start": { url: "https://example.com/note" } } }
  );
  assert.equal(graph.byId.get("or.start").status, STATUS.LIT);
  assert.equal(nextUp(graph).id, "wd.local");
});

test("progress splits spine from depth and ignores future nodes", () => {
  const graph = buildGraph(
    curriculum([
      { id: "or.start", n: 0, family: "ccvv", requires: [] },
      { id: "pf.runs", n: 1, family: "ccvv", requires: [] },
      { id: "wd.local", n: 9, family: "world", requires: [] },
      { id: "wd.mark", n: 12, family: "world", kind: "future", requires: [] },
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
      { id: "wd.local", n: 9, family: "world", requires: [] },
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
