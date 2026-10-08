import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventsForWeek, ownSlot, ownSchedule, studentWeek, joinedDate } from "./time.js?v=1eba295-202610080607";

const cohort = JSON.parse(readFileSync(new URL("../../data/cohort.json", import.meta.url), "utf8"));

test("the shipped cohort has no group call; the 1:1 is on Google Meet with Aden", () => {
  assert.equal(cohort.recurring.find((rule) => rule.id === "cohort"), undefined);
  const one = cohort.recurring.find((rule) => rule.id === "oneone");
  assert.equal(one.where, "Video call · Google Meet");
  assert.equal(one.who, "You and Aden");
  assert.match(one.agenda, /^Your map/);
  assert.doesNotMatch(JSON.stringify(cohort.recurring), /All five|Founding cohort/);
});

test("a student's own 1:1 slot overrides the cohort default", () => {
  const events = eventsForWeek(cohort, { oneone: { weekday: 4, time: "20:30" } }, 1);
  const one = events.find((event) => event.kind === "oneone");
  assert.equal(one.weekday, 4);
  assert.equal(one.time, "20:30");
  assert.equal(one.date, "2026-08-27");
});

test("an empty or partial seat slot falls back field by field", () => {
  const rule = { weekday: 3, time: "19:00" };
  assert.deepEqual(ownSlot(rule, {}), { weekday: 3, time: "19:00" });
  assert.deepEqual(ownSlot(rule, { weekday: "5" }), { weekday: 5, time: "19:00" });
  assert.deepEqual(ownSlot(rule, { weekday: 0, time: "" }), { weekday: 0, time: "19:00" });
  assert.deepEqual(ownSlot(rule, { weekday: 9, time: "7:15" }), { weekday: 3, time: "7:15" });
});

test("the student's own week counts from their join date", () => {
  const now = new Date(2026, 9, 5, 12);
  assert.equal(studentWeek({ joined: "2026-09-28" }, 7, now), 2);
  assert.equal(studentWeek({ joined: "2026-09-28T15:00:00Z" }, 7, now), 2);
  assert.equal(studentWeek({}, 7, now), 7);
  assert.equal(joinedDate({ joined: "nope" }), null);
});

test("ownSchedule moves week 1 to the join week and keeps the rules", () => {
  const own = ownSchedule(cohort, { joined: "2026-09-28" });
  assert.equal(own.start, "2026-09-28");
  assert.equal(own.recurring, cohort.recurring);
  assert.equal(ownSchedule(cohort, {}), cohort);
});
