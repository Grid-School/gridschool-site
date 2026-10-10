/**
 * Tasks. What is still open, grouped by step.
 * Receipts live on the map list. Today owns what to do next.
 */

import { el } from "../dom.js?v=d696edf-202610102057";
import { panel, empty, btn } from "../ui.js?v=d696edf-202610102057";
import { buildQueue, remainingMinutes, formatEstimate } from "../tasks.js?v=d696edf-202610102057";
import { STATUS, stepNumber } from "../graph/model.js?v=d696edf-202610102057";
import { taskRow } from "./parts.js?v=d696edf-202610102057";
import { dueLabel, dueBadge } from "./from-aden.js?v=d696edf-202610102057";

export function renderTasks(ctx) {
  const { state, store, navigate } = ctx;
  const { graph, student, curriculum, week } = state;

  const queue = buildQueue({ graph, curriculum, student, week });
  const byNode = new Map();
  const weekly = [];

  for (const task of queue) {
    if (task.recurring) weekly.push(task);
    else {
      if (!byNode.has(task.nodeId)) byNode.set(task.nodeId, []);
      byNode.get(task.nodeId).push(task);
    }
  }

  return el(
    "div.view.view--tasks",
    {},
    el(
      "header.view__head",
      {},
      el("b.eyebrow", {}, `Week ${week}`),
      el("h1", {}, "Open work"),
      el(
        "p.muted",
        {},
        queue.length
          ? `${queue.length} open · about ${formatEstimate(remainingMinutes(queue))}`
          : "Nothing open. A review is holding you, or you are ahead."
      ),
      steerNote(student),
      dueNote(graph, navigate)
    ),
    weekly.length
      ? panel(
          {
            eyebrow: "Every week",
            title: "The commitments",
            note: "These reset Monday.",
          },
          el("div.tasks", {}, weekly.map((task) => taskRow(task, { store, navigate })))
        )
      : null,
    [...byNode.entries()].map(([nodeId, tasks]) => {
      const node = graph.byId.get(nodeId);
      return panel(
        {
          eyebrow: [`Step ${stepNumber(node)}`, node.status === STATUS.OPEN ? "Current" : node.status, dueLabel(node.fromAden?.due)]
            .filter(Boolean)
            .join(" · "),
          title: node.title,
          note: node.evidence,
          actions: btn({ label: "Open this step", variant: "quiet", onclick: () => navigate("map", nodeId) }),
        },
        el("div.tasks", {}, tasks.map((task) => taskRow(task, { store, navigate })))
      );
    }),
    !queue.length ? panel({ title: "Nothing open" }, empty("Check what you are waiting on.", "Reviews come back Sunday evening.")) : null
  );
}

/**
 * Aden's weekly steer (Focus / Next from the desk's This week box). The Coach page
 * used to be its only home; the Tasks page is where a student plans, so it
 * lives here, and only when there is something to say.
 */
export function steerNote(student) {
  const focus = String(student?.focus ?? "").trim();
  const next = String(student?.next ?? "").trim();
  if (!focus && !next) return null;
  return el(
    "div.steer",
    {},
    el("b.eyebrow", {}, "From Aden this week"),
    focus && el("p", {}, el("b", {}, "Focus: "), focus),
    next && el("p", {}, el("b", {}, "Next: "), next)
  );
}

/**
 * Due dates Aden set on steps (a module step's fill.due), soonest first.
 * Lit and future steps drop out. Pure: the Tasks header and its test read
 * the same list.
 */
export function dueSoon(graph, { limit = 3 } = {}) {
  return (graph?.nodes ?? [])
    .filter((node) => node.status !== STATUS.LIT && node.kind !== "future" && dueLabel(node.fromAden?.due))
    .sort((a, b) => a.fromAden.due.localeCompare(b.fromAden.due) || a.n - b.n)
    .slice(0, limit)
    .map((node) => ({ id: node.id, due: node.fromAden.due, label: dueLabel(node.fromAden.due), step: stepNumber(node), title: node.title }));
}

/** Beside Aden's steer: the steps he put a date on. Null when nothing is dated. */
export function dueNote(graph, navigate) {
  const rows = dueSoon(graph);
  if (!rows.length) return null;
  return el(
    "div.steer.steer--due",
    {},
    el("b.eyebrow", {}, "Dated by Aden"),
    rows.map((row) =>
      el(
        "p.steer__due",
        {},
        dueBadge(row.due),
        el("button.steer__step", { type: "button", onclick: () => navigate?.("map", row.id) }, `${row.step} · ${row.title}`)
      )
    )
  );
}
