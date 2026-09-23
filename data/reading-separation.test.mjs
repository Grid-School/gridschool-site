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

test("each standalone reading defines GridGlade on first use", () => {
  for (const name of files) {
    const text = readFileSync(join(sourceDir, name), "utf8");
    const firstUse = text.indexOf("GridGlade");
    if (firstUse < 0) continue;

    const paragraphStart = text.lastIndexOf("\n\n", firstUse) + 2;
    const nextBreak = text.indexOf("\n\n", firstUse);
    const paragraphEnd = nextBreak < 0 ? text.length : nextBreak;
    const firstParagraph = text.slice(paragraphStart, paragraphEnd);

    assert.match(
      firstParagraph,
      /shared multiplayer game/i,
      `${name} uses GridGlade before explaining that it is the shared multiplayer game`,
    );
  }
});
