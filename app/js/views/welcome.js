/**
 * Welcome-step helpers: schedule from cohort + readiness that makes progress feel insured.
 */

import { el } from "../dom.js";
import { btn } from "../ui.js";
import { TASK_STATE } from "../tasks.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatClock(hhmm, tz) {
  if (!hhmm) return "";
  const [hRaw, mRaw] = hhmm.split(":").map(Number);
  const ampm = hRaw >= 12 ? "PM" : "AM";
  const h = ((hRaw + 11) % 12) + 1;
  const mins = String(mRaw ?? 0).padStart(2, "0");
  return `${h}:${mins} ${ampm} ${tz || ""}`.trim();
}

/** Live rhythm so the welcome page is not a static essay about meetings. */
export function welcomeSchedule(cohort) {
  if (!cohort?.recurring?.length) return null;
  const tz = cohort.timezoneLabel || "";
  return el(
    "section.step__schedule",
    {},
    el("b.eyebrow", {}, "How the week runs"),
    el(
      "p.room__hint",
      {},
      `Founding cohort · ${cohort.name || "Founding 001"}. Times are ${tz || "the cohort timezone"}. Open Calendar anytime for the exact dates.`
    ),
    el(
      "ul.welcome-sched",
      {},
      cohort.recurring.map((item) => {
        const day = DAYS[item.weekday] ?? "Weekly";
        const when = item.mins
          ? `${day} · ${formatClock(item.time, tz)} · ${item.mins} min`
          : `${day} · ${formatClock(item.time, tz)}`;
        return el(
          "li.welcome-sched__item",
          {},
          el("b", {}, item.title),
          el("span", {}, when),
          item.where && el("span", {}, item.where),
          item.agenda && el("p", {}, item.agenda)
        );
      })
    ),
    el(
      "p.room__hint",
      {},
      "Discord is where the cohort talks between calls. Calendar is the clock. Today is the one next move. The board map is the whole path. You do not need to memorize this - you need to know where to look."
    )
  );
}

/**
 * Checklist that tracks watch / read / tasks / link so the first step feels
 * like the board is helping you finish in order - without treating you like a child.
 */
export function welcomeReadiness({ node, student, store, onMarked }) {
  const flags = student.stepFlags?.[node.id] ?? {};
  const tasks = node.tasks ?? [];
  const taskDone = (id) => student.tasks?.[id]?.state === TASK_STATE.DONE;
  const allTasks = tasks.length > 0 && tasks.every((task) => taskDone(task.id));
  const hasLink = Boolean(node.proof?.url);
  const watched = Boolean(flags.watched);
  const read = Boolean(flags.read);
  const optionalWatchOk = watched || read; // reading the letter counts if film is placeholder

  const rows = [
    {
      ok: optionalWatchOk,
      label: watched
        ? "Opened the welcome film"
        : read
          ? "Chose to read instead of watching"
          : "Open the film above, or mark that you will read the letter",
      act:
        !watched &&
        !read &&
        btn({
          label: "I'll read the letter",
          variant: "quiet",
          onclick: () => {
            store.setStepFlag(node.id, "read", true);
            onMarked?.();
          },
        }),
    },
    {
      ok: read || allTasks || hasLink,
      label: read || allTasks || hasLink ? "Welcome letter acknowledged" : "Read the letter, then mark it",
      act:
        !read &&
        !allTasks &&
        !hasLink &&
        btn({
          label: "I've read this",
          variant: "quiet",
          onclick: () => {
            store.setStepFlag(node.id, "read", true);
            onMarked?.();
          },
        }),
    },
    ...tasks.map((task) => ({
      ok: taskDone(task.id),
      label: taskDone(task.id) ? task.title : `Still open: ${task.title}`,
      act: null,
    })),
    {
      ok: hasLink,
      label: hasLink ? "First link saved - this step can light" : "Paste your note URL under Your first link",
      act: null,
    },
  ];

  const doneCount = rows.filter((row) => row.ok).length;
  const readyToLink = optionalWatchOk && (read || allTasks) && allTasks;
  const complete = hasLink && allTasks;

  return el(
    "section.step__ready",
    {},
    el("b.eyebrow", {}, "Your progress on this page"),
    el(
      "p.room__hint",
      {},
      complete
        ? "This orientation is done. The board will open the next steps that do not depend on each other - usually It runs and The four skills."
        : readyToLink
          ? "You are ready for the link. Paste it below and this step lights."
          : `Working through ${doneCount} of ${rows.length}. The board is keeping the order honest so you do not have to guess.`
    ),
    el(
      "ul.ready-list",
      {},
      rows.map((row) =>
        el(
          "li.ready-list__item",
          { class: row.ok ? "is-ok" : "" },
          el("span.ready-list__mark", { "aria-hidden": "true" }, row.ok ? "✓" : "·"),
          el("span.ready-list__label", {}, row.label),
          row.act
        )
      )
    )
  );
}

/** True when this step is finished enough to enable Continue / Next. */
export function isStepComplete(node, student) {
  if (!node) return false;
  if (node.proof?.url || student?.evidence?.[node.id]?.url) {
    if (node.id !== "or.start") return true;
    const tasks = node.tasks ?? [];
    const allTasks =
      tasks.length === 0 ||
      tasks.every((task) => student?.tasks?.[task.id]?.state === TASK_STATE.DONE);
    const flags = student?.stepFlags?.[node.id] ?? {};
    const oriented = Boolean(flags.watched || flags.read || allTasks);
    return allTasks && oriented;
  }
  return false;
}

/** Gentle check before saving the welcome link. Returns a warn message or null. */
export function welcomeSubmitWarn(node, student) {
  if (node.id !== "or.start") return null;
  const tasks = node.tasks ?? [];
  const missing = tasks.filter((task) => student.tasks?.[task.id]?.state !== TASK_STATE.DONE);
  if (!missing.length) return null;
  return `Almost - check “${missing.map((task) => task.title).join("” and “")}” above so you know the note is complete, then save the link.`;
}
