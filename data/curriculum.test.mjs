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
import { ARTIFACTS } from "../app/js/artifacts.js";
import { walkReadings } from "../app/js/reading-order.js";

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
const SURFACE_FILES = {
  start: join(site, "start/start.js"),
  coachCorpus: join(here, "coach-corpus.md"),
  coachPrompt: join(here, "coach-prompt.md"),
  admin: join(site, "admin/panels.js"),
};
const surfaces = Object.fromEntries(
  Object.entries(SURFACE_FILES).map(([name, path]) => [name, readFileSync(path, "utf8")])
);

function studentFacingNodeText(node) {
  return JSON.stringify({
    title: node.title,
    why: node.why,
    evidence: node.evidence,
    reviewFor: node.reviewFor,
    reading: node.reading,
    coming: node.coming,
    lesson: node.lesson,
    proves: node.proves,
    video: { summary: node.video?.summary },
    tasks: (node.tasks ?? []).map((task) => ({
      title: task.title,
      why: task.why,
      how: task.how,
      done_when: task.done_when,
      fields: (task.fields ?? []).map((field) => ({
        label: field.label,
        placeholder: field.placeholder,
        hint: field.hint,
      })),
    })),
  });
}

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

test("catalog walk numbers follow the board", () => {
  const { indexById } = walkReadings(cur);
  const all = [...(catalog.modules ?? []), ...(catalog.briefs ?? []), ...(catalog.readings ?? [])];
  for (const mod of all) {
    const row = indexById.get(mod.id);
    if (!row) {
      assert.equal(mod.walk, undefined, `${mod.id} is not on the board and should not carry a walk number`);
      continue;
    }
    assert.equal(mod.walk, row.n, `${mod.id} walk ${mod.walk} != board ${row.n}`);
  }
});

