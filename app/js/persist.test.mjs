import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  clear,
  patchStudent,
  patchInstructor,
  requestReview,
  listEvents,
  mergeStudent,
  read,
  ATTENTION_KINDS,
  STUDENT_KEYS,
  INSTRUCTOR_KEYS,
} from "./persist.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../data");
const demo = JSON.parse(readFileSync(join(root, "students/demo.json"), "utf8"));

/** Minimal localStorage for node tests. */
function installMemoryStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

installMemoryStorage();

test("mergeStudent + export keys match demo.json shape", () => {
  const merged = mergeStudent(demo, {
    evidence: { "or.start": { url: "https://example.com/note", at: "2026-08-30" } },
    focus: "Ship the note",
  });
  for (const key of [
    "slug",
    "name",
    "cohort",
    "joined",
    "evidence",
    "tasks",
    "reviews",
    "focus",
    "next",
  ]) {
    assert.ok(key in merged, `missing ${key}`);
  }
  assert.equal(merged.evidence["or.start"].url, "https://example.com/note");
  assert.equal(merged.focus, "Ship the note");
  assert.equal(merged.slug, demo.slug);
});

test("instructor return does not clobber layout", () => {
  const slug = "t-layout";
  clear(slug);
  patchStudent(slug, {
    layout: { "or.start": { x: 10, y: 20 } },
    evidence: { "or.start": { url: "https://example.com/a", at: "2026-08-30" } },
  });
  patchInstructor(slug, {
    reviews: [{ id: "rv-1", state: "returned", verdict: "Ship it.", ccvv: {} }],
    focus: "Next PR",
  });
  const flat = read(slug);
  assert.deepEqual(flat.layout["or.start"], { x: 10, y: 20 });
  assert.equal(flat.evidence["or.start"].url, "https://example.com/a");
  assert.equal(flat.reviews[0].state, "returned");
  assert.equal(flat.focus, "Next PR");
});

test("student evidence does not clobber reviews", () => {
  const slug = "t-reviews";
  clear(slug);
  patchInstructor(slug, {
    reviews: [{ id: "rv-1", state: "returned", verdict: "Good.", ccvv: {} }],
    next: "Defend",
  });
  patchStudent(slug, {
    evidence: { "cap.change": { url: "https://example.com/pr", at: "2026-08-30" } },
  }, { kind: "evidence.submitted", payload: { nodeId: "cap.change" } });
  const flat = read(slug);
  assert.equal(flat.reviews[0].id, "rv-1");
  assert.equal(flat.next, "Defend");
  assert.equal(flat.evidence["cap.change"].url, "https://example.com/pr");
});

test("task toggle is silent; evidence URL is attention", () => {
  const slug = "t-events";
  clear(slug);
  patchStudent(
    slug,
    { tasks: { "or.start.law": { state: "done", at: "2026-08-30" } } },
    { kind: "task.toggled", payload: { taskId: "or.start.law" } }
  );
  patchStudent(
    slug,
    { evidence: { "or.start": { url: "https://example.com/n", at: "2026-08-30" } } },
    { kind: "evidence.submitted", payload: { nodeId: "or.start" } }
  );
  const all = listEvents(slug);
  const attention = listEvents(slug, { attentionOnly: true });
  assert.equal(all.some((e) => e.kind === "task.toggled"), true);
  assert.equal(all.some((e) => e.kind === "evidence.submitted"), true);
  assert.equal(
    attention.every((e) => ATTENTION_KINDS.has(e.kind)),
    true
  );
  assert.equal(
    attention.some((e) => e.kind === "task.toggled"),
    false
  );
  assert.equal(
    attention.some((e) => e.kind === "evidence.submitted"),
    true
  );
});

test("requestReview appends without wiping prior returns", () => {
  const slug = "t-request";
  clear(slug);
  patchInstructor(slug, {
    reviews: [{ id: "rv-old", state: "returned", verdict: "Prior.", ccvv: {} }],
  });
  requestReview(slug, { id: "rv-new", title: "First ticket", nodeId: "cap.change" });
  const flat = read(slug);
  assert.equal(flat.reviews[0].id, "rv-new");
  assert.equal(flat.reviews[0].state, "in-review");
  assert.equal(flat.reviews[1].id, "rv-old");
  assert.equal(flat.reviews[1].state, "returned");
  assert.equal(
    listEvents(slug, { attentionOnly: true }).some((e) => e.kind === "review.requested"),
    true
  );
});

