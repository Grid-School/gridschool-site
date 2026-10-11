import test from "node:test";
import assert from "node:assert/strict";
import { BEATS, BLANK_IDS, composeBeats, scriptSeconds, blanksLeft, voiceFlags, tidyAnswers } from "./loom-script.js?v=fbad271-202610110101";

const examples = Object.fromEntries(BEATS.flatMap((beat) => beat.blanks.map((b) => [b.id, b.example])));

test("every blank has a question and an example; spoken blanks have a starter with a blank", () => {
  assert.deepEqual(BLANK_IDS, ["hello", "noticed", "role", "match", "show", "personal", "ask"]);
  for (const beat of BEATS) {
    for (const b of beat.blanks) {
      assert.ok(b.q && b.example, b.id);
      if (!b.stage) assert.match(b.starter, /___/, b.id);
    }
  }
});

test("the made-up examples pass their own voice check and land in the window", () => {
  assert.deepEqual(voiceFlags(examples), []);
  const s = scriptSeconds(examples);
  assert.ok(s >= 45 && s <= 105, `examples run ${s}s`);
});

test("composeBeats times the beats, puts the screen note in brackets and skips empty beats", () => {
  const beats = composeBeats({ hello: "Hey Priya, I'm Sam.", match: "I built an approval step.", show: "the repo", ask: "Fifteen minutes?" });
  assert.deepEqual(beats, [
    { t: "0:00", say: "Hey Priya, I'm Sam." },
    { t: "0:01", say: "[the repo] I built an approval step." },
    { t: "0:03", say: "Fifteen minutes?" },
  ]);
  assert.deepEqual(composeBeats({ show: "only a screen note" }), []);
  assert.deepEqual(composeBeats(undefined), []);
});

test("blanksLeft counts unfilled starters; tidyAnswers drops unknown and empty keys", () => {
  assert.equal(blanksLeft({ hello: "Hey ___, I'm ___.", role: "The ___ role." }), 3);
  assert.equal(blanksLeft({ hello: "Hey Priya" }), 0);
  assert.deepEqual(tidyAnswers({ hello: "  hi  ", role: "   ", nope: "x" }), { hello: "hi" });
});

test("voiceFlags names template phrases once each", () => {
  const flags = voiceFlags({ hello: "I'm passionate about AI — and I'd leverage it.", role: "A great fit, passionate again." });
  assert.deepEqual(flags.map((f) => f.phrase), ["—", "passionate", "leverage", "great fit"]);
});
