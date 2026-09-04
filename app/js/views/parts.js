/**
 * Rows that appear on more than one surface. A task looks and behaves the same
 * whether you meet it on Today, on Tasks, or inside a step.
 *
 * The title is not a secret button. Done-when is always visible. Extra how-to
 * is a normal disclosure labelled Show steps / Hide steps. Actions sit in the
 * open, and they say what they do.
 */

import { el } from "../dom.js";
import { btn } from "../ui.js";
import { KIND_LABEL, TASK_STATE, formatEstimate } from "../tasks.js";
import { fmtDay, fmtTime, relativeDay } from "../time.js";
import { link } from "../../../config.js";
export { statusLabel } from "../copy.js";

export const stateIdOf = (task) => task.weekKey ?? task.id;

export function taskRow(task, { store, navigate, showGo = false } = {}) {
  const id = stateIdOf(task);
  const state = task.state ?? TASK_STATE.TODO;
  const done = state === TASK_STATE.DONE;
  const waiting = state === TASK_STATE.WAITING;
  const how = task.how ?? [];

  const steps = how.length
    ? el(
        "details.task__steps",
        {},
        el("summary", {}, "Show steps"),
        el("ol.task__how", {}, how.map((step) => el("li", {}, step)))
      )
    : null;

  if (steps) {
    steps.addEventListener("toggle", () => {
      steps.querySelector("summary").textContent = steps.open ? "Hide steps" : "Show steps";
    });
  }

  const acts = [];
  if (waiting) {
    acts.push(
      btn({
        label: "I'm working on this again",
        variant: "quiet",
        onclick: () => store.setTaskState(id, TASK_STATE.TODO),
      })
    );
  }
  if (showGo && task.nodeId) {
    acts.push(
      btn({
        label: "Go to this step",
        variant: "quiet",
        onclick: () => navigate("map", task.nodeId),
      })
    );
  }

  const row = el(
    "div.task",
    { class: `is-${state}` },
    el("button.task__mark", {
      type: "button",
      "aria-pressed": String(done),
      "aria-label": done ? `Mark ${task.title} not done` : `Mark ${task.title} done`,
      onclick: () => store.setTaskState(id, done ? TASK_STATE.TODO : TASK_STATE.DONE),
    }),
    el(
      "div.task__main",
      {},
      el("p.task__title", {}, task.title),
      el(
        "div.task__meta",
        {},
        el("span.task__kind", {}, KIND_LABEL[task.kind] ?? task.kind),
        task.est && el("span", {}, formatEstimate(task.est)),
        showGo && task.nodeTitle && el("span", {}, `step ${String(task.nodeN).padStart(2, "0")}`),
        task.recurring && el("span", {}, "every week"),
        waiting && el("span.task__wait", {}, "Waiting for review")
      ),
      task.done_when && el("p.task__dw", {}, el("b", {}, "Done when "), task.done_when),
      task.why && el("p.task__why", {}, task.why),
      steps,
      acts.length ? el("div.task__acts", {}, acts) : null
    )
  );

  return row;
}

export function eventRow(event, { now = new Date() } = {}) {
  const href = event.room ? link(event.room) : null;
  const go = event.room
    ? href
      ? btn({ label: event.open ?? "Open", variant: "quiet", href, target: "_blank" })
      : el("span.notwired", {}, "not connected yet")
    : null;

  return el(
    "div.ev",
    { class: `ev--${event.kind}` },
    el(
      "div.ev__when",
      {},
      el("b", {}, fmtDay(event.date)),
      el("span", {}, event.allDay ? "all week" : fmtTime(event.time))
    ),
    el(
      "div.ev__what",
      {},
      el("b", {}, event.title),
      el(
        "div.ev__meta",
        {},
        event.where && el("span", {}, event.where),
        event.who && el("span", {}, event.who),
        el("span.ev__rel", {}, relativeDay(event.date, now))
      ),
      (event.agenda || event.detail) && el("p.ev__agenda", {}, event.agenda ?? event.detail)
    ),
    go && el("div.ev__go", {}, go)
  );
}

/** CCVV scores + taught move under a returned verdict. */
export function reviewScores(review) {
  const c = review.ccvv;
  if (!c && !review.taughtMove) return null;
  const line = c
    ? `C ${c.communication} · C ${c.comprehension} · V ${c.vision} · V ${c.verification}`
    : null;
  return el(
    "div.rv__scores",
    {},
    line && el("p.rv__ccvv", {}, line),
    review.taughtMove && el("p.rv__move", {}, el("b", {}, "Taught move: "), review.taughtMove)
  );
}

export function reviewRow(review, { store, isAdmin = false } = {}) {
  const returned = review.state === "returned";
  return el(
    "div.rv",
    { class: `rv--${review.state}` },
    el(
      "div.rv__head",
      {},
      el("b", {}, review.title),
      el("span.rv__state", {}, returned ? (review.outcome === "changes" ? "Sent back for changes" : "Accepted") : "In review")
    ),
    el(
      "div.rv__meta",
      {},
      el("span", {}, `sent ${fmtDay(review.sent)}`),
      returned && review.returned && el("span", {}, `back ${fmtDay(review.returned)}`),
      review.link &&
        el("a", { href: review.link, target: "_blank", rel: "noopener" }, "the work ↗")
    ),
    review.verdict && el("p.rv__verdict", {}, review.verdict),
    reviewScores(review),
    !returned &&
      !isAdmin &&
      el("p.rv__hint", {}, "Notes come back Sunday evening. Do something else while you wait."),
    isAdmin &&
      !returned &&
      el(
        "div.rv__acts",
        {},
        btn({
          label: "Mark returned",
          variant: "quiet",
          onclick: () => store.setReviewState(review.id, "returned"),
        })
      )
  );
}
