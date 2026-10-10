import test from "node:test";
import assert from "node:assert/strict";
import { splitBeat, paceNote, takesLine, clock, PACE } from "./loom-kit.js?v=d696edf-202610102057";

test("splitBeat pulls stage directions out of the spoken line", () => {
  assert.deepEqual(splitBeat("Here's how. [screen: the repo, the approval gate] The agent proposes."), {
    spoken: "Here's how. The agent proposes.",
    stage: ["screen: the repo, the approval gate"],
  });
  assert.deepEqual(splitBeat(""), { spoken: "", stage: [] });
  assert.deepEqual(splitBeat(undefined), { spoken: "", stage: [] });
});

test("paceNote reads every length kindly and points at one fix", () => {
  assert.match(paceNote(30), /Short is fine/);
  assert.match(paceNote(PACE.min + 1), /Send it/);
  assert.match(paceNote(75), /Right in the window/);
  assert.match(paceNote(PACE.high + 5), /Cut one sentence/);
  assert.match(paceNote(200), /^3:20\. Long/);
});

test("takesLine and clock", () => {
  assert.match(takesLine(0), /warm-up/);
  assert.match(takesLine(1), /second or third/);
  assert.match(takesLine(3), /^3 takes/);
  assert.match(takesLine(9), /next one goes on Loom/);
  assert.equal(clock(65.9), "1:05");
  assert.equal(clock(-3), "0:00");
});

test("startingAnswers keeps saved words and puts the starter in every untouched blank", async () => {
  const { startingAnswers } = await import("./loom-kit.js?v=d696edf-202610102057");
  const a = startingAnswers({ hello: "Hey Priya, I'm Sam." });
  assert.equal(a.hello, "Hey Priya, I'm Sam.");
  assert.match(a.role, /^I'm reaching out about the ___ role/);
  assert.equal(a.show, "");
});
