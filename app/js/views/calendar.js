/**
 * Calendar. When, and with whom. One list for the week you are looking at.
 * The room hangs on the row. Today already answers what to do now. The map
 * already answers where you are. This page does not teach those jobs again.
 */

import { el } from "../dom.js?v=b6ca108-202610080352";
import { panel, btn, empty } from "../ui.js?v=b6ca108-202610080352";
import { eventsForWeek, weekRange, fmtShort, programPhase, relativeDay } from "../time.js?v=b6ca108-202610080352";
import { eventRow } from "./parts.js?v=b6ca108-202610080352";
import { requestSystemReminders } from "../reminders.js?v=b6ca108-202610080352";
import { toast } from "../ui.js?v=b6ca108-202610080352";

export function renderCalendar(ctx, weekArg) {
  const { state, navigate } = ctx;
  const { cohort, student, week: currentWeek } = state;
  const week = clampWeek(Number(weekArg) || currentWeek, lastWeek(cohort, currentWeek));
  const range = weekRange(cohort.start, week);
  const events = eventsForWeek(cohort, student, week);
  const now = new Date();
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
        `${fmtShort(range.start)} to ${fmtShort(range.end)} · all times ${cohort.timezoneLabel}`
      ),
      el(
        "p.muted.cal__remind",
        {},
        "You get a reminder one hour before and fifteen minutes before your 1:1, while this is open. ",
        systemReminderControl()
      ),
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
