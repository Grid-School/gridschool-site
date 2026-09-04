/**
 * Static invariants over the real curriculum.json. The operating plan's
 * per-node contract (ops/curriculum-operating-plan.md §1.3) and the audit
 * criteria (ops/founding-path-audit.md §A) as checks, so a node without a
 * falsification line or a summary cannot land on the map by accident.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MODES } from "../app/js/modes.js";

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, "..");
const cur = JSON.parse(readFileSync(join(here, "curriculum.json"), "utf8"));
const catalog = JSON.parse(readFileSync(join(site, "read/catalog.json"), "utf8"));

const nodes = cur.nodes;
const byId = new Map(nodes.map((node) => [node.id, node]));
const core = nodes.filter((node) => node.kind !== "future");
const familyTrack = new Map((cur.families ?? []).map((family) => [family.id, family.track]));
const trackOf = (node) => node.track ?? familyTrack.get(node.family);
const spine = core.filter((node) => trackOf(node) === "spine");

const PROVES = ["claim", "challenge", "evidence", "falsification", "threshold", "transfer"];

test("ids are unique and every `requires` names a real node", () => {
  assert.equal(byId.size, nodes.length);
  for (const node of nodes) {
    for (const req of node.requires ?? []) {
      assert.ok(byId.has(req), `${node.id} requires unknown ${req}`);
    }
  }
});

test("requires form a DAG", () => {
  const state = new Map();
  const visit = (id, path) => {
    if (state.get(id) === "done") return;
    assert.notEqual(state.get(id), "active", `cycle: ${[...path, id].join(" -> ")}`);
    state.set(id, "active");
    for (const req of byId.get(id).requires ?? []) visit(req, [...path, id]);
    state.set(id, "done");
  };
  for (const node of nodes) visit(node.id, []);
});

test("sequence numbers are unique and never precede a prerequisite", () => {
  const seen = new Set();
  for (const node of nodes) {
    assert.ok(!seen.has(node.n), `duplicate n=${node.n} (${node.id})`);
    seen.add(node.n);
    for (const req of node.requires ?? []) {
      assert.ok(byId.get(req).n < node.n, `${node.id} (n=${node.n}) is ordered before ${req}`);
    }
  }
});

test("every family a node names exists", () => {
  for (const node of nodes) {
    assert.ok(familyTrack.has(node.family), `${node.id} family ${node.family}`);
  }
});

test("every core node carries the per-node contract (why, evidence, ccvv, reviewFor, a task with done_when)", () => {
  for (const node of core) {
    assert.ok(node.why, `${node.id} why`);
    assert.ok(node.evidence, `${node.id} evidence`);
    assert.ok(Array.isArray(node.ccvv) && node.ccvv.length, `${node.id} ccvv`);
    assert.ok(typeof node.reviewFor === "string" && node.reviewFor.trim(), `${node.id} reviewFor`);
    assert.ok(Array.isArray(node.tasks) && node.tasks.length, `${node.id} tasks`);
    for (const task of node.tasks) {
      assert.ok(task.done_when, `${node.id} task ${task.id ?? task.title} done_when`);
    }
  }
});

test("every core node carries the six-field proves contract", () => {
  for (const node of core) {
    assert.ok(node.proves, `${node.id} proves`);
    for (const field of PROVES) {
      assert.ok(
        typeof node.proves[field] === "string" && node.proves[field].trim(),
        `${node.id} proves.${field}`
      );
    }
  }
});

test("every core node has a video slot with a written summary", () => {
  for (const node of core) {
    assert.ok(node.video?.id, `${node.id} video.id`);
    assert.ok(node.video?.summary?.trim(), `${node.id} video.summary`);
  }
});

test("mode, when set, is one the step page can print", () => {
  for (const node of nodes) {
    if (node.mode !== undefined) assert.ok(MODES[node.mode], `${node.id} mode ${node.mode}`);
  }
});

test("lesson figures point at files under site/app", () => {
  for (const node of nodes) {
    for (const section of node.lesson ?? []) {
      if (section.fig?.src) {
        assert.ok(existsSync(join(site, "app", section.fig.src)), `${node.id} fig ${section.fig.src}`);
      }
    }
  }
});

test("attached modules exist in the reading catalog", () => {
  const known = new Set(
    [...(catalog.modules ?? []), ...(catalog.briefs ?? []), ...(catalog.readings ?? [])].map((m) => m.id)
  );
  for (const node of nodes) {
    for (const mod of node.modules ?? []) {
      assert.ok(known.has(mod.id), `${node.id} module ${mod.id}`);
    }
  }
});

test("catalog attachesTo names real nodes", () => {
  const all = [...(catalog.modules ?? []), ...(catalog.briefs ?? []), ...(catalog.readings ?? [])];
  for (const mod of all) {
    const attached = mod.attachesTo === undefined ? [] : [mod.attachesTo].flat();
    for (const id of attached) {
      assert.ok(byId.has(id), `catalog ${mod.id} attaches to unknown ${id}`);
    }
  }
});

test("the spine is the six gates, the mission, the Career core with its design step, the owned-system model and the graph tool", () => {
  const expected = [
    "or.start", "ops.flow", "pf.runs", "cv.four", "cv.understand", "cv.frame", "cv.spec",
    "cap.change", "cv.check", "cv.delegate", "cap.review", "cap.defend",
    "sg.profile", "pf.style", "sg.site", "sg.show", "li.publish",
    "pj.model", "gr.parse", "gr.query",
  ];
  assert.deepEqual(spine.map((node) => node.id).sort(), [...expected].sort());
  assert.deepEqual(byId.get("cap.change").requires, ["cv.spec"]);
  assert.deepEqual([...byId.get("cap.defend").requires].sort(), ["cap.review", "cv.check", "cv.delegate"]);
  assert.deepEqual(byId.get("sg.profile").requires, ["cap.change"]);
  assert.deepEqual(byId.get("pf.style").requires, ["sg.profile"]);
  assert.deepEqual(byId.get("sg.site").requires, ["pf.style"]);
  assert.deepEqual(byId.get("li.publish").requires, ["cap.defend"]);
});

test("Career expansion and the later project track never sit on the spine", () => {
  const depthOnly = ["sg.engine", "sg.post", "sg.habit", "sg.article", "sg.research", "sg.oss",
    "pj.ship", "pj.users", "cap.outcome", "gr.structure", "gr.seam", "gr.pack", "gr.fork"];
  for (const id of depthOnly) {
    assert.equal(trackOf(byId.get(id)), "depth", `${id} should be depth`);
  }
});

test("project assignments carry a final sign-off; nothing else does", () => {
  const signoff = nodes.filter((node) => node.signoff).map((node) => node.id).sort();
  assert.deepEqual(signoff, ["cap.defend", "cap.outcome", "pj.model", "pj.ship", "pj.users"]);
  for (const node of nodes.filter((n) => n.signoff)) {
    assert.ok(node.reviewFor, `${node.id} signoff needs reviewFor so the sign-off has a rubric`);
  }
});

test("the spine can be worked in `n` order: no required node waits on an elective", () => {
  const spineIds = new Set(spine.map((node) => node.id));
  for (const node of spine) {
    for (const req of node.requires ?? []) {
      assert.ok(spineIds.has(req), `${node.id} (required) depends on ${req} (elective)`);
    }
  }
});

test("a fresh board opens exactly one node, and it is 00: the map never starts with a gap", () => {
  const roots = core.filter((node) => !(node.requires ?? []).length);
  assert.deepEqual(
    roots.map((node) => node.id),
    ["or.start"],
    "every other node must trace back to Welcome, or a new student sees 02 lit and 01 dark"
  );
  assert.equal(byId.get("or.start").n, 0);
});

test("a gate waits for the verdict on a sign-off it depends on; Publish is the only one", () => {
  const gates = core.filter((node) => node.gate).map((node) => node.id).sort();
  assert.deepEqual(gates, ["li.publish"], "publish waits for the defense verdict, nothing else waits on a review");
  for (const id of gates) {
    assert.ok(
      (byId.get(id).requires ?? []).some((rid) => byId.get(rid)?.signoff),
      `${id} must depend on a sign-off node, or the gate flag does nothing`
    );
  }
});
