/**
 * Calendar. When, and with whom. One list for the week you are looking at.
 * The room hangs on the row. Today already answers what to do now. The map
 * already answers where you are. This page does not teach those jobs again.
 */

import { el } from "../dom.js";
import { panel, btn, empty } from "../ui.js";
import { eventsForWeek, weekRange, fmtShort, programPhase, relativeDay } from "../time.js";
import { eventRow } from "./parts.js";

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

function clampWeek(week, cohort) {
  return Math.min(Math.max(1, week), cohort.weeks + 1);
}
