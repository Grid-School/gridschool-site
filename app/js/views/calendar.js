/**
 * Calendar. When, and with whom. One list for the week you are looking at.
 * The room hangs on the row. Today already answers what to do now. The map
 * already answers where you are. This page does not teach those jobs again.
 */

import { el } from "../dom.js?v=5802f60-202610100134";
import { panel, btn, empty } from "../ui.js?v=5802f60-202610100134";
import { eventsForWeek, weekRange, fmtShort, programPhase, relativeDay, displayZone } from "../time.js?v=5802f60-202610100134";
import { zoneLabel } from "../call-slot.js?v=5802f60-202610100134";
import { PERSIST, isPlaceholder } from "../../../config.js?v=5802f60-202610100134";
import { eventRow } from "./parts.js?v=5802f60-202610100134";
import { requestSystemReminders } from "../reminders.js?v=5802f60-202610100134";
import { toast } from "../ui.js?v=5802f60-202610100134";

export function renderCalendar(ctx, weekArg) {
  const { state, navigate } = ctx;
  const { cohort, student, week: currentWeek } = state;
  const week = clampWeek(Number(weekArg) || currentWeek, lastWeek(cohort, currentWeek));
  const range = weekRange(cohort.start, week);
  const events = eventsForWeek(cohort, student, week);
  const now = new Date();
  const tz = displayZone(student);
  const hasCall = events.some((event) => event.kind === "oneone");
  const program = programPhase(cohort, now);
  const last = lastWeek(cohort, currentWeek);

  return el(
    "div.view.view--cal",
    {},
    el(
      "header.view__head",
      {},
      el("b.eyebrow", {}, "Your calendar"),
      el("h1", {}, `Week ${week}`),
      el(
        "p.muted",
        {},
        `${fmtShort(range.start)} to ${fmtShort(range.end)} · all times ${zoneLabel(tz, range.start)} (${tz.replace(/_/g, " ")})`
      ),
      el(
        "p.muted.cal__remind",
        {},
        hasCall || student.oneone?.weekday != null
          ? "An email reaches you one hour before your 1:1, and this page reminds you again at fifteen minutes while it is open. "
          : "Your 1:1 shows here once Aden sets its time. ",
        systemReminderControl()
      ),
      feedLinks(state.calendarFeed),
      program.phase === "before" &&
        el("p.cal__pre", {}, `You start ${relativeDay(program.first, now)}, ${fmtShort(program.first)}. Week 1 is below.`),
      el(
        "div.view__nav",
        {},
        btn({ label: "← Previous", variant: "quiet", disabled: week <= 1, onclick: () => navigate("calendar", String(week - 1)) }),
        week !== currentWeek && btn({ label: "This week", variant: "quiet", onclick: () => navigate("calendar", String(currentWeek)) }),
        btn({ label: "Next →", variant: "quiet", disabled: week >= last, onclick: () => navigate("calendar", String(week + 1)) })
      )
    ),
    panel(
      {},
      events.length
        ? el("div.evs", {}, events.map((event) => eventRow(event, { now })))
        : empty("Nothing scheduled this week.")
    )
  );
}

/**
 * The private calendar feed: the 1:1 lands in Google or Apple Calendar with the
 * join link, and moves there when the slot moves. The path is signed per
 * student by the server; without it (demo, no server) nothing shows.
 */
function feedLinks(path) {
  const base = PERSIST?.endpoint;
  if (!path || typeof base !== "string" || isPlaceholder(base)) return null;
  const https = `${base.replace(/\/$/, "")}${path}`;
  const webcal = https.replace(/^https?:/, "webcal:");
  return el(
    "p.muted.cal__feed",
    {},
    "Put your 1:1 in your own calendar: ",
    el("a", { href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`, target: "_blank", rel: "noopener" }, "Google Calendar"),
    " · ",
    el("a", { href: webcal }, "Apple or Outlook"),
    ". It stays in sync if the time moves."
  );
}

/** One click, once. After that the line just states where things stand. */
function systemReminderControl() {
  if (typeof Notification === "undefined") return "Your browser does not do system notifications.";
  if (Notification.permission === "granted") return "System notifications are on.";
  if (Notification.permission === "denied") return "System notifications are blocked in your browser settings.";
  return btn({
    label: "Also notify me when this tab is in the background",
    variant: "quiet",
    onclick: async (event) => {
      const result = await requestSystemReminders();
      event.currentTarget.replaceWith(
        result === "granted" ? "System notifications are on." : "System notifications stay off. The in-app reminder still fires."
      );
      if (result === "granted") toast("Reminders will also reach you when this tab is in the background.");
    },
  });
}

/** Weeks run on the student's own clock; look a few weeks past today or the program, whichever is later. */
function lastWeek(cohort, currentWeek) {
  return Math.max(cohort.weeks + 1, currentWeek + 4);
}

function clampWeek(week, last) {
  return Math.min(Math.max(1, week), last);
}
