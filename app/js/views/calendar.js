/**
 * Calendar. When, and with whom. One list for the week you are looking at.
 * The room hangs on the row. Today already answers what to do now. The map
 * already answers where you are. This page does not teach those jobs again.
 */

import { el } from "../dom.js";
import { panel, btn, empty } from "../ui.js";
import { eventsForWeek, weekRange, fmtShort, programPhase, relativeDay } from "../time.js";
import { eventRow } from "./parts.js";
import { requestSystemReminders } from "../reminders.js";
import { toast } from "../ui.js";

export function renderCalendar(ctx, weekArg) {
  const { state, navigate } = ctx;
  const { cohort, student, week: currentWeek } = state;
  const week = clampWeek(Number(weekArg) || currentWeek, cohort);
  const range = weekRange(cohort.start, week);
  const events = eventsForWeek(cohort, student, week);
  const now = new Date();
  const program = programPhase(cohort, now);
  const inLab = week <= cohort.weeks;

  return el(
    "div.view.view--cal",
    {},
    el(
      "header.view__head",
      {},
      el("b.eyebrow", {}, cohort.name),
      el("h1", {}, inLab ? `Week ${week} of ${cohort.weeks}` : `After week ${cohort.weeks}`),
      el(
        "p.muted",
        {},
        `${fmtShort(range.start)} to ${fmtShort(range.end)} · all times ${cohort.timezoneLabel}`
      ),
      el(
        "p.muted.cal__remind",
        {},
        "You get a reminder one hour before and fifteen minutes before every cohort call and 1:1, while this is open. ",
        systemReminderControl()
      ),
      program.phase === "before" &&
        el("p.cal__pre", {}, `The cohort starts ${relativeDay(program.first, now)}, ${fmtShort(program.first)}. Week 1 is below.`),
      el(
        "div.view__nav",
        {},
        btn({ label: "← Previous", variant: "quiet", disabled: week <= 1, onclick: () => navigate("calendar", String(week - 1)) }),
        week !== currentWeek && btn({ label: "This week", variant: "quiet", onclick: () => navigate("calendar", String(currentWeek)) }),
        btn({ label: "Next →", variant: "quiet", disabled: week >= cohort.weeks + 1, onclick: () => navigate("calendar", String(week + 1)) })
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

function clampWeek(week, cohort) {
  return Math.min(Math.max(1, week), cohort.weeks + 1);
}
