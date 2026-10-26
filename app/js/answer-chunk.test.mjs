import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as A from "./answer-chunk.js?v=c18e1b4-202610261602";

const catalog = JSON.parse(readFileSync(new URL("../../data/intake/questions.json", import.meta.url)));
const q = (id) => catalog.questions.find((item) => item.id === id);

test("a seat's state from the server, or an empty one", () => {
  assert.deepEqual(A.seatState(null), { answers: {}, skipped: [], sources: {} });
  assert.deepEqual(A.seatState({ state: { answers: { stage: "grad" }, skipped: ["role"], sources: { stage: "check" } } }).answers, { stage: "grad" });
});

test("every kind turns into the answer the catalog takes, or null when empty", () => {
  assert.equal(A.fromInput(q("stage"), "grad"), "grad");
  assert.equal(A.fromInput(q("stage"), "astronaut"), null);
  assert.deepEqual(A.fromInput(q("where"), ["remote", "remote", "mars"]), ["remote"]);
  assert.equal(A.fromInput(q("where"), []), null);
  assert.equal(A.fromInput(q("techInterests"), "  agents, tools "), "agents, tools");
  assert.equal(A.fromInput(q("techInterests"), "   "), null);
  assert.equal(A.fromInput(q("voiceSample"), "x".repeat(5000)).length, 4000);
  assert.deepEqual(A.fromInput(q("links"), "https://a.dev\nhttps://b.dev, https://c.dev"), ["https://a.dev", "https://b.dev", "https://c.dev"]);
  assert.deepEqual(A.fromInput(q("pay"), { min: "90000", max: "" }), { min: 90000, max: null });
  assert.equal(A.fromInput(q("pay"), { min: "", max: "" }), null);
  assert.equal(A.fromInput(q("photo"), ["up_x"]), null);
});

test("answers go back into the form", () => {
  assert.equal(A.toInput(q("links"), ["https://a.dev", "https://b.dev"]), "https://a.dev\nhttps://b.dev");
  assert.deepEqual(A.toInput(q("pay"), undefined), { min: "", max: "" });
  assert.deepEqual(A.toInput(q("where"), undefined), []);
});

test("a pick can bring in a question and clearing an answer takes it back out", () => {
  let state = A.seatState(null);
  assert.ok(!A.askedNow(catalog, "c1", state).some((item) => item.id === "city"));
  state = A.setAnswer(state, q("where"), ["hybrid"]);
  assert.ok(A.askedNow(catalog, "c1", state).some((item) => item.id === "city"));
  state = A.setAnswer(state, q("where"), []);
  assert.equal(state.answers.where, undefined);
  assert.equal(state.sources.where, undefined);
});

test("the save body: this chunk's answers, the rest skipped, uploads always skipped, done", () => {
  let state = A.seatState({ state: { answers: { stage: "grad" }, skipped: [], sources: {} } });
  state = A.setAnswer(state, q("techInterests"), "agents");
  state = A.setAnswer(state, q("voiceSample"), "Hello there.");
  assert.deepEqual(A.payloadFor(catalog, "c7", state), {
    chunk: "c7",
    answers: { techInterests: "agents", voiceSample: "Hello there." },
    skipped: ["personalInterests", "styleWords", "styleRefs", "styleShots"],
    done: true,
  });
  const c4 = A.payloadFor(catalog, "c4", A.setAnswer(state, q("linkedin"), "https://linkedin.com/in/me"));
  assert.deepEqual(Object.keys(c4.answers), ["linkedin"]);
  assert.ok(c4.skipped.includes("photo") && c4.skipped.includes("profileShots"));
  assert.deepEqual(A.answeredCount(catalog, "c7", state), { answered: 2, total: 5 });
});

test("what the server would refuse is caught first", () => {
  let state = A.setAnswer(A.seatState(null), q("links"), "github.com/me");
  assert.match(A.problems(catalog, "c3", state).links, /http/);
  state = A.setAnswer(state, q("links"), "https://github.com/me");
  assert.deepEqual(A.problems(catalog, "c3", state), {});
});

test("answers read back as short lines, and the rebuild says what it did", () => {
  assert.equal(A.answerLine(q("stage"), "grad"), "A new CS grad");
  assert.equal(A.answerLine(q("where"), ["remote", "hybrid"]), "Remote, Hybrid");
  assert.equal(A.answerLine(q("pay"), { min: 90000, max: 120000 }), "90,000 to 120,000");
  assert.equal(A.answerLine(q("techInterests"), undefined), "Skipped");
  assert.match(A.rebuildLine({ status: "published" }), /rebuilt itself/);
  assert.match(A.rebuildLine({ status: "unchanged" }), /already fits/);
  assert.equal(A.rebuildLine(null), "Your answers are saved.");
  for (const line of [A.rebuildLine({ status: "published" }), A.rebuildLine({ status: "unchanged" })]) {
    assert.doesNotMatch(line, /—|Aden|review/);
  }
});
