import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateCatalog,
  emptyState,
  answer,
  skip,
  applyPrefill,
  shouldAsk,
  chunkQuestions,
  nextQuestion,
  chunkDone,
  chunkProgress,
  chunkMinutes,
  bottlenecks,
  nextChunk,
  diagnosisMap,
  questionOf,
  SIGNALS,
} from "./intake.mjs?v=fc7db25-202610310827";

const catalog = JSON.parse(readFileSync(new URL("./questions.json", import.meta.url)));

const fill = (pairs) => Object.entries(pairs).reduce((state, [id, value]) => answer(state, id, value), emptyState());

test("the catalog is valid", () => {
  assert.deepEqual(validateCatalog(catalog), []);
});

test("no chunk can ask more than the rules allow, whatever the answers", () => {
  for (const chunk of catalog.chunks) {
    const all = catalog.questions.filter((q) => q.chunk === chunk.id);
    assert.ok(all.length <= catalog.rules.chunkMax, `${chunk.id} has ${all.length}`);
    assert.ok(chunkMinutes(all) <= 6, `${chunk.id} runs ${chunkMinutes(all)} minutes`);
  }
});

test("the free chunk stays short", () => {
  const asked = chunkQuestions(catalog, "c0", emptyState());
  assert.equal(asked.length, 6);
  assert.ok(chunkMinutes(asked) <= 2);
});

test("validation catches a broken edit", () => {
  const broken = structuredClone(catalog);
  broken.questions.push({ id: "bad", chunk: "c9", kind: "essay", prompt: "", affects: ["mood"] });
  broken.questions.push({ ...broken.questions[0] });
  const errors = validateCatalog(broken).join("\n");
  assert.match(errors, /chunk c9 does not exist/);
  assert.match(errors, /kind essay/);
  assert.match(errors, /affects must name lanes/);
  assert.match(errors, /duplicate id/);
});

test("validation refuses an askIf that reads a later chunk or a missing option", () => {
  const broken = structuredClone(catalog);
  questionOf(broken, "stage").askIf = [{ q: "urgency", in: ["now"] }];
  questionOf(broken, "bridge").askIf = [{ q: "urgency", in: ["yesterday"] }];
  const errors = validateCatalog(broken).join("\n");
  assert.match(errors, /stage: askIf reads urgency, which is asked later/);
  assert.match(errors, /bridge: askIf names an option/);
});

test("askIf: not asks while unknown, in waits", () => {
  const stop = questionOf(catalog, "stop");
  const bridge = questionOf(catalog, "bridge");
  assert.equal(shouldAsk(stop, {}), true);
  assert.equal(shouldAsk(stop, { apps: "none" }), false);
  assert.equal(shouldAsk(stop, { apps: "gt200" }), true);
  assert.equal(shouldAsk(bridge, {}), false);
  assert.equal(shouldAsk(bridge, { urgency: "now" }), true);
  assert.equal(shouldAsk(questionOf(catalog, "city"), { where: ["remote", "hybrid"] }), true);
  assert.equal(shouldAsk(questionOf(catalog, "city"), { where: ["remote"] }), false);
});

test("someone with no applications is never asked how far they get", () => {
  const state = fill({ apps: "none" });
  assert.ok(!chunkQuestions(catalog, "c0", state).some((q) => q.id === "stop"));
});

test("a chunk walks question by question and skips count as settled", () => {
  let state = emptyState();
  assert.equal(nextQuestion(catalog, "c0", state).id, "stage");
  state = answer(state, "stage", "working");
  state = skip(state, "role");
  assert.equal(nextQuestion(catalog, "c0", state).id, "level");
  assert.deepEqual(chunkProgress(catalog, "c0", state), { done: 2, total: 6 });
  for (const [id, value] of [["level", "mid"], ["months", "3to6"], ["apps", "gt200"], ["stop", "replies"]]) state = answer(state, id, value);
  assert.equal(chunkDone(catalog, "c0", state), true);
  state = answer(state, "role", "backend");
  assert.ok(!state.skipped.includes("role"));
});

test("prefill fills only what's unanswered, with a real option, and marks it", () => {
  let state = answer(emptyState(), "role", "ai");
  state = applyPrefill(catalog, state, { role: "backend", stage: "working", level: "chief" });
  assert.equal(state.answers.role, "ai");
  assert.equal(state.answers.stage, "working");
  assert.equal(state.sources.stage, "resume");
  assert.equal(state.answers.level, undefined);
});

