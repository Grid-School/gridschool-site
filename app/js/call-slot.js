/**
 * A student's standing 1:1, as one record on their seat (students.oneone):
 *
 *   { weekday, time, tz, studentTz, mins, every, from, link, where }
 *
 * `weekday` (Sunday = 0) and `time` (HH:MM) are wall-clock in `tz`, the zone
 * the slot was entered in (usually Aden's). `studentTz` is where the student
 * lives: the board, the email and the calendar feed show times there. `every`
 * is the cadence in weeks, counted from the Monday of `from` (or the join
 * date). The board, the desk, the reminder emails (server/call_slot.py) and
 * the calendar feed all read this one record, so they cannot drift apart.
 *
 * Pure: zone math is Intl only, no library.
 */

import { addDays, isoDate, parseDate, weekStart } from "./time.js?v=dc96989-202610110117";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86400000;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const formatters = new Map();

export function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function validZone(tz) {
  if (typeof tz !== "string" || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

function partsFormatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(
      tz,
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
      })
    );
  }
  return formatters.get(tz);
}

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Wall-clock fields of an instant in a zone. */
export function partsIn(instant, tz) {
  const raw = Object.fromEntries(partsFormatter(tz).formatToParts(instant).map((p) => [p.type, p.value]));
  const hour = Number(raw.hour) % 24;
  return {
    date: `${raw.year}-${raw.month}-${raw.day}`,
    time: `${String(hour).padStart(2, "0")}:${raw.minute}`,
    weekday: SHORT_DAYS.indexOf(raw.weekday),
    y: Number(raw.year),
    m: Number(raw.month),
    d: Number(raw.day),
    h: hour,
    min: Number(raw.minute),
    s: Number(raw.second),
  };
}

function offsetMs(tz, utcMs) {
  const p = partsIn(new Date(utcMs), tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - utcMs;
}

/** The instant a wall-clock date and time happen in `tz`. DST-safe. */
export function zonedToInstant(dateIso, hhmm, tz) {
  const [y, m, d] = String(dateIso).split("-").map(Number);
  const [h, min] = String(hhmm).split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  let guess = wall - offsetMs(tz, wall);
  guess = wall - offsetMs(tz, guess);
  return new Date(guess);
}

/** "ET", "MT", "PT" where the browser knows a generic name; "GMT+1" style otherwise. */
export function zoneLabel(tz, at = new Date()) {
  for (const style of ["shortGeneric", "short"]) {
    try {
      const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName");
      if (part?.value) return part.value;
    } catch {
      /* older engines: try the next style */
    }
  }
  return tz;
}

/**
 * The record as the calendar uses it, or null when no slot is set. `rule` is
 * the cohort's 1:1 rule: its defaults fill in length and wording, never the
 * day or time unless `fallback` allows it (the demo tour and seed files).
 */
export function normalizeSlot(oneone, { rule = null, fallback = false, joined = null, displayTz = null } = {}) {
  const raw = oneone && typeof oneone === "object" ? oneone : {};
  const day = raw.weekday;
  const hasDay = day !== null && day !== undefined && day !== "" && Number.isInteger(Number(day)) && Number(day) >= 0 && Number(day) <= 6;
  const time = typeof raw.time === "string" && TIME_RE.test(raw.time.trim()) ? raw.time.trim() : null;
  if ((!hasDay || !time) && !(fallback && rule)) return null;
  const weekday = hasDay ? Number(day) : rule.weekday;
  const studentTz = validZone(raw.studentTz) ? raw.studentTz.trim() : null;
  const local = displayTz && validZone(displayTz) ? displayTz : browserZone();
  // A slot saved before zones existed was entered as Mountain wall-clock (cohort.tz).
  const tz = validZone(raw.tz) ? raw.tz.trim() : rule?.tz && validZone(rule.tz) ? rule.tz : studentTz || local;
  const every = [1, 2, 3, 4].includes(Number(raw.every)) ? Number(raw.every) : 1;
  const mins = Number(raw.mins) > 0 && Number(raw.mins) <= 240 ? Number(raw.mins) : rule?.mins ?? 45;
  const from = /^\d{4}-\d{2}-\d{2}/.test(String(raw.from ?? "")) ? String(raw.from).slice(0, 10) : joined;
  const link = typeof raw.link === "string" && /^https?:\/\//.test(raw.link.trim()) ? raw.link.trim() : null;
  const where = typeof raw.where === "string" && raw.where.trim() ? raw.where.trim() : rule?.where ?? null;
  return { weekday, time: time ?? rule.time, tz, studentTz, every, mins, from, link, where };
}

/** Does the cadence land on the week starting Monday `monday` (YYYY-MM-DD)? */
export function onCadence(slot, monday) {
  if (!slot.every || slot.every === 1 || !slot.from) return true;
  const anchor = weekStart(parseDate(slot.from));
  const weeks = Math.round((parseDate(monday) - anchor) / (7 * DAY_MS));
  return weeks >= 0 && weeks % slot.every === 0;
}

/**
 * The slot's occurrence in the Monday-first week starting `monday`, or null
 * when the cadence skips that week. The week is counted on the slot's own
 * zone's calendar, so "Saturday 10 am MT" stays Saturday for Aden.
 */
export function occurrenceInWeek(slot, monday) {
  const mondayIso = isoDate(parseDate(monday));
  if (!onCadence(slot, mondayIso)) return null;
  const date = isoDate(addDays(parseDate(mondayIso), (slot.weekday + 6) % 7));
  return zonedToInstant(date, slot.time, slot.tz);
}

/** The next `count` start instants at or after `now`. A started call counts until it ends. */
export function nextOccurrences(slot, now = new Date(), count = 3) {
  const out = [];
  const startMonday = weekStart(addDays(now, -7));
  for (let i = 0; out.length < count && i < 60; i += 1) {
    const at = occurrenceInWeek(slot, addDays(startMonday, i * 7));
    if (at && at.getTime() + slot.mins * 60000 > now.getTime()) out.push(at);
  }
  return out;
}

export function fmtClock(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** "Saturday 12 pm ET" for an instant, in a zone. */
export function whenIn(at, tz, { day = "long" } = {}) {
  const p = partsIn(at, tz);
  const name = day === "long" ? DAY_NAMES[p.weekday] : SHORT_DAYS[p.weekday];
  return `${name} ${fmtClock(p.time)} ${zoneLabel(tz, at)}`;
}

export function cadenceLabel(every) {
  return every === 1 ? "weekly" : `every ${every} weeks`;
}

/** "Saturdays 12 pm ET · weekly · 45 min", in the zone the reader lives in. */
export function slotSummary(slot, tz, now = new Date()) {
  const at = nextOccurrences(slot, now, 1)[0] ?? zonedToInstant(isoDate(now), slot.time, slot.tz);
  const p = partsIn(at, tz);
  return `${DAY_NAMES[p.weekday]}s ${fmtClock(p.time)} ${zoneLabel(tz, at)} · ${cadenceLabel(slot.every)} · ${slot.mins} min`;
}

/** Join is live from ten minutes before the start until the call's end. */
export function joinIsLive(at, mins, now = new Date()) {
  const t = now.getTime();
  return t >= at.getTime() - 10 * 60000 && t < at.getTime() + mins * 60000;
}
