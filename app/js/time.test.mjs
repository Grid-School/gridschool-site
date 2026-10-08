import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventsForWeek, ownSchedule, studentWeek, joinedDate, nextCall } from "./time.js?v=71f92ac-202610080806";

const cohort = JSON.parse(readFileSync(new URL("../../data/cohort.json", import.meta.url), "utf8"));

test("the shipped cohort has no group call; the 1:1 is a Discord voice call with Aden", () => {
  assert.equal(cohort.recurring.find((rule) => rule.id === "cohort"), undefined);
  const one = cohort.recurring.find((rule) => rule.id === "oneone");
  assert.equal(one.where, "Discord voice");
  assert.equal(one.who, "You and Aden");
  assert.equal(one.room, undefined, "the call link is per student, not a shared config link");
  assert.equal(cohort.tz, "America/Denver");
  assert.match(one.agenda, /^Your map/);
  assert.doesNotMatch(JSON.stringify(cohort.recurring), /All five|Founding cohort/);
});

test("a seed student's own 1:1 slot overrides the cohort default", () => {
  const events = eventsForWeek(cohort, { oneone: { weekday: 4, time: "20:30" } }, 1, { tz: "America/Denver" });
  const one = events.find((event) => event.kind === "oneone");
  assert.equal(one.weekday, 4);
  assert.equal(one.time, "20:30");
  assert.equal(one.date, "2026-08-27");
});

const MAP = { nodes: [{ id: "a" }] };
const calixte = {
  joined: "2026-10-05",
  map: MAP,
  oneone: { weekday: 6, time: "10:00", tz: "America/Denver", studentTz: "America/New_York", mins: 45, link: "https://discord.com/channels/1/2" },
};

test("a student with their own map sees their 1:1 in their zone, and no cohort ship row or gates", () => {
  const own = ownSchedule(cohort, calixte);
  for (let week = 1; week <= 8; week += 1) {
    const events = eventsForWeek(own, calixte, week);
    assert.deepEqual(events.map((e) => e.kind), ["oneone"], `week ${week}`);
  }
  const [one] = eventsForWeek(own, calixte, 1);
  assert.equal(one.date, "2026-10-10");
  assert.equal(one.time, "12:00", "10 am Mountain is noon Eastern");
  assert.equal(one.tz, "America/New_York");
  assert.equal(one.at.toISOString(), "2026-10-10T16:00:00.000Z");
  assert.equal(one.href, "https://discord.com/channels/1/2");
  assert.equal(one.mins, 45);
});

test("a map can schedule its own rows and milestones", () => {
  const student = { ...calixte, map: { ...MAP, calendar: [{ id: "ship", kind: "due", title: "Ship", weekday: 5, time: "17:00" }], milestones: [{ week: 2, title: "Gate" }] } };
  const own = ownSchedule(cohort, student);
  assert.deepEqual(eventsForWeek(own, student, 1).map((e) => e.id), ["ship", "oneone"]);
  assert.ok(eventsForWeek(own, student, 2).some((e) => e.allDay && e.title === "Gate"));
});

test("a real seat with no slot set shows no 1:1, never the cohort's default time", () => {
  const student = { joined: "2026-10-05", map: MAP, oneone: {} };
  assert.deepEqual(eventsForWeek(ownSchedule(cohort, student), student, 1), []);
  assert.equal(nextCall(ownSchedule(cohort, student), student, new Date("2026-10-07T12:00:00Z")), null);
});

test("a slot saved before zones existed reads as Mountain wall-clock", () => {
  const student = { joined: "2026-10-05", map: MAP, oneone: { weekday: 6, time: "12:00" } };
  const [one] = eventsForWeek(ownSchedule(cohort, student), student, 1, { tz: "America/New_York" });
  assert.equal(one.time, "14:00");
});

test("the Eastern hour holds across the end of daylight time", () => {
  const own = ownSchedule(cohort, calixte);
  const before = eventsForWeek(own, calixte, 4)[0];
  const after = eventsForWeek(own, calixte, 5)[0];
  assert.equal(before.date, "2026-10-31");
  assert.equal(after.date, "2026-11-07");
  assert.equal(before.time, "12:00");
  assert.equal(after.time, "12:00");
  assert.equal(after.at.toISOString(), "2026-11-07T17:00:00.000Z");
});

test("every two weeks counts from the cadence start", () => {
  const student = { ...calixte, oneone: { ...calixte.oneone, every: 2, from: "2026-10-12" } };
  const own = ownSchedule(cohort, student);
  const weeks = [1, 2, 3, 4, 5].filter((w) => eventsForWeek(own, student, w).length);
  assert.deepEqual(weeks, [2, 4]);
});

test("nextCall is the 1:1 that has not ended yet", () => {
  const own = ownSchedule(cohort, calixte);
  const during = nextCall(own, calixte, new Date("2026-10-10T16:30:00Z"));
  assert.equal(during.date, "2026-10-10");
  const afterEnd = nextCall(own, calixte, new Date("2026-10-10T16:46:00Z"));
  assert.equal(afterEnd.date, "2026-10-17");
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