test("many applications and silence point at reach first, then the resume", () => {
  const state = fill({ stage: "working", role: "backend", level: "mid", months: "3to6", apps: "gt200", stop: "replies" });
  const hits = bottlenecks(catalog, state);
  assert.equal(hits[0].id, "reach");
  assert.ok(hits.some((hit) => hit.id === "story"));
  assert.equal(hits[0].evidence[0], "You've sent over 200 applications and rarely hear back.");
  assert.ok(hits.every((hit) => hit.confidence === "suspected"));
});

test("a resume read adds its signals as evidence and its headline as the action", () => {
  const state = fill({ stage: "working", role: "ai", apps: "21to75", stop: "replies" });
  const hits = bottlenecks(catalog, state, { signals: ["vague-bullets", "made-up"], headline: "Backend engineer who ships AI features", years: 5 });
  const story = hits.find((hit) => hit.id === "story");
  assert.ok(story.evidence.includes(`In your resume, ${SIGNALS["vague-bullets"]}.`));
  assert.match(story.action, /Backend engineer who ships AI features/);
});

test("each stall stage names its own bottleneck", () => {
  for (const [stop, id] of [["screen", "screen"], ["technical", "technical"], ["final", "final"], ["offers", "target"]]) {
    const hits = bottlenecks(catalog, fill({ stage: "working", role: "backend", months: "1to3", apps: "21to75", stop }));
    assert.equal(hits[0].id, id, stop);
  }
});

test("a long search surfaces the gap; a new grad surfaces proof", () => {
  assert.ok(bottlenecks(catalog, fill({ months: "gt12", apps: "76to200", stop: "screen" })).some((hit) => hit.id === "gap"));
  assert.ok(bottlenecks(catalog, fill({ stage: "grad", apps: "1to20", months: "1to3", stop: "replies" })).some((hit) => hit.id === "proof"));
});

test("aiming above the resume's years is flagged only with a read", () => {
  const state = fill({ level: "senior", apps: "21to75", stop: "technical" });
  assert.ok(!bottlenecks(catalog, state).some((hit) => hit.id === "level"));
  assert.ok(bottlenecks(catalog, state, { years: 2 }).some((hit) => hit.id === "level"));
});

test("no answers, no bottlenecks: nothing is invented", () => {
  assert.deepEqual(bottlenecks(catalog, emptyState()), []);
});

test("chunks run c0, c1, then whichever tests the strongest bottleneck", () => {
  const state = fill({ stage: "working", role: "backend", months: "1to3", apps: "21to75", stop: "final" });
  assert.equal(nextChunk(catalog, state, []), "c0");
  assert.equal(nextChunk(catalog, state, ["c0"]), "c1");
  assert.equal(nextChunk(catalog, state, ["c0", "c1"]), "c5");
  assert.equal(nextChunk(catalog, state, catalog.chunks.map((chunk) => chunk.id)), null);
});

test("the diagnosis map: bottlenecks open, the first is next, every other chunk is a locked node once", () => {
  const state = fill({ stage: "working", role: "backend", level: "mid", months: "6to12", apps: "gt200", stop: "replies" });
  const map = diagnosisMap(catalog, state);
  assert.equal(map.nodes[0].state, "next");
  assert.equal(map.nodes.filter((node) => node.state === "next").length, 1);
  const locked = map.nodes.filter((node) => node.state === "locked").map((node) => node.chunk);
  assert.deepEqual([...locked].sort(), ["c1", "c2", "c3", "c4", "c5", "c6"]);
  assert.equal(locked[0], "c1");
  assert.ok(map.nodes.length <= 9);
  for (const node of map.nodes.filter((n) => n.state === "locked")) assert.ok(node.minutes >= 1 && node.questions >= 1);
});

const SHARED = JSON.parse(readFileSync(new URL("../../server/testdata/bottleneck-cases.json", import.meta.url)));
for (const c of SHARED.cases) {
  test(`bottlenecks, shared with server/intake_rules.py: ${c.name}`, () => {
    assert.deepEqual(bottlenecks(catalog, c.state, c.read), c.expect);
  });
}

test("c7 asks what they're into, with the ids seeds.py reads, and stays off the check's map", () => {
  const ids = catalog.questions.filter((q) => q.chunk === "c7").map((q) => q.id);
  assert.deepEqual(ids, ["techInterests", "personalInterests", "styleWords", "styleRefs", "styleShots", "voiceSample"]);
  assert.ok(chunkMinutes(chunkQuestions(catalog, "c7", emptyState())) <= 5);
  assert.equal(nextChunk(catalog, emptyState(), ["c0", "c1", "c2", "c3", "c4", "c5", "c6"]), "c7");
  const map = diagnosisMap(catalog, emptyState());
  assert.ok(!map.nodes.some((node) => node.chunk === "c7"));
});
