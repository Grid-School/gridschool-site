import test from "node:test";
import assert from "node:assert/strict";

import { eventForTask, counts } from "./measure.js?v=d177a03-202610252138";

test("an answered intake chunk and the week-one check-in are events; other tasks are not", () => {
  assert.deepEqual(eventForTask("q.c3.answer", "done"), { name: "intake.chunk_done", props: { chunk: "c3" } });
  assert.deepEqual(eventForTask("w.checkin.feel", "done", { scale: "2", note: "private words" }), { name: "checkin.done", props: { score: "2" } });
  assert.deepEqual(eventForTask("w.checkin.feel", "done", { scale: "9" }), { name: "checkin.done", props: {} });
  assert.equal(eventForTask("q.c3.answer", "todo"), null);
  assert.equal(eventForTask("t.today.do", "done"), null);
});

test("only a student on a real seat counts", () => {
  assert.equal(counts({ role: "student", slug: "sam" }), true);
  assert.equal(counts({ role: "admin", slug: "sam" }), false);
  assert.equal(counts({ role: "student", slug: "demo" }), false);
  assert.equal(counts({ role: "student", slug: "aden", test: true }), false);
});
