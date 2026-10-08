import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  resolveMap,
  fillErrors,
  instanceErrors,
  moduleRefs,
  loadModules,
  resolveWithLibrary,
  SLOTS,
} from "./modules.js?v=b6ca108-202610080352";
import { validateMap } from "../../data/map-rules.mjs";
import { boardCurriculum } from "./api.js?v=b6ca108-202610080352";
import { readLibrary, MODULE_DIR } from "../../data/module-library.mjs";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const CASES = readJson(join(site, "server/testdata/modules-cases.json"));

for (const c of CASES.resolve) {
  test(`shared resolve case: ${c.name}`, () => {
    const resolved = resolveMap(c.map, CASES.library);
    assert.deepEqual(resolved, c.resolved);
    assert.deepEqual(validateMap(resolved), []);
  });
}

for (const c of CASES.fill) {
  test(`shared fill case: ${c.name}`, () => {
    assert.deepEqual(fillErrors(c.fill, CASES.library[c.module]), c.errors);
  });
}

for (const c of CASES.instances) {
  test(`shared instance case: ${c.name}`, () => {
    assert.deepEqual(instanceErrors(c.map, CASES.library), c.errors);
  });
}

test("a legacy map comes back as the same object; the stored map is never mutated", () => {
  const legacy = CASES.resolve[0].map;
  assert.equal(resolveMap(legacy, CASES.library), legacy);
  const mixed = structuredClone(CASES.resolve[1].map);
  const before = JSON.stringify(mixed);
  resolveMap(mixed, CASES.library);
  assert.equal(JSON.stringify(mixed), before);
});

test("moduleRefs lists each module once, in first-use order", () => {
  assert.deepEqual(moduleRefs(CASES.resolve[1].map), ["kit@1", "read@1"]);
  assert.deepEqual(moduleRefs(CASES.resolve[0].map), []);
  assert.deepEqual(moduleRefs(null), []);
});

test("loadModules fetches each ref once and leaves out what fails, so the step shows as missing", async () => {
  const asked = [];
  const fetcher = async (url) => {
    asked.push(String(url));
    const ref = String(url).split("/").pop().replace(/\.json$/, "");
    if (ref === "kit@1") return { ok: true, json: async () => CASES.library["kit@1"] };
    return { ok: false, json: async () => null };
  };
  const base = new URL("https://example.test/data/modules/");
  const library = await loadModules(["kit@1", "kit@1", "nope@1", "not a ref"], { fetcher, base });
  assert.deepEqual(Object.keys(library), ["kit@1"]);
  assert.deepEqual(asked, ["https://example.test/data/modules/kit@1.json", "https://example.test/data/modules/nope@1.json"]);
  const map = { ...CASES.resolve[2].map };
  const resolved = await resolveWithLibrary(map, { fetcher, base });
  const ghost = resolved.nodes.find((node) => node.id === "n.ghost");
  assert.equal(ghost.title, "Missing module ghost@1");
  assert.match(ghost.why, /not in the library/);
});

test("boardCurriculum resolves a student's map before numbering readings and applying copy edits", () => {
  const universal = { nodes: [{ id: "u.1", n: 1, tasks: [] }] };
  const map = CASES.resolve[1].map;
  const out = boardCurriculum({
    universal,
    student: { map },
    slug: "zed",
    library: CASES.library,
    overrides: { copy: { nodes: { "n.kit": { title: "Edited" } } } },
  });
  const kit = out.nodes.find((node) => node.id === "n.kit");
  assert.equal(kit.title, "Edited");
  assert.deepEqual(kit.tasks.map((task) => task.id), ["n.kit.voice", "n.kit.habit"]);
  assert.equal(kit.fromAden.due, "2026-10-10");
  assert.match(kit.modules[0].title, /^01 · /); // numbered after resolve
  assert.ok(out.readingOrder.some((row) => row.id === "nanograph/09-context-packing"));
  // No library loaded: the step still shows, as a placeholder.
  const bare = boardCurriculum({ universal, student: { map }, slug: "zed", overrides: {} });
  assert.equal(bare.nodes.find((node) => node.id === "n.kit").title, "Missing module kit@1");
});

test("every module file is general, well formed, and listed in index.json", () => {
  const library = readLibrary();
  const refs = Object.keys(library);
  assert.ok(refs.length >= 16, `only ${refs.length} modules`);
  const lanes = new Set(["proof", "presence", "network", "pipeline", "interview", "side"]);
  for (const [ref, module] of Object.entries(library)) {
    assert.equal(`${module.id}@${module.version}`, ref);
    assert.ok(lanes.has(module.lane), `${ref}: lane`);
    assert.ok(module.slots.every((slot) => SLOTS.includes(slot)), `${ref}: slots`);
    for (const task of module.tasks) assert.match(task.id, /^[a-z0-9-]+$/, `${ref}: task ids are local`);
    assert.doesNotMatch(JSON.stringify(module), /calixte/i, `${ref} must stay general`);
  }
  const index = readJson(join(MODULE_DIR, "index.json"));
  const latest = new Map();
  for (const module of Object.values(library)) {
    if (!latest.has(module.id) || module.version > latest.get(module.id).version) latest.set(module.id, module);
  }
  assert.deepEqual(
    [...index.modules].sort((a, b) => a.id.localeCompare(b.id)),
    [...latest.values()]
      .map(({ id, version, title, lane, purpose }) => ({ id, version, title, lane, purpose }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
});