test("legacy overlay.v1 migrates into split persist without data loss", () => {
  const slug = "t-migrate";
  clear(slug);
  const legacy = {
    evidence: { "or.start": { url: "https://example.com/old", at: "2026-08-01" } },
    layout: { "or.start": { x: 1, y: 2 } },
    focus: "Legacy focus",
    reviews: [{ id: "rv-leg", state: "returned", verdict: "ok", ccvv: {} }],
  };
  localStorage.setItem(`gridschool.overlay.v1.${slug}`, JSON.stringify(legacy));
  const flat = read(slug);
  assert.equal(flat.evidence["or.start"].url, "https://example.com/old");
  assert.deepEqual(flat.layout["or.start"], { x: 1, y: 2 });
  assert.equal(flat.focus, "Legacy focus");
  assert.equal(flat.reviews[0].id, "rv-leg");
  // Student patch after migrate must not wipe instructor fields from legacy.
  patchStudent(slug, {
    tasks: { "or.start.law": { state: "done", at: "2026-08-30" } },
  });
  const after = read(slug);
  assert.equal(after.focus, "Legacy focus");
  assert.equal(after.reviews[0].id, "rv-leg");
  assert.equal(after.tasks["or.start.law"].state, "done");
});

test("question notes are attention; layout changes are not", () => {
  const slug = "t-question";
  clear(slug);
  patchStudent(
    slug,
    {
      memory: { notes: [{ id: "n1", text: "? How does deploy work?", at: "2026-08-30" }], files: [] },
      questions: [{ id: "q1", text: "? How does deploy work?", at: "2026-08-30" }],
    },
    { kind: "question.asked", payload: { text: "? How does deploy work?" } }
  );
  patchStudent(
    slug,
    { layout: { "pf.runs": { x: 40, y: 80 } } },
    { kind: "layout.changed", payload: { nodeId: "pf.runs" } }
  );
  const attention = listEvents(slug, { attentionOnly: true });
  assert.equal(attention.some((e) => e.kind === "question.asked"), true);
  assert.equal(attention.some((e) => e.kind === "layout.changed"), false);
  assert.equal(read(slug).layout["pf.runs"].y, 80);
});

test("two-writer simulation: student laptop and Aden console stay coherent", () => {
  const slug = "t-two-writer";
  clear(slug);
  // Student machine
  patchStudent(slug, {
    layout: { "cap.change": { x: 100, y: 200 } },
    evidence: { "cap.change": { url: "https://github.com/example/pr/1", at: "2026-08-30" } },
  }, { kind: "evidence.submitted", payload: { nodeId: "cap.change" } });
  requestReview(slug, { id: "rv-ship", title: "First ticket", nodeId: "cap.change" });
  // Aden console on another "session" — only instructor patch
  patchInstructor(slug, {
    focus: "Tighten the failure log",
    next: "Write the stranger check",
    reviews: [
      {
        id: "rv-ship",
        state: "returned",
        title: "First ticket",
        nodeId: "cap.change",
        verdict: "Good change. Name the refusal.",
        ccvv: { communication: 4, comprehension: 4, vision: 5, verification: 3 },
      },
    ],
  }, { kind: "review.returned", payload: { reviewId: "rv-ship" } });
  // Student saves a task after Aden returned — must keep the return
  patchStudent(slug, {
    tasks: { "cap.change.evidence": { state: "done", at: "2026-08-30" } },
  }, { kind: "task.toggled", payload: { taskId: "cap.change.evidence" } });

  const flat = read(slug);
  assert.equal(flat.layout["cap.change"].x, 100);
  assert.equal(flat.evidence["cap.change"].url, "https://github.com/example/pr/1");
  assert.equal(flat.focus, "Tighten the failure log");
  assert.equal(flat.next, "Write the stranger check");
  assert.equal(flat.reviews[0].state, "returned");
  assert.equal(flat.reviews[0].verdict.includes("refusal"), true);
  assert.equal(flat.tasks["cap.change.evidence"].state, "done");

  const attention = listEvents(slug, { attentionOnly: true }).map((e) => e.kind);
  assert.equal(attention.includes("evidence.submitted"), true);
  assert.equal(attention.includes("review.requested"), true);
  assert.equal(attention.includes("review.returned"), false);
  assert.equal(attention.includes("task.toggled"), false);
});
