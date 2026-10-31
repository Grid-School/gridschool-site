import test from "node:test";
import assert from "node:assert/strict";
import { startingOn, nextSteps, WAIT_LINE } from "./welcome-copy.js?v=7288040-202610310409";

const all = (me) => [startingOn(me), ...nextSteps(me).flat(), WAIT_LINE].join("\n");

test("a buyer with no check is never told about a check", () => {
  for (const me of [{}, { checks: [] }, null]) {
    assert.doesNotMatch(all(me), /free check|check found|check pointed/);
    assert.match(startingOn(me), /a few short questions/);
  }
});

test("a buyer with a check starts where it pointed", () => {
  assert.equal(startingOn({ checks: [{ top: [{ id: "reach" }] }] }), "We're starting where your free check pointed first: getting your applications in front of a person.");
  assert.match(startingOn({ checks: [{ top: [] }] }), /free check/);
});

test("self-serve: no promise that a person reviews the map, and the copy law holds", () => {
  for (const me of [{}, { checks: [{ top: [{ id: "story" }] }] }]) {
    const text = all(me);
    assert.doesNotMatch(text, /Aden|review|goes through your map|within a day/i);
    assert.doesNotMatch(text, /—|\b(unlock|seamless|leverage|journey|supercharge)\b/i);
    assert.match(text, /rebuilds itself around your answers/);
  }
});
