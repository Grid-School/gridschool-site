import test from "node:test";
import assert from "node:assert/strict";
import { draftMap, draftRecord, routeFor, normalize, stepTitle, STAGES, ROLES, STOPS } from "./map-draft.js?v=dc96989-202610110117";
import { instanceErrors, resolveMap } from "../app/js/modules.js?v=dc96989-202610110117";
import { validateMap } from "../data/map-rules.mjs";
import { readLibrary } from "../data/module-library.mjs";

const library = readLibrary();
const every = [];
for (const stage of Object.keys(STAGES)) for (const role of Object.keys(ROLES)) for (const stop of Object.keys(STOPS)) every.push({ stage, role, stop });

test("every answer combination drafts a map the platform can publish", () => {
  for (const answers of every) {
    const map = draftMap(answers);
    const name = JSON.stringify(answers);
    assert.deepEqual(instanceErrors(map, library), [], name);
    assert.deepEqual(validateMap(resolveMap(map, library)), [], name);
    const ids = map.nodes.map((node) => node.id);
    assert.equal(new Set(ids).size, ids.length, `${name} has duplicate ids`);
    assert.ok(map.nodes.length >= 8 && map.nodes.length <= 14, `${name} has ${map.nodes.length} steps`);
    for (const phase of ["position", "prove", "land"]) assert.ok(map.nodes.some((node) => node.phase === phase), `${name} empty ${phase}`);
    assert.equal(map.nodes.at(-1).id, "iv.defense", `${name} ends at the defense`);
  }
});

test("rendered words obey the copy law", () => {
  for (const answers of every) {
    for (const node of draftMap(answers).nodes) {
      const title = stepTitle(node, library);
      assert.ok(!title.includes("—"), title);
      assert.ok(title.length <= 120, title);
    }
  }
});

test("routes match the call cheat sheet", () => {
  assert.equal(routeFor({ stage: "grad", stop: "technical" }), "build");
  assert.equal(routeFor({ stage: "self", stop: "replies" }), "build");
  assert.equal(routeFor({ stage: "working", stop: "replies" }), "career-first");
  assert.equal(routeFor({ stage: "working", stop: "final" }), "defense-first");
  assert.equal(routeFor({ stage: "laidoff", stop: "technical" }), "career-first, sprint");
});

test("the map follows the answers", () => {
  const grad = draftMap({ stage: "grad", role: "backend", stop: "replies" });
  assert.ok(grad.nodes.some((node) => node.module === "reviewed-change@1"));
  const working = draftMap({ stage: "working", role: "ai", stop: "technical" });
  assert.ok(!working.nodes.some((node) => node.module === "inherited-codebase@1"));
  assert.ok(working.nodes.some((node) => node.module === "build-agentic-feature@1"));
  const laidoff = draftMap({ stage: "laidoff", role: "frontend", stop: "screen" });
  assert.equal(laidoff.nodes.find((node) => node.phase === "position" && node.family === "pipeline").module, "application-engine@1");
});

test("bad input falls back instead of failing", () => {
  assert.deepEqual(normalize({ stage: "<script>", role: 4 }), { stage: "working", role: "fullstack", stop: "technical" });
  assert.ok(draftMap({}).nodes.length);
});

test("the apply record is small and names every step", () => {
  const map = draftMap({ stage: "working", role: "ai", stop: "technical" });
  const record = draftRecord(map);
  assert.equal(record.route, "defense-first");
  assert.equal(record.steps.length, map.nodes.length);
  assert.ok(JSON.stringify(record).length < 2000);
});

test("every map says who checks each step, and the defense is judged outside", async () => {
  const { checkOf, checkSummary, CHECK } = await import("./map-draft.js?v=dc96989-202610110117");
  for (const answers of every) {
    const map = draftMap(answers);
    assert.equal(map.nodes.filter((node) => checkOf(node) === CHECK.OUTSIDE).length, 1);
    assert.ok(map.nodes.filter((node) => checkOf(node) === CHECK.ADEN).length >= map.nodes.length / 2);
  }
  assert.match(checkSummary(draftMap({ stage: "working", role: "ai", stop: "technical" }).nodes), /^\d+ reviewed by me · 1 judged by an outside engineer · \d+ you run alone$/);
});
