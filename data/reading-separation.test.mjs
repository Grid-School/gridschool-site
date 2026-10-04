/**
 * Discipline readings are portable articles. Assignments, scoring, and
 * course navigation stay in curriculum.json and the step page.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const sourceDir = join(root, "content/disciplines");
const catalog = JSON.parse(readFileSync(join(here, "../read/catalog.json"), "utf8"));
const files = readdirSync(sourceDir).filter((name) => name.endsWith(".md")).sort();

const COURSE_ONLY = [
  [/\*Series:\s*disciplines/i, "series syllabus lead"],
  [/\bRead before\b/i, "read-before course navigation"],
  [/\bRead in week\b/i, "week navigation"],
  [/\bthe Map\b/, "curriculum Map"],
  [/\beight-week intensive\b/i, "cohort offer language"],
  [/\bYou pass when\b/i, "pass condition rubric"],
  [/\breview sheet\b/i, "review-sheet scoring"],
  [/\bscore vector\b/i, "program score vector"],
  [/^##\s+Do this now\b/im, "homework heading"],
  [/^##\s+Done when\b/im, "completion heading"],
  [/^##\s+What'?s next\b/im, "course next heading"],
  [/\*\*Done when\*\*/i, "inline completion"],
  [/\bGate 5\b/, "undefined Gate 5"],
  [/\bthis program grades\b/i, "program grading voice"],
  [/\bevery step on the Map\b/i, "Map assignment voice"],
  [/\bthis program\b/i, "course program voice"],
  [/\byou pass\b/i, "pass-condition voice"],
  [/^```mermaid\b/im, "mermaid diagram spine"],
  [/\bWorld\b/, "retired game name World"],
];

test("every discipline source file has a catalog entry", () => {
  const ids = new Set((catalog.modules ?? []).map((mod) => mod.id));
  assert.equal(files.length, 24);
  for (const name of files) {
    const id = `disciplines/${name.replace(/\.md$/, "")}`;
    assert.ok(ids.has(id), `${id} missing from catalog`);
  }
});

test("discipline readings keep homework and course scoring out of the article", () => {
  for (const name of files) {
    const text = readFileSync(join(sourceDir, name), "utf8");
    for (const [pattern, label] of COURSE_ONLY) {
      pattern.lastIndex = 0;
      assert.doesNotMatch(text, pattern, `${name} still has ${label}`);
    }
  }
});

test("no reading points at the retired multiplayer game", () => {
  // GridGlade (and GridSeak before it) was the shared game students used to
  // change. Students now ship to their own project; a small multiplayer game
  // may still appear as a hypothetical example, but never as a place to go.
  const retired = /GridGlade|GridSeak|play\.gridschool|world[- ]server|shared multiplayer game|#world\b|#bugs\b/i;
  const dirs = ["disciplines", "readings", "student-zero", "nanograph", "briefs"];
  for (const dir of dirs) {
    const path = join(root, "content", dir);
    for (const name of readdirSync(path).filter((file) => file.endsWith(".md"))) {
      const text = readFileSync(join(path, name), "utf8");
      assert.doesNotMatch(text, retired, `${dir}/${name} still points at the retired game`);
      assert.doesNotMatch(text, /\bStage\b/, `${dir}/${name} still sends students to Stage`);
    }
  }
});

test("the public reading mirror matches its source for every discipline", () => {
  for (const name of files) {
    const source = readFileSync(join(sourceDir, name), "utf8");
    const mirror = readFileSync(join(here, "../read/modules/disciplines", name), "utf8");
    assert.equal(mirror, source, `${name}: run ops/sync-reading.sh`);
  }
});
