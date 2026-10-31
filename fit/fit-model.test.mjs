import test from "node:test";
import assert from "node:assert/strict";
import { INTRO, QUESTIONS, ownWords, parentScript, payload, result } from "./fit-model.mjs?v=fc7db25-202610310827";

const filled = {
  built: `${QUESTIONS[0].starter}a shift-swap sheet eight of us used every week.`,
  builtFor: `${QUESTIONS[1].starter}the library student staff`,
  tried: `${QUESTIONS[2].starter}240 applications since May.`,
  why: `${QUESTIONS[3].starter}I like building things that fix real problems.`,
  hours: "10to15",
  payer: "parent",
};

test("their own words go to the server, without our starter sentence", () => {
  assert.equal(ownWords(QUESTIONS[0], filled.built), "a shift-swap sheet eight of us used every week.");
  assert.equal(ownWords(QUESTIONS[2], "I sent 50 applications"), "I sent 50 applications");
  const { body } = payload(filled, { read: true, watched: 100 });
  assert.deepEqual(body, {
    read: true, watched: 100, hours: "10to15", payer: "parent",
    built: "a shift-swap sheet eight of us used every week.", builtFor: "the library student staff",
    tried: "240 applications since May.", why: "I like building things that fix real problems.",
  });
});

test("reading the intro comes first, then words, then both taps", () => {
  assert.match(payload(filled).problem, /Read the part above/);
  const starters = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.starter]));
  assert.match(payload({ ...starters, hours: "gt15", payer: "me" }, { read: true }).problem, /own words/);
  assert.match(payload({ ...filled, hours: "" }, { read: true }).problem, /hours/);
  assert.match(payload({ ...filled, payer: "" }, { read: true }).problem, /paid for/);
});

test("the parent note uses their own numbers from the check, and blanks where it doesn't know", () => {
  const note = parentScript({ months: "6to12", apps: "gt200" }, "https://gridschool.org/parents/?for=ck_x");
  assert.match(note, /looking for 6 to 12 months and sent more than 200 applications/);
  assert.match(note, /I want to make the decision/);
  assert.ok(note.endsWith("https://gridschool.org/parents/?for=ck_x"));
  assert.match(parentScript({}), /looking for ___ months and sent about ___ applications/);
});

test("each route has its own words, and the call screen says what happens without a booking link", () => {
  assert.equal(result({ route: "call", booking: "https://x" }, "Sam").title, "Sam, let's talk.");
  assert.match(result({ route: "call" }).lede, /email you within a day/);
  assert.match(result({ route: "sprint" }).title, /free sprint/);
  assert.match(result({ route: "self" }).lede, /10 hours a week/);
  assert.match(result({ route: "free" }).lede, /log 3 sends/);
});

test("the intro says what it asks and who it isn't for, in plain words", () => {
  assert.ok(INTRO.asks.some((a) => /10 to 15 hours/.test(a)));
  assert.match(INTRO.notFor, /apply for them/);
  const all = [INTRO.title, ...INTRO.paras, ...INTRO.asks, INTRO.notFor, ...QUESTIONS.flatMap((q) => [q.label, q.starter, q.example])].join(" ");
  assert.doesNotMatch(all, /[–—]/, "no em or en dashes");
});
