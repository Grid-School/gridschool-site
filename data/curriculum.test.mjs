/**
 * Static invariants over every map the board can load.
 *
 * Part one runs over the universal demo map (curriculum.json) AND every
 * student map in maps/*.json: the structural rules a map must meet to be
 * walkable at all (map-rules.mjs, the JS twin of site/server/maps.py), plus
 * task shape, side quests staying optional, and a clean walk of the required
 * path. No map's ids are hard-coded there.
 *
 * Part two is the demo map's content contract (ops/curriculum-operating-plan.md
 * §1.3, ops/founding-path-audit.md §A): per-node proves/video/review fields,
 * the reading catalog, and copy rules, so a node without a falsification line
 * or a summary cannot land on the demo board by accident.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MODES } from "../app/js/modes.js?v=b6ca108-202610080352";
import { ARTIFACTS } from "../app/js/artifacts.js?v=b6ca108-202610080352";
import { walkReadings } from "../app/js/reading-order.js?v=b6ca108-202610080352";
import { buildGraph, STATUS, isSpine, nextUp, ancestorsOf } from "../app/js/graph/model.js?v=b6ca108-202610080352";
import { validateMap } from "./map-rules.mjs";
import { resolveMap, instanceErrors } from "../app/js/modules.js?v=b6ca108-202610080352";
import { readLibrary } from "./module-library.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const cur = readJson(join(here, "curriculum.json"));
const catalog = readJson(join(site, "read/catalog.json"));

// Student maps place library modules; every rule below runs on the map the
// board draws, i.e. after resolving (modules.js), and the instances
// themselves must be valid (known module, fills only in declared slots).
const LIBRARY = readLibrary();
const STORED = readdirSync(join(here, "maps"))
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => [`maps/${name}`, readJson(join(here, "maps", name))]);
const MAPS = [["curriculum.json", cur], ...STORED.map(([name, map]) => [name, resolveMap(map, LIBRARY)])];

for (const [name, map] of STORED) {
  test(`${name}: every module step names a library module and fills only its declared slots`, () => {
    assert.deepEqual(instanceErrors(map, LIBRARY), []);
  });
}

function shapeOf(map) {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const familyTrack = new Map((map.families ?? []).map((family) => [family.id, family.track]));
  const trackOf = (node) => node.track ?? familyTrack.get(node.family);
  const core = map.nodes.filter((node) => node.kind !== "future");
  return { byId, familyTrack, trackOf, core, spine: core.filter((node) => trackOf(node) === "spine") };
}

/** Light a node the way a student would: answers for in-app steps, a URL and an accepted review otherwise. */
function light(student, node) {
  if (node.completion === "tasks") {
    for (const task of node.tasks ?? []) {
      if (task.kind === "count") continue;
      const answers = {};
      for (const field of task.fields ?? []) {
        if (field.required) answers[field.id] = "walk answer";
      }
      student.tasks[task.id] = { state: "done", answers };
    }
    return;
  }
  student.evidence[node.id] = { url: `https://example.test/${node.id}` };
  if (node.signoff) {
    student.reviews.unshift({
      id: `walk-${node.id}`,
      nodeId: node.id,
      state: "returned",
      outcome: "accepted",
      link: student.evidence[node.id].url,
    });
  }
}

const RETIRED_GAME = /GridGlade|GridSeak|play\.gridschool|world server|ticket board|multiplayer|\bthe world\b/i;
const RETIRED_STAGE = /\bStage\b/; // the game's staging world, capitalised; "a pipeline stage" is fine

