/**
 * Week math and the schedule generator. Calendar events are derived from the
 * cohort's recurring rules, never stored as a hand-written list, so the calendar
 * stays true when a start date or a 1:1 slot moves.
 */

import { normalizeSlot, occurrenceInWeek, partsIn, validZone, browserZone } from "./call-slot.js?v=dc96989-202610110117";

const DAY_MS = 86400000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse YYYY-MM-DD as a local date so the calendar never shifts by a day. */
export function parseDate(value) {
  if (value instanceof Date) return startOfDay(value);
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isoDate(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sameDay(a, b) {
  return isoDate(a) === isoDate(b);
}

/** Monday-based start of the week that contains `date`. */
export function weekStart(date) {
  const d = startOfDay(date);
  const shift = (d.getDay() + 6) % 7;
  return addDays(d, -shift);
}

/** 1-based program week. Week 1 is the week containing the cohort start. */
export function weekNumber(cohortStart, date = new Date()) {
  const start = weekStart(parseDate(cohortStart));
  const current = weekStart(date);
  return Math.floor((current - start) / (7 * DAY_MS)) + 1;
}

/** The day a student joined, as YYYY-MM-DD, or null. Seat data may carry a timestamp. */
export function joinedDate(student) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(student?.joined ?? ""));
  return match ? match[1] : null;
}

/** Week N of this student's own program, from the day they joined. */
export function studentWeek(student, fallback, now = new Date()) {
  const joined = joinedDate(student);
  if (!joined) return fallback;
  return Math.max(1, weekNumber(joined, now));
}

/**
 * The cohort rules on the student's own clock: same rituals, but week 1 is
 * the week they joined. Every board surface (calendar, quota, reminders)
 * reads this, so "week N" means the same thing everywhere for one student.
 */
export function ownSchedule(cohort, student) {
  const joined = joinedDate(student);
  return joined && cohort ? { ...cohort, start: joined } : cohort;
}

export function weekRange(cohortStart, week) {
  const start = addDays(weekStart(parseDate(cohortStart)), (week - 1) * 7);
  return { start, end: addDays(start, 6) };
}

/**
 * Where the student is relative to the program. Clamping the week number to 1
 * was quietly telling someone who enrolled on a Thursday that the intensive was
 * already running. The calendar has to be able to say "not yet".
 */
export function programPhase(cohort, now = new Date()) {
  const first = parseDate(cohort.start);
  const last = addDays(weekStart(first), cohort.weeks * 7 - 1);
  const today = startOfDay(now);
  if (today < first) return { phase: "before", days: Math.round((first - today) / DAY_MS), first, last };
  if (today > last) return { phase: "after", days: 0, first, last };
  return { phase: "running", days: 0, first, last };
}

export function fmtDay(date) {
  const d = parseDate(date);
  return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtShort(date) {
  const d = parseDate(date);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

export function relativeDay(date, now = new Date()) {
  const days = Math.round((startOfDay(parseDate(date)) - startOfDay(now)) / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}

/**
 * Every event in a week, generated from the cohort rules plus the student's own
 * 1:1 record (call-slot.js). Timed events carry `at`, the real instant, and
 * their `date`/`time` are shown in `tz`: the student's own zone on their board,
 * the reader's zone on the desk. Milestones for that week ride along as
 * all-day markers.
 *
 * A student with their own map gets only what that map schedules (`calendar`
 * rules, `milestones`) plus their 1:1: the cohort's Friday ship and program
 * gates belong to the old shared program, not to a personal map. Their 1:1
 * shows only once it is set on the seat; the cohort's default slot is for the
 * demo tour and seed files.
 */
export function eventsForWeek(cohort, student, week, { tz = null } = {}) {
  const { start } = weekRange(cohort.start, week);
  const events = [];
  const ownMap = hasOwnMap(student);
  const shown = displayZone(student, tz);
  const rules = [
    ...cohort.recurring.filter((rule) => rule.perStudent || !ownMap),
    ...(ownMap && Array.isArray(student.map.calendar) ? student.map.calendar : []),
  ];

  for (const rule of rules) {
    let slot;
    if (rule.perStudent) {
      slot = studentSlot(cohort, student);
      if (!slot) continue;
    } else {
      slot = { weekday: rule.weekday, time: rule.time, tz: rule.tz ?? cohort.tz ?? shown, every: 1, mins: rule.mins ?? 0 };
    }
    const at = occurrenceInWeek(slot, isoDate(start));
    if (!at) continue;
    const local = partsIn(at, shown);
    events.push({
      ...rule,
      time: local.time,
      weekday: local.weekday,
      date: local.date,
      at,
      tz: shown,
      week,
      ...(rule.perStudent
        ? { mins: slot.mins, href: slot.link, where: slot.where ?? rule.where, slot }
        : {}),
    });
  }

  const milestones = ownMap ? student.map.milestones ?? [] : cohort.milestones ?? [];
  for (const milestone of milestones) {
    if (milestone.week !== week) continue;
    events.push({
      ...milestone,
      id: `milestone-${milestone.week}`,
      date: isoDate(start),
      time: null,
      allDay: true,
      week,
    });
  }

  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.time ?? "").localeCompare(b.time ?? "");
  });
}

/**
 * The student's 1:1 record, resolved. A slot saved before zones existed reads
 * as cohort.tz wall-clock, which is how it was entered.
 */
export function studentSlot(cohort, student) {
  const rule = cohort?.recurring?.find((r) => r.perStudent);
  return normalizeSlot(student?.oneone, {
    rule: rule ? { ...rule, tz: rule.tz ?? cohort.tz } : null,
    fallback: !hasOwnMap(student),
    joined: joinedDate(student),
  });
}

/** A real seat planned against its own published map (not the demo or a seed). */
export function hasOwnMap(student) {
  const map = student?.map;
  return Boolean(map && typeof map === "object" && Array.isArray(map.nodes) && map.nodes.length);
}

/** Where times are shown: the caller's choice, else the student's own zone, else this device. */
export function displayZone(student, tz = null) {
  if (tz && validZone(tz)) return tz;
  const own = student?.oneone?.studentTz;
  return validZone(own) ? own : browserZone();
}

/** The student's next 1:1 that has not ended yet, or null (none set, or none within a month). */
export function nextCall(cohort, student, now = new Date()) {
  const current = Math.max(1, weekNumber(cohort.start, now));
  for (let week = current - 1; week <= current + 4; week += 1) {
    if (week < 1) continue;
    for (const event of eventsForWeek(cohort, student, week)) {
      if (event.kind !== "oneone" || !event.at) continue;
      if (event.at.getTime() + (event.mins ?? 0) * 60000 > now.getTime()) return event;
    }
  }
  return null;
}

/** The next thing on the calendar from `now`, looking a few weeks ahead. */
export function nextEvent(cohort, student, now = new Date()) {
  const current = Math.max(1, weekNumber(cohort.start, now));
  for (let week = current; week <= Math.min(current + 3, cohort.weeks + 1); week += 1) {
    for (const event of eventsForWeek(cohort, student, week)) {
      if (event.allDay || !event.at) continue;
      if (event.at >= now) return event;
    }
  }
  return null;
}
