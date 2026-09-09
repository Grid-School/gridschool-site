/**
 * What a step is made of, and how far along it is. One list, read by the
 * thin column beside the lesson (bottom-up, like a pillar filling), by the
 * Save button (readings first), and by Next (everything).
 *
 * Rows, in the order they are done:
 *   read   each attached reading, opened and marked read (stepFlags read:<id>)
 *   lesson the page itself, when the page is the whole step (no readings, no tasks)
 *   task   each task, checked
 *   link   the URL that lights the node
 */

import { el } from "../dom.js";
import { TASK_STATE } from "../tasks.js";

export const ROW = { READ: "read", LESSON: "lesson", TASK: "task", LINK: "link" };

export function readFlag(moduleId) {
  return `read:${moduleId}`;
}

export function stepRows(node, student) {
  const flags = student?.stepFlags?.[node.id] ?? {};
  const readings = node.modules ?? [];
  const tasks = node.tasks ?? [];
  const rows = readings.map((module) => ({
    kind: ROW.READ,
    id: module.id,
    label: module.title,
    ok: Boolean(flags[readFlag(module.id)]),
  }));
  if (!readings.length && !tasks.length && node.lesson?.length) {
    rows.push({ kind: ROW.LESSON, id: "lesson", label: "The lesson", ok: Boolean(flags.read) });
  }
  for (const task of tasks) {
    rows.push({ kind: ROW.TASK, id: task.id, label: task.title, ok: student?.tasks?.[task.id]?.state === TASK_STATE.DONE });
  }
  rows.push({
    kind: ROW.LINK,
    id: "link",
    label: node.signoff ? "Link sent for sign-off" : "Link saved",
    ok: Boolean(node.proof?.url || student?.evidence?.[node.id]?.url),
  });
  return rows;
}

/** Everything before the link is done: the Save button unlocks. */
export function readyToSave(node, student) {
  return stepRows(node, student)
    .filter((row) => row.kind === ROW.READ || row.kind === ROW.LESSON)
    .every((row) => row.ok);
}

/** True when this step is finished enough to enable Next. */
export function isStepComplete(node, student) {
  if (!node) return false;
  return stepRows(node, student).every((row) => row.ok);
}

/**
 * The thin column. Rows render bottom-up so a step fills the way a node does
 * on the floor; the first thing to do sits at the bottom, the link on top.
 */
export function stepSpine({ node, student, store, onChange }) {
  const rows = stepRows(node, student);
  const done = rows.filter((row) => row.ok).length;
  return el(
    "aside.step__spine",
    { "aria-label": "Your progress on this step" },
    el("b.step__spine-count", {}, `${done}/${rows.length}`),
    el(
      "ol.spine",
      {},
      rows.map((row) =>
        el(
          "li.spine__row",
          { class: [`spine__row--${row.kind}`, row.ok ? "is-ok" : ""].join(" "), title: row.label },
          el("i.spine__dot", { "aria-hidden": "true" }),
          el("span.spine__label", {}, row.label),
          row.kind === ROW.LESSON && !row.ok
            ? el(
                "button.spine__act",
                {
                  type: "button",
                  onclick: () => {
                    store.setStepFlag(node.id, "read", true);
                    onChange?.();
                  },
                },
                "Read it"
              )
            : null
        )
      )
    )
  );
}
