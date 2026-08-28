/**
 * Week math and the schedule generator. Calendar events are derived from the
 * cohort's recurring rules, never stored as a hand-written list, so the calendar
 * stays true when a start date or a 1:1 slot moves.
 */

const DAY_MS = 86400000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

/** The 1st of the month that contains `date`. */
export function monthOf(date) {
  const d = parseDate(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * A month as whole Monday-first weeks. Real calendars show the tail of the
 * previous month and the head of the next one; hiding them makes the first row
 * float and costs the student the sense of where the month sits in the year.
 */
export function monthDays(anchor) {
  const first = monthOf(anchor);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const start = weekStart(first);
  const end = addDays(weekStart(last), 6);
  const days = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return { first, last, start, end, days };
}

export function monthLabel(date) {
  const d = parseDate(date);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
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
 * 1:1 slot. Milestones for that week ride along as all-day markers.
 */
export function eventsForWeek(cohort, student, week) {
  const { start } = weekRange(cohort.start, week);
  const events = [];

  for (const rule of cohort.recurring) {
    const time = rule.perStudent && student?.oneone?.time ? student.oneone.time : rule.time;
    const weekday = rule.perStudent && student?.oneone?.weekday != null
      ? student.oneone.weekday
      : rule.weekday;
    // Rules are authored Sunday-indexed; the grid runs Monday first.
    const offset = (weekday + 6) % 7;
    events.push({
      ...rule,
      time,
      weekday,
      date: isoDate(addDays(start, offset)),
      week,
    });
  }

  for (const milestone of cohort.milestones ?? []) {
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
 * Every event between two dates, inclusive. The month grid spans weeks and can
 * reach outside the program, so the week loop is clamped rather than trusted.
 */
export function eventsInRange(cohort, student, from, to) {
  const firstWeek = Math.max(1, weekNumber(cohort.start, from));
  const lastWeek = Math.min(weekNumber(cohort.start, to), cohort.weeks + 1);
  const fromIso = isoDate(from);
  const toIso = isoDate(to);
  const events = [];
  for (let week = firstWeek; week <= lastWeek; week += 1) {
    for (const event of eventsForWeek(cohort, student, week)) {
      if (event.date >= fromIso && event.date <= toIso) events.push(event);
    }
  }
  return events;
}

/** The next thing on the calendar from `now`, looking a few weeks ahead. */
export function nextEvent(cohort, student, now = new Date()) {
  const current = Math.max(1, weekNumber(cohort.start, now));
  for (let week = current; week <= Math.min(current + 3, cohort.weeks + 1); week += 1) {
    for (const event of eventsForWeek(cohort, student, week)) {
      if (event.allDay) continue;
      const when = parseDate(event.date);
      const [h, m] = (event.time || "00:00").split(":").map(Number);
      when.setHours(h, m, 0, 0);
      if (when >= now) return { ...event, at: when };
    }
  }
  return null;
}
