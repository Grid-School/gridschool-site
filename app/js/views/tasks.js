/**
 * Tasks. What is still open, grouped by step.
 * Receipts live on the map list. Today owns what to do next.
 */

import { el } from "../dom.js";
import { panel, empty, btn } from "../ui.js";
import { buildQueue, remainingMinutes, formatEstimate } from "../tasks.js";
import { STATUS } from "../graph/model.js";
import { taskRow } from "./parts.js";

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
      )
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
          eyebrow: `Step ${String(node.n).padStart(2, "0")} · ${node.status === STATUS.OPEN ? "Current" : node.status}`,
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
