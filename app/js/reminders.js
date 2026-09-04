/**
 * Meeting reminders. One hour before, and fifteen minutes before, every live
 * room the student is in: the cohort call and their 1:1. Due dates and review
 * returns are not meetings and do not fire.
 *
 * Two layers: a toast inside the app (always, while the app is open), and a
 * system notification when the browser has already been given permission.
 * Permission is asked for once, on a click, from the calendar; never on load.
 *
 * `upcomingMeetings` and `dueReminders` are pure so the timing is testable.
 * `startReminders` is the clock.
 */

import { eventsForWeek, weekNumber, parseDate } from "./time.js";
import { toast } from "./ui.js";

export const LEADS_MIN = [60, 15];
const MEETING_KINDS = new Set(["cohort", "oneone"]);
const LOOK_AHEAD_WEEKS = 2;
const TICK_MS = 30 * 1000;

/** Live rooms from `now` forward, with their start as a Date. */
export function upcomingMeetings(cohort, student, now = new Date()) {
  const current = Math.max(1, weekNumber(cohort.start, now));
  const out = [];
  for (let week = current; week <= current + LOOK_AHEAD_WEEKS; week += 1) {
    for (const event of eventsForWeek(cohort, student, week)) {
      if (event.allDay || !MEETING_KINDS.has(event.kind)) continue;
      const at = parseDate(event.date);
      const [h, m] = (event.time || "00:00").split(":").map(Number);
      at.setHours(h, m, 0, 0);
      if (at >= now) out.push({ ...event, at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Reminders whose window is open at `now`: fire time has passed, the meeting
 * has not started. Each carries a key so it fires once.
 */
export function dueReminders(meetings, now = new Date()) {
  const due = [];
  for (const meeting of meetings) {
    for (const lead of LEADS_MIN) {
      const fireAt = new Date(meeting.at.getTime() - lead * 60 * 1000);
      if (now >= fireAt && now < meeting.at) {
        due.push({ key: `${meeting.id}:${meeting.date}:${lead}`, lead, meeting });
      }
    }
  }
  return due;
}

export function reminderText({ lead, meeting }) {
  const when = lead === 60 ? "in 1 hour" : `in ${lead} minutes`;
  const where = meeting.where ? ` · ${meeting.where}` : "";
  return `${meeting.title} ${when}${where}`;
}

/**
 * Start the clock. `getState` returns the store state (cohort + student).
 * Returns a stop function. Keys that already fired are remembered for the
 * session, so a reload inside the window shows a reminder once more, which is
 * the right call for a meeting.
 */
export function startReminders({ getState, notify = defaultNotify, now = () => new Date() }) {
  const fired = new Set();

  function tick() {
    const state = getState();
    if (!state?.cohort) return;
    const meetings = upcomingMeetings(state.cohort, state.student, now());
    for (const reminder of dueReminders(meetings, now())) {
      if (fired.has(reminder.key)) continue;
      fired.add(reminder.key);
      notify(reminder);
    }
  }

  tick();
  const id = setInterval(tick, TICK_MS);
  return () => clearInterval(id);
}

function defaultNotify(reminder) {
  const text = reminderText(reminder);
  toast(text, "warn", { ms: 12000 });
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("GridSchool", { body: text, tag: reminder.key });
    } catch {
      /* the toast already said it */
    }
  }
}

/** Ask once, from a click. Resolves to the resulting permission string. */
export async function requestSystemReminders() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
