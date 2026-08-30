/**
 * Welcome-step helpers: readiness that makes the first note feel finishable.
 * Calendar owns when. This page owns the note and the URL.
 */

import { el } from "../dom.js";
import { btn } from "../ui.js";
import { TASK_STATE } from "../tasks.js";

/**
 * Checklist that tracks watch / read / tasks / link so the first step feels
 * like the board is helping you finish in order, without treating you like a child.
 */
export function welcomeReadiness({ node, student, store, onMarked }) {
  const flags = student.stepFlags?.[node.id] ?? {};
  const tasks = node.tasks ?? [];
  const taskDone = (id) => student.tasks?.[id]?.state === TASK_STATE.DONE;
  const allTasks = tasks.length > 0 && tasks.every((task) => taskDone(task.id));
  const hasLink = Boolean(node.proof?.url);
  const watched = Boolean(flags.watched);
  const read = Boolean(flags.read);
  const rows = [
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
      label: hasLink ? "First link saved. This step can light." : "Paste your note URL under Your first link",
      act: null,
    },
  ];

  const doneCount = rows.filter((row) => row.ok).length;
  const readyToLink = (watched || read) && allTasks;
  const complete = hasLink && allTasks;

  return el(
    "section.step__ready",
    {},
    el("b.eyebrow", {}, "Your progress on this page"),
    el(
      "p.room__hint",
      {},
      complete
        ? "This chapter is done. The next steps are open on the map."
        : readyToLink
          ? "You are ready for the link. Paste it below and this step lights."
          : `${doneCount} of ${rows.length} done.`
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
  return `Check “${missing.map((task) => task.title).join("” and “")}” above so you know the note is complete, then save the link.`;
}
