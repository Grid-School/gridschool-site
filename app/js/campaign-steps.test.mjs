import test from "node:test";
import assert from "node:assert/strict";
import { NODE_IDS, SLIDES, nodeDone, doneNodes, firstOpen, nextNode, prevNode, partDone, scriptDone } from "./campaign-steps.js?v=d696edf-202610102057";
import { BEATS } from "./loom-script.js?v=d696edf-202610102057";

const examples = Object.fromEntries(BEATS.flatMap((beat) => beat.blanks.map((b) => [b.id, b.example])));

test("the nodes run research, script, record, then each channel", () => {
  assert.deepEqual(NODE_IDS, ["who", "script", "record", "email", "linkedin", "call", "follow"]);
  assert.equal(nextNode("script"), "record");
  assert.equal(prevNode("who"), null);
  assert.equal(nextNode("follow"), null);
});

test("one slide per question, each knowing its part", () => {
  assert.equal(SLIDES.length, 7);
  assert.deepEqual(SLIDES.map((s) => s.part), [0, 0, 1, 2, 2, 3, 4]);
});

test("a part is done only when every answer in it is filled and has no blanks", () => {
  assert.equal(partDone({ hello: "Hey Priya, I'm Sam.", noticed: "I read your changelog." }, 0), true);
  assert.equal(partDone({ hello: "Hey ___, I'm Sam.", noticed: "I read it." }, 0), false);
  assert.equal(partDone({ hello: "Hey Priya" }, 0), false);
  assert.equal(scriptDone(examples), true);
  assert.equal(scriptDone({ ...examples, show: "" }), false);
});

test("nodes are done from the student's own record", () => {
  const blank = { touches: {}, contact: {} };
  assert.deepEqual(doneNodes(blank), []);
  assert.equal(firstOpen(blank), "who");
  const t = { contact: { name: "Priya" }, loomScript: examples, loomUrl: "https://loom.com/share/x", touches: { email: "2026-10-10", linkedin: "2026-10-10" } };
  assert.deepEqual(doneNodes(t), ["who", "script", "record", "email", "linkedin"]);
  assert.equal(firstOpen(t), "call");
  assert.equal(nodeDone({ touches: { d3: 1, d7: 1 } }, "follow"), false);
  assert.equal(firstOpen({ ...t, touches: { email: 1, linkedin: 1, call: 1, d3: 1, d7: 1, d14: 1 } }), "follow");
});

test("a campaign from before the script builder opens where it really is", () => {
  const old = { contact: {}, loomUrl: "https://loom.com/share/x", touches: { email: "2026-10-08" } };
  assert.deepEqual(doneNodes(old), ["who", "script", "record", "email"]);
  assert.equal(firstOpen(old), "linkedin");
});