test("catalog titles match the source reading headings", () => {
  const all = [...(catalog.modules ?? []), ...(catalog.briefs ?? []), ...(catalog.readings ?? [])];
  for (const mod of all) {
    const [series, ...nameParts] = mod.id.split("/");
    const name = `${nameParts.join("/")}.md`;
    const authored = join(site, "..", "content", series, name);
    const included = join(site, "..", "included-tools/project-kit", name);
    const source = existsSync(authored) ? authored : included;
    assert.ok(existsSync(source), `${mod.id} has no source reading`);
    const heading = readFileSync(source, "utf8").match(/^#\s+(.+)$/m)?.[1];
    const bare = (title) => String(title ?? "").replace(/^\d{2}\s*·\s*/, "").trim();
    assert.equal(bare(mod.title), bare(heading), `${mod.id} title differs from its source heading`);
  }
});

test("completion guidance covers in-app, link, sign-off, and future steps", () => {
  const urlOnly = /\b(?:node|step)\s+lights?\s+(?:only\s+)?when\s+(?:a\s+)?URL exists\b/i;
  for (const [name, text] of Object.entries(surfaces)) {
    assert.doesNotMatch(text, urlOnly, `${name} still claims every step completes from a URL`);
  }
  for (const name of ["start", "coachCorpus", "coachPrompt", "admin"]) {
    const text = surfaces[name];
    assert.match(text, /in-app|answer(?:s)? in GridSchool/i, `${name} omits in-app completion`);
    assert.match(text, /save(?:d)? (?:one )?link|one (?:saved|required) link/i, `${name} omits link completion`);
    assert.match(text, /accepted review|accepts? the review/i, `${name} omits sign-off completion`);
    assert.match(text, /future steps?/i, `${name} omits future steps`);
  }
});

test("student-facing completion copy avoids retired instructions and operator terms", () => {
  const curriculumText = core.map(studentFacingNodeText).join("\n");
  const publicGuidance = [curriculumText, surfaces.start, surfaces.coachCorpus].join("\n");
  assert.doesNotMatch(publicGuidance, /\bDone when line\b/i);
  assert.doesNotMatch(publicGuidance, /\b(?:square|squares)\b/i);
  assert.doesNotMatch(
    publicGuidance,
    /\bnode ids?\b|\bspine\b|\blit\b|\bthe ledger\b|\bmap list\b|\bCMS\b|\bfilm brief\b/i
  );
});

test("the spine is the six gates, the foundations series, the mission, the Career core with last-mile proofs, the owned system through users, and the graph tool", () => {
  const expected = [
    "cap.change", "cap.defend", "cap.outcome", "cap.review", "cv.check", "cv.contain", "cv.delegate", "cv.four", "cv.frame", "cv.spec", "cv.understand", "fs.api", "fs.back", "fs.choose", "fs.data", "fs.front", "fs.map", "fs.observe", "fs.principles", "fs.ship", "gr.parse", "gr.query", "li.close", "li.publish", "ops.flow", "or.setup", "or.start", "pf.runs", "pf.style", "pj.model", "pj.ship", "pj.users", "sg.profile", "sg.scope", "sg.show", "sg.site", "wd.deploy", "wd.ticket",
  ];
  assert.deepEqual(spine.map((node) => node.id).sort(), [...expected].sort());
  assert.deepEqual(byId.get("or.setup").requires, ["or.start"]);
  assert.deepEqual(byId.get("cv.four").requires, ["or.setup"]);
  assert.deepEqual(byId.get("ops.flow").requires, ["cv.four"]);
  assert.deepEqual(byId.get("pf.runs").requires, ["ops.flow"]);
  assert.deepEqual(byId.get("fs.map").requires, ["pf.runs"]);
  assert.deepEqual(byId.get("fs.front").requires, ["fs.map"]);
  assert.deepEqual(byId.get("fs.back").requires, ["fs.map"]);
  assert.deepEqual([...byId.get("fs.data").requires].sort(), ["fs.back", "fs.front"]);
  assert.deepEqual(byId.get("fs.api").requires, ["fs.data"]);
  assert.deepEqual(byId.get("fs.ship").requires, ["fs.api"]);
  assert.deepEqual(byId.get("fs.observe").requires, ["fs.api"]);
  assert.deepEqual([...byId.get("fs.principles").requires].sort(), ["fs.observe", "fs.ship"]);
  assert.deepEqual(byId.get("fs.choose").requires, ["fs.principles"]);
  assert.deepEqual(byId.get("cv.understand").requires, ["fs.choose"]);
  assert.deepEqual(byId.get("cv.frame").requires, ["cv.understand"]);
  assert.deepEqual(byId.get("cv.spec").requires, ["cv.frame"]);
  assert.deepEqual(byId.get("cap.change").requires, ["cv.spec"]);
  assert.deepEqual([...byId.get("pj.model").requires].sort(), ["cv.spec", "fs.choose"]);
  assert.deepEqual(byId.get("pj.ship").requires, ["pj.model"]);
  assert.deepEqual([...byId.get("cap.defend").requires].sort(), ["cap.review", "cv.check", "cv.contain", "cv.delegate"]);
  assert.deepEqual([...byId.get("li.publish").requires].sort(), ["cap.defend", "sg.profile"]);
  for (const id of ["cap.defend"]) {
    assert.ok(!byId.get(id).requires.some((r) => r.startsWith("pj.")), `${id} must not wait on the owned system`);
  }
  assert.deepEqual(byId.get("sg.profile").requires, ["cap.change"]);
  assert.deepEqual(byId.get("pf.style").requires, ["sg.profile"]);
  assert.deepEqual(byId.get("sg.site").requires, ["pf.style"]);
  assert.deepEqual(byId.get("sg.scope").requires, ["sg.show"]);
  assert.deepEqual(byId.get("li.close").requires, ["sg.show"]);
});

test("Career expansion and the later project track never sit on the spine", () => {
  const depthOnly = ["sg.engine", "sg.post", "sg.habit", "sg.article", "sg.research", "sg.oss",
    "sg.resume", "sg.apply", "gr.structure", "gr.seam", "gr.pack", "gr.fork", "wd.mark"];
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

function ancestors(id, seen = new Set()) {
  for (const req of byId.get(id).requires ?? []) {
    if (seen.has(req)) continue;
    seen.add(req);
    ancestors(req, seen);
  }
  return seen;
}

test("the machine comes before the world: It runs and the weekly loop wait on Your machine", () => {
  assert.deepEqual(byId.get("or.setup").requires, ["or.start"]);
  assert.equal(byId.get("or.setup").n, 1);
  for (const id of ["pf.runs", "ops.flow"]) {
    assert.ok(ancestors(id).has("or.setup"), `${id} must wait on or.setup`);
  }
  assert.ok(byId.get("or.setup").modules?.some((m) => m.id === "readings/your-machine"), "the setup reading is attached");
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

test("Welcome is completed inside GridSchool and never asks for a throwaway document", () => {
  const welcome = byId.get("or.start");
  const text = JSON.stringify(welcome);
  assert.equal(welcome.completion, "tasks");
  assert.ok(welcome.tasks.length >= 4, "Welcome breaks first-run work into small tasks");
  assert.ok(welcome.tasks.some((task) => task.fields?.some((field) => field.required)), "Welcome accepts answers in the app");
  assert.doesNotMatch(text, /Google doc|gist|board rule|your two lines/i);
});

test("no task names an AI vendor or agent product: the map teaches the capability, not the tool of the month", () => {
  const vendor = /\b(Cursor|Claude|Codex|Copilot|OpenAI|Anthropic|Gemini|ChatGPT|LangChain|LangSmith|Langfuse|Devin|Windsurf)\b/;
  for (const node of core) {
    for (const task of node.tasks) {
      const text = [task.title, task.done_when, ...(task.how ?? [])].join(" ");
      assert.ok(!vendor.test(text), `${node.id} task ${task.id ?? task.title} names a vendor`);
    }
  }
});

test("artifact, when set, names one of the three things a student owns, and the three that create them carry it", () => {
  for (const node of nodes) {
    if (node.artifact !== undefined) assert.ok(ARTIFACTS[node.artifact], `${node.id} artifact ${node.artifact}`);
  }
  assert.equal(byId.get("cap.change").artifact, "ticket");
  assert.equal(byId.get("gr.parse").artifact, "graph");
  assert.equal(byId.get("cv.delegate").artifact, "script");
  assert.equal(byId.get("cv.contain").artifact, "script");
});

test("free material: at most two refs per node, each https with a title and a why, and none once the film exists", () => {
  for (const node of nodes) {
    const refs = node.refs ?? [];
    assert.ok(refs.length <= 2, `${node.id} has ${refs.length} refs; the rule is two`);
    for (const ref of refs) {
      assert.ok(ref.title?.trim(), `${node.id} ref title`);
      assert.ok(ref.why?.trim(), `${node.id} ref why`);
      assert.ok(/^https:\/\//.test(ref.href ?? ""), `${node.id} ref href ${ref.href}`);
    }
    if (node.video?.youtube) {
      assert.equal(refs.length, 0, `${node.id} is filmed and still carries refs; delete them the day the film ships`);
    }
  }
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

test("operational work and first ticket sit downstream of the weekly loop", () => {
  for (const id of ["cap.change", "wd.ticket", "wd.deploy"]) {
    assert.ok(ancestors(id).has("ops.flow"), `${id} must sit downstream of ops.flow`);
  }
});

test("project creation cannot precede project choice, and shipping cannot precede the model", () => {
  assert.ok(ancestors("pj.model").has("fs.choose"));
  assert.ok(ancestors("pj.ship").has("pj.model"));
  assert.ok(!byId.get("pj.ship").requires.includes("fs.ship"));
});

test("in-app nodes keep answers here and do not ask for a throwaway document", () => {
  const inApp = core.filter((node) => node.completion === "tasks");
  assert.ok(inApp.some((node) => node.id === "or.setup"));
  assert.ok(inApp.some((node) => node.id === "cv.four"));
  assert.ok(inApp.some((node) => node.id === "fs.choose"));
  for (const node of inApp) {
    const text = JSON.stringify({
      why: node.why,
      evidence: node.evidence,
      lesson: node.lesson,
      tasks: node.tasks,
    });
    assert.doesNotMatch(text, /Google doc|\b(?:public\s+)?gist\b/i, `${node.id} still sends the student to a throwaway document`);
    assert.ok(
      (node.tasks ?? []).some((task) => (task.fields ?? []).some((field) => field.required)),
      `${node.id} should collect at least one required answer on the page`
    );
  }
});

test("student-facing lesson copy does not leak node ids, film notes, or operator shorthand", () => {
  const banned = /#\/map\/|content\/|included-tools\/|the kit\b|the ledger\b|map list|Aden,|on camera|film brief|CMS|\b(?:public\s+)?gist\b|Google doc/i;
  const idTalk = /\b(or|cv|fs|pf|pj|gr|wd|sg|li|cap)\.[a-z]+\b/;
  for (const node of core) {
    const text = studentFacingNodeText(node);
    assert.doesNotMatch(text, banned, `${node.id} leaks operator language`);
    assert.doesNotMatch(text, idTalk, `${node.id} names a node id in student copy`);
  }
});

test("student copy only names the four Discord rooms", () => {
  const allowed = new Set(["#asks", "#ship", "#bugs", "#world"]);
  for (const node of core) {
    const text = JSON.stringify({
      why: node.why,
      evidence: node.evidence,
      reviewFor: node.reviewFor,
      lesson: node.lesson,
      proves: node.proves,
      tasks: (node.tasks ?? []).map((task) => ({
        title: task.title,
        done_when: task.done_when,
        how: task.how,
        why: task.why,
      })),
    });
    for (const hit of text.match(/#[a-z][a-z0-9-]*/gi) ?? []) {
      assert.ok(allowed.has(hit.toLowerCase()), `${node.id} names unsupported channel ${hit}`);
    }
  }
});

test("open required work stays bounded: never a nine-way fan-out", async () => {
  const { buildGraph, STATUS, isSpine } = await import("../app/js/graph/model.js");
  const student = { evidence: {}, tasks: {}, reviews: [] };
  const light = (node) => {
    if (node.completion === "tasks") {
      student.tasks = student.tasks ?? {};
      for (const task of node.tasks ?? []) {
        const answers = {};
        for (const field of task.fields ?? []) {
          if (field.required) answers[field.id] = "bounded-open answer";
        }
        student.tasks[task.id] = { state: "done", answers };
      }
      return;
    }
    student.evidence[node.id] = { url: `https://example.test/${node.id}` };
    if (node.signoff) {
      student.reviews.unshift({
        id: `bound-${node.id}`,
        nodeId: node.id,
        state: "returned",
        outcome: "accepted",
        link: student.evidence[node.id].url,
      });
    }
  };
  let maxOpen = 0;
  for (let i = 0; i <= spine.length; i++) {
    const graph = buildGraph(cur, student);
    const openSpine = graph.nodes.filter(
      (node) => node.status === STATUS.OPEN && isSpine(node) && node.kind !== "future"
    );
    maxOpen = Math.max(maxOpen, openSpine.length);
    assert.ok(openSpine.length <= 6, `open spine ${openSpine.map((n) => n.id).join(", ")}`);
    const next = openSpine.sort((a, b) => a.n - b.n)[0];
    if (!next) break;
    light(next);
  }
  assert.ok(maxOpen >= 1);
});

test("future nodes carry an availability line and no actionable work", () => {
  const future = nodes.filter((node) => node.kind === "future");
  assert.ok(future.length >= 1);
  for (const node of future) {
    assert.ok(node.coming?.trim(), `${node.id} needs a coming line`);
    assert.equal((node.tasks ?? []).length, 0, `${node.id} must not assign tasks`);
  }
});

test("the project menu and templates are attached to Choose the stack", () => {
  const ids = (byId.get("fs.choose").modules ?? []).map((module) => module.id);
  assert.ok(ids.includes("projects/menu"), "project menu reading");
  assert.ok(ids.includes("kit/README"), "project templates reading");
});
