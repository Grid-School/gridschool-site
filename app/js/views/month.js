/**
 * The month grid.
 *
 * Nothing is imported for this. Every calendar library on the shelf ships its
 * own layout engine, its own event model and its own theme to fight, and this
 * calendar has no free-form events to manage — every entry is generated from the
 * cohort rules. What was actually missing is what a real calendar gives you in
 * one glance: today, the days already gone, and where the month boundaries fall.
 *
 * Browsing months is local state; picking a day commits. That split is how every
 * calendar works, and it is the only version that behaves: deriving the month
 * from the viewed week is circular, because the week that contains the 1st of
 * September can still start in August.
 */

import { el, mount } from "../dom.js";
import {
  monthDays, monthLabel, monthOf, isoDate, sameDay, startOfDay, fmtShort,
  addDays, weekNumber, weekRange, eventsInRange, programPhase,
} from "../time.js";

/** Initials read fine by eye, but "T T" and "S S" are useless out loud. */
const WEEKDAYS = [
  ["M", "Monday"], ["T", "Tuesday"], ["W", "Wednesday"], ["T", "Thursday"],
  ["F", "Friday"], ["S", "Saturday"], ["S", "Sunday"],
];
const DOTS_SHOWN = 3;

/**
 * `onPickWeek` receives a program week number, already clamped. Days outside the
 * program are shown but not clickable — pretending they lead somewhere would be
 * a dead end dressed as a link.
 */
export function monthGrid({ cohort, student, week, now = new Date(), onPickWeek }) {
  const viewed = weekRange(cohort.start, week);
  const program = programPhase(cohort, now);
  const today = startOfDay(now);
  const root = el("div.month");

  // The Thursday rule: a week belongs to the month holding most of its days.
  let anchor = monthOf(addDays(viewed.start, 3));
  render();
  return root;

  function render() {
    const month = monthDays(anchor);
    const events = eventsInRange(cohort, student, month.start, month.end);
    const byDate = groupByDate(events);
    const back = monthOf(addDays(month.first, -1));
    const forward = monthOf(addDays(month.last, 1));

    mount(
      root,
      el(
        "div.month__head",
        {},
        stepper("‹", back, monthOf(program.first)),
        el("b.month__label", {}, monthLabel(month.first)),
        stepper("›", forward, null, monthOf(program.last))
      ),
      el(
        "div.month__grid",
        {},
        WEEKDAYS.map(([initial, name]) =>
          el("span.month__dow", { role: "columnheader", "aria-label": name, title: name }, initial)
        ),
        month.days.map((day) => dayCell(day, month, byDate))
      ),
      el(
        "div.month__key",
        {},
        el("span.month__keyitem", {}, el("i.month__dot.month__dot--cohort"), "cohort"),
        el("span.month__keyitem", {}, el("i.month__dot.month__dot--oneone"), "1:1"),
        el("span.month__keyitem", {}, el("i.month__dot.month__dot--due"), "due"),
        el("span.month__keyitem", {}, el("i.month__dot.month__dot--gate"), "gate")
      )
    );
  }

  /** Only months the program actually touches are reachable. */
  function stepper(glyph, target, floor = null, ceiling = null) {
    const blocked = (floor && target < floor) || (ceiling && target > ceiling);
    const label = blocked ? `${monthLabel(target)} is outside the program` : `Go to ${monthLabel(target)}`;
    return el(
      "button.month__step",
      {
        type: "button",
        disabled: blocked || null,
        "aria-label": label,
        title: label,
        onclick: () => {
          anchor = target;
          render();
        },
      },
      glyph
    );
  }

  function dayCell(day, month, byDate) {
    const dayEvents = byDate.get(isoDate(day)) ?? [];
    const rawWeek = weekNumber(cohort.start, day);
    const inProgram = rawWeek >= 1 && rawWeek <= cohort.weeks + 1;
    const isToday = sameDay(day, today);
    const classes = [
      day.getMonth() === month.first.getMonth() ? null : "is-outside",
      startOfDay(day) < today ? "is-past" : null,
      isToday ? "is-today" : null,
      inProgram ? null : "is-offprogram",
      day >= viewed.start && day <= viewed.end ? "is-viewed" : null,
    ].filter(Boolean);

    const label = [
      fmtShort(day),
      inProgram ? `week ${rawWeek}` : "outside the program",
      isToday ? "today" : null,
      dayEvents.length ? `${dayEvents.length} on the calendar` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return el(
      inProgram ? "button.month__day" : "div.month__day",
      {
        class: classes.join(" ") || null,
        type: inProgram ? "button" : null,
        title: label,
        "aria-label": inProgram ? label : null,
        "aria-current": isToday ? "date" : null,
        onclick: inProgram ? () => onPickWeek(Math.min(Math.max(1, rawWeek), cohort.weeks + 1)) : null,
      },
      el("span.month__n", {}, String(day.getDate())),
      el(
        "span.month__dots",
        {},
        dayEvents.slice(0, DOTS_SHOWN).map((event) => el("i", { class: `month__dot month__dot--${event.kind}` })),
        dayEvents.length > DOTS_SHOWN && el("span.month__more", {}, `+${dayEvents.length - DOTS_SHOWN}`)
      )
    );
  }
}

function groupByDate(events) {
  const map = new Map();
  for (const event of events) {
    if (!map.has(event.date)) map.set(event.date, []);
    map.get(event.date).push(event);
  }
  return map;
}
