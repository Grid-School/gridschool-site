/**
 * Calendar. Where "when, and with whom" gets answered. Every event is generated
 * from the cohort rules and the student's own 1:1 slot, so nothing here can drift
 * out of sync with the program.
 */

import { el } from "../dom.js";
import { panel, btn, empty } from "../ui.js";
import {
  eventsForWeek, weekRange, fmtShort, fmtTime, isoDate, addDays, sameDay,
  startOfDay, programPhase, relativeDay,
} from "../time.js";
import { eventRow } from "./parts.js";
import { monthGrid } from "./month.js";
import { link } from "../../../config.js";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function renderCalendar(ctx, weekArg) {
  const { state, navigate } = ctx;
  const { cohort, student, week: currentWeek } = state;
  const week = clampWeek(Number(weekArg) || currentWeek, cohort);
  const range = weekRange(cohort.start, week);
  const events = eventsForWeek(cohort, student, week);
  const now = new Date();
  const program = programPhase(cohort, now);

  return el(
    "div.view.view--cal",
    {},
    el(
      "header.view__head",
      {},
      el("b.eyebrow", {}, cohort.name),
      el("h1", {}, `Week ${week}`),
      el(
        "p.muted",
        {},
        `${fmtShort(range.start)} to ${fmtShort(range.end)} · all times ${cohort.timezoneLabel}`
      ),
      // Before the first Monday there is no "this week" to be in, and saying so
      // is better than a calendar that quietly pretends the program has started.
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
      { eyebrow: "Your week", title: "Seven days" },
      el("div.week", {}, WEEKDAY_LABELS.map((label, index) => dayCell(label, addDays(range.start, index), events, now)))
    ),
    el(
      "div.grid2",
      {},
      panel(
        { eyebrow: "Where you are", title: "The month", note: "Click any day to open its week." },
        monthGrid({ cohort, student, week, now, onPickWeek: (target) => navigate("calendar", String(target)) })
      ),
      panel(
        { eyebrow: "Detail", title: "What each one is for" },
        events.length ? el("div.evs", {}, events.map((event) => eventRow(event, { now }))) : empty("Nothing scheduled this week.")
      )
    ),
    panel(
      { eyebrow: "Where it happens", title: "The rooms" },
      el(
        "div.rooms",
        {},
        roomCard("Cohort call", "Discord voice, Mondays", "discord"),
        roomCard("Your 1:1", "Video call, your slot", "oneOnOne"),
        roomCard("The room, all week", "Discord text channels", "discord")
      )
    ),
    panel(
      { eyebrow: "The whole program", title: `${cohort.weeks} weeks` },
      el("div.timeline", {}, timelineWeeks(cohort, currentWeek, week, navigate))
    )
  );
}

function clampWeek(week, cohort) {
  return Math.min(Math.max(1, week), cohort.weeks + 1);
}

function dayCell(label, date, events, now) {
  const dayEvents = events.filter((event) => event.date === isoDate(date));
  const isToday = sameDay(date, now);
  return el(
    "div.week__day",
    {
      class: [isToday ? "is-today" : null, startOfDay(date) < startOfDay(now) ? "is-past" : null]
        .filter(Boolean)
        .join(" ") || null,
      "aria-current": isToday ? "date" : null,
    },
    el("div.week__label", {}, el("b", {}, label), el("span", {}, date.getDate())),
    dayEvents.length
      ? el(
          "ul.week__list",
          {},
          dayEvents.map((event) =>
            el(
              "li",
              { class: `week__ev week__ev--${event.kind}` },
              el("b", {}, event.title),
              !event.allDay && el("span", {}, fmtTime(event.time))
            )
          )
        )
      : el("p.week__free", {}, "open"),
    !dayEvents.length && el("span.week__hint", {}, "your time")
  );
}

function roomCard(title, detail, linkKey) {
  const href = link(linkKey);
  return el(
    "div.room-card",
    {},
    el("b", {}, title),
    el("p", {}, detail),
    href
      ? btn({ label: "Open", variant: "quiet", href, target: "_blank" })
      : el("span.notwired", {}, "not connected yet")
  );
}

function timelineWeeks(cohort, currentWeek, viewedWeek, navigate) {
  return Array.from({ length: cohort.weeks }, (_, index) => {
    const week = index + 1;
    const milestone = (cohort.milestones ?? []).find((m) => m.week === week);
    return el(
      "button.tl",
      {
        type: "button",
        class: [
          week === currentWeek ? "is-now" : null,
          week === viewedWeek ? "is-viewed" : null,
          week < currentWeek ? "is-past" : null,
          milestone ? "is-gate" : null,
        ]
          .filter(Boolean)
          .join(" "),
        onclick: () => navigate("calendar", String(week)),
        title: milestone ? `${milestone.title}: ${milestone.detail}` : `Week ${week}`,
      },
      el("b", {}, String(week)),
      milestone && el("span.tl__gate", {}, milestone.title)
    );
  });
}
