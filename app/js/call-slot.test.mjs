import test from "node:test";
import assert from "node:assert/strict";
import { zonedToInstant, partsIn, normalizeSlot, nextOccurrences, slotSummary, joinIsLive, whenIn } from "./call-slot.js?v=15fea56-202610100117";

test("a wall-clock time in one zone is the same instant everywhere", () => {
  const at = zonedToInstant("2026-10-10", "10:00", "America/Denver");
  assert.equal(at.toISOString(), "2026-10-10T16:00:00.000Z");
  assert.equal(partsIn(at, "America/New_York").time, "12:00");
  assert.equal(partsIn(at, "Asia/Manila").date, "2026-10-11");
  assert.equal(partsIn(at, "Asia/Manila").time, "00:00");
});

test("zone math is right on both sides of a DST change", () => {
  assert.equal(zonedToInstant("2026-11-01", "00:30", "America/New_York").toISOString(), "2026-11-01T04:30:00.000Z");
  assert.equal(zonedToInstant("2026-11-02", "00:30", "America/New_York").toISOString(), "2026-11-02T05:30:00.000Z");
});

test("no day or no time means no slot, unless the caller allows the cohort default", () => {
  const rule = { weekday: 3, time: "19:00", tz: "America/Denver", mins: 45 };
  assert.equal(normalizeSlot({}, { rule }), null);
  assert.equal(normalizeSlot({ weekday: 6 }, { rule }), null);
  assert.deepEqual(
    [normalizeSlot({}, { rule, fallback: true }).weekday, normalizeSlot({}, { rule, fallback: true }).time],
    [3, "19:00"]
  );
  const slot = normalizeSlot({ weekday: "6", time: "10:00", every: 9, link: "javascript:alert(1)" }, { rule });
  assert.equal(slot.weekday, 6);
  assert.equal(slot.every, 1, "only 1-4 week cadences");
  assert.equal(slot.link, null, "only http(s) links");
  assert.equal(slot.tz, "America/Denver");
});

test("next occurrences step by the cadence and summarise in the reader's zone", () => {
  const slot = normalizeSlot({ weekday: 6, time: "10:00", tz: "America/Denver", studentTz: "America/New_York", every: 2, from: "2026-10-05" });
  const next = nextOccurrences(slot, new Date("2026-10-07T12:00:00Z"), 3).map((d) => d.toISOString().slice(0, 10));
  assert.deepEqual(next, ["2026-10-10", "2026-10-24", "2026-11-07"]);
  assert.match(slotSummary(slot, "America/New_York", new Date("2026-10-07T12:00:00Z")), /^Saturdays 12 pm (ET|EDT) · every 2 weeks · 45 min$/);
  assert.match(whenIn(next.length && nextOccurrences(slot, new Date("2026-10-07T12:00:00Z"), 1)[0], "America/Denver"), /^Saturday 10 am (MT|MDT)$/);
});

test("join is live ten minutes before until the end", () => {
  const at = new Date("2026-10-10T16:00:00Z");
  assert.equal(joinIsLive(at, 45, new Date("2026-10-10T15:49:00Z")), false);
  assert.equal(joinIsLive(at, 45, new Date("2026-10-10T15:50:00Z")), true);
  assert.equal(joinIsLive(at, 45, new Date("2026-10-10T16:44:00Z")), true);
  assert.equal(joinIsLive(at, 45, new Date("2026-10-10T16:45:00Z")), false);
});