for (const [name, map] of MAPS) {
  const { byId, trackOf, core, spine } = shapeOf(map);

  test(`${name}: meets the map rules (ids, families, requires, acyclic, n order, side quests, task ids)`, () => {
    assert.deepEqual(validateMap(map), []);
  });

  test(`${name}: every task has a title, a kind, and a done-when; habits are well-formed`, () => {
    for (const node of core) {
      for (const task of node.tasks ?? []) {
        assert.ok(task.title?.trim(), `${node.id} task ${task.id} title`);
        assert.ok(task.kind?.trim(), `${node.id} task ${task.id} kind`);
        assert.ok(task.done_when?.trim(), `${node.id} task ${task.id} done_when`);
        if (task.kind === "count") {
          assert.ok(Number.isInteger(task.target) && task.target >= 1, `${task.id} target`);
          assert.ok(["day", "week"].includes(task.per), `${task.id} per`);
        }
      }
    }
  });

  test(`${name}: every core node has a why, an evidence line, and at least one task`, () => {
    for (const node of core) {
      assert.ok(node.why?.trim(), `${node.id} why`);
      assert.ok(node.evidence?.trim(), `${node.id} evidence`);
      assert.ok(Array.isArray(node.tasks) && node.tasks.length, `${node.id} tasks`);
    }
  });

  test(`${name}: side quests are never required, never next, and never gate a core node`, () => {
    for (const node of map.nodes) {
      if (trackOf(node) === "side") continue;
      for (const req of node.requires ?? []) {
        assert.notEqual(trackOf(byId.get(req)), "side", `${node.id} requires side quest ${req}`);
      }
    }
    const graph = buildGraph(map, { evidence: {}, tasks: {}, reviews: [] });
    assert.notEqual(nextUp(graph)?.track, "side", "a side quest is never the next step");
  });

  test(`${name}: no required node waits on an elective`, () => {
    const spineIds = new Set(spine.map((node) => node.id));
    for (const node of spine) {
      for (const req of node.requires ?? []) {
        assert.ok(spineIds.has(req), `${node.id} (required) depends on ${req} (elective)`);
      }
    }
  });

  test(`${name}: a fresh board opens at least one required node`, () => {
    assert.ok(spine.some((node) => !(node.requires ?? []).length), "no required node is open on day one");
  });

  test(`${name}: the required path can be walked to the end in board order, never a wide fan-out`, () => {
    const student = { evidence: {}, tasks: {}, reviews: [] };
    const seen = [];
    while (seen.length < spine.length) {
      const graph = buildGraph(map, student);
      const openSpine = graph.nodes.filter((node) => node.status === STATUS.OPEN && isSpine(node) && node.kind !== "future");
      assert.ok(openSpine.length <= 8, `open required ${openSpine.map((n) => n.id).join(", ")}`);
      const next = nextUp(graph);
      assert.ok(next && isSpine(next), `required path stalled after ${seen.join(" -> ") || "(start)"}`);
      const dark = [...ancestorsOf(graph, next.id)].filter((id) => graph.byId.get(id)?.status !== STATUS.LIT);
      assert.deepEqual(dark, [], `${next.id} is next but its ancestors are dark`);
      light(student, next);
      seen.push(next.id);
    }
  });

  test(`${name}: future nodes carry an availability line and no actionable work`, () => {
    for (const node of map.nodes.filter((item) => item.kind === "future")) {
      assert.ok(node.coming?.trim(), `${node.id} needs a coming line`);
      assert.equal((node.tasks ?? []).length, 0, `${node.id} must not assign tasks`);
    }
  });

  test(`${name}: names only the two Discord rooms and never the retired game`, () => {
    const allowed = new Set(["#asks", "#ship"]);
    for (const node of core) {
      const text = studentFacingNodeText(node);
      for (const hit of text.match(/(?<![\w&])#[a-z][a-z0-9-]*/gi) ?? []) {
        assert.ok(allowed.has(hit.toLowerCase()), `${node.id} names unsupported channel ${hit}`);
      }
      assert.doesNotMatch(text, RETIRED_GAME, `${node.id} still points at the retired game`);
      assert.doesNotMatch(text, RETIRED_STAGE, `${node.id} still sends students to Stage`);
    }
    assert.ok(!(map.families ?? []).some((family) => family.id === "world"), "the world family is retired");
    assert.ok(!map.nodes.some((node) => node.id.startsWith("wd.")), "wd.* nodes are retired");
    assert.doesNotMatch(String(map.law ?? ""), RETIRED_GAME);
  });
}

test("the map rules catch what the board cannot recover from", () => {
  const base = () => ({
    version: "t",
    title: "t",
    families: [{ id: "a", track: "spine" }, { id: "s", track: "side" }],
    phases: [],
    weekly: [],
    nodes: [
      { id: "x", n: 1, title: "x", family: "a", requires: [], tasks: [{ id: "x.1" }], kind: "core" },
      { id: "y", n: 2, title: "y", family: "a", requires: ["x"], tasks: [], kind: "core" },
      { id: "q", n: 101, title: "q", family: "s", requires: [], tasks: [], kind: "core" },
    ],
  });
  assert.deepEqual(validateMap(base()), []);
  const broken = (mutate) => {
    const doc = base();
    mutate(doc);
    return validateMap(doc).join("\n");
  };
  assert.match(broken((d) => (d.nodes[1].requires = ["nope"])), /does not exist/);
  assert.match(broken((d) => (d.nodes[0].requires = ["y"])), /cycle/);
  assert.match(broken((d) => (d.nodes[1].n = 1)), /already used|must be greater/);
  assert.match(broken((d) => (d.nodes[1].requires = ["q"])), /cannot require side quest/);
  assert.match(broken((d) => (d.nodes[1].family = "ghost")), /does not exist/);
  assert.match(broken((d) => d.nodes[1].tasks.push({ id: "x.1" })), /used twice/);
  assert.match(broken((d) => d.nodes[1].tasks.push({ id: "h", kind: "count", target: 0, per: "month" })), /target[\s\S]*per/);
});

/* ---------- the demo map's content contract ---------- */

const { byId, familyTrack, trackOf, core, spine } = shapeOf(cur);
const nodes = cur.nodes;

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

test("sign-off steps carry a rubric, and the defense does not wait on the owned system", () => {
  const signoff = nodes.filter((node) => node.signoff);
  assert.ok(signoff.length >= 1);
  for (const node of signoff) {
    assert.ok(node.reviewFor, `${node.id} signoff needs reviewFor so the sign-off has a rubric`);
  }
  assert.ok(!byId.get("cap.defend").requires.some((r) => r.startsWith("pj.")), "the defense must not wait on the owned system");
});

function ancestors(id, seen = new Set()) {
  for (const req of byId.get(id).requires ?? []) {
    if (seen.has(req)) continue;
    seen.add(req);
    ancestors(req, seen);
  }
  return seen;
}

test("the machine comes first: It runs and the weekly loop wait on Your machine", () => {
  assert.deepEqual(byId.get("or.setup").requires, ["or.start"]);
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

test("the first ticket sits downstream of the weekly loop", () => {
  assert.ok(ancestors("cap.change").has("ops.flow"), "cap.change must sit downstream of ops.flow");
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

test("the project menu and templates are attached to Choose the stack", () => {
  const ids = (byId.get("fs.choose").modules ?? []).map((module) => module.id);
  assert.ok(ids.includes("projects/menu"), "project menu reading");
  assert.ok(ids.includes("kit/README"), "project templates reading");
});
