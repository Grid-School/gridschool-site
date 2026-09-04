import test from "node:test";
import assert from "node:assert/strict";
import { upcomingMeetings, dueReminders, reminderText, LEADS_MIN } from "./reminders.js";

// A Monday. weekday 1 = Monday in the cohort rules (Sunday-indexed).
const cohort = {
  start: "2026-08-24",
  weeks: 8,
  recurring: [
    { id: "cohort", kind: "cohort", title: "Cohort call", weekday: 1, time: "18:00", where: "Discord · voice" },
    { id: "oneone", kind: "oneone", title: "Your 1:1", weekday: 3, time: "19:00", perStudent: true },
    { id: "ship", kind: "due", title: "Ship URL due", weekday: 5, time: "17:00" },
  ],
  milestones: [],
};
const student = { oneone: { weekday: 4, time: "20:30" } };

test("only live rooms are meetings; due dates and returns are not", () => {
  const now = new Date(2026, 7, 24, 9, 0);
  const meetings = upcomingMeetings(cohort, student, now);
  assert.ok(meetings.length > 0);
  assert.ok(meetings.every((m) => m.kind === "cohort" || m.kind === "oneone"));
});

test("the student's own 1:1 slot wins over the cohort default", () => {
  const now = new Date(2026, 7, 24, 9, 0);
  const one = upcomingMeetings(cohort, student, now).find((m) => m.kind === "oneone");
  assert.equal(one.at.getDay(), 4);
  assert.equal(one.at.getHours(), 20);
  assert.equal(one.at.getMinutes(), 30);
});

test("a reminder is due one hour before and again fifteen minutes before", () => {
  const start = new Date(2026, 7, 24, 18, 0);
  const meetings = upcomingMeetings(cohort, student, new Date(2026, 7, 24, 9, 0));

  const at61 = dueReminders(meetings, new Date(start.getTime() - 61 * 60000));
  assert.equal(at61.length, 0, "nothing before the hour");

  const at59 = dueReminders(meetings, new Date(start.getTime() - 59 * 60000));
  assert.deepEqual(at59.map((r) => r.lead), [60]);

  const at14 = dueReminders(meetings, new Date(start.getTime() - 14 * 60000));
  assert.deepEqual(at14.map((r) => r.lead).sort((a, b) => b - a), LEADS_MIN);

  const after = dueReminders(meetings, new Date(start.getTime() + 60000));
  assert.equal(after.length, 0, "a started meeting is not reminded");
});

test("each reminder has a key that is stable for one meeting and one lead", () => {
  const start = new Date(2026, 7, 24, 18, 0);
  const meetings = upcomingMeetings(cohort, student, new Date(2026, 7, 24, 9, 0));
  const a = dueReminders(meetings, new Date(start.getTime() - 50 * 60000));
  const b = dueReminders(meetings, new Date(start.getTime() - 40 * 60000));
  assert.equal(a[0].key, b[0].key);
  assert.equal(a[0].key, "cohort:2026-08-24:60");
});

test("the text says what, when and where", () => {
  const meeting = { title: "Cohort call", where: "Discord · voice" };
  assert.equal(reminderText({ lead: 60, meeting }), "Cohort call in 1 hour · Discord · voice");
  assert.equal(reminderText({ lead: 15, meeting: { title: "Your 1:1" } }), "Your 1:1 in 15 minutes");
});
