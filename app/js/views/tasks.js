/**
 * Tasks. The list you come back to after two hours on LinkedIn and still know
 * where you were. Grouped by where the work belongs, not by due date, because
 * nothing here is due except the weekly commitments.
 */

import { el } from "../dom.js";
import { panel, empty, btn, meter } from "../ui.js";
import { buildQueue, remainingMinutes, formatEstimate, TASK_STATE, allNodeTasks, taskState } from "../tasks.js";
import { STATUS } from "../graph/model.js";
import { taskRow, stateIdOf } from "./parts.js";

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

  const done = allNodeTasks(graph)
    .map((task) => ({ ...task, state: taskState(student, task.id) }))
    .filter((task) => task.state === TASK_STATE.DONE)
    .sort((a, b) => a.nodeN - b.nodeN);

  return el(
    "div.view.view--tasks",
    {},
    el(
      "header.view__head",
      {},
      el("b.eyebrow", {}, `Week ${week}`),
      el("h1", {}, "Everything open"),
      el(
        "p.muted",
        {},
        queue.length
          ? `${queue.length} open tasks, about ${formatEstimate(remainingMinutes(queue))} of work. You will not run out of things to do.`
          : "Nothing open. That means a review is holding you, or you are genuinely ahead."
      )
    ),
    weekly.length
      ? panel(
          {
            eyebrow: "Every week, forever",
            title: "The commitments",
            note: "These reset Monday. They are the part that compounds.",
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
    !queue.length ? panel({ title: "Nothing open" }, empty("Check what you are waiting on.", "Reviews come back Sunday evening.")) : null,
    done.length
      ? panel(
          { eyebrow: "Behind you", title: `${done.length} done`, note: "Kept visible on purpose. This is the receipt of the work." },
          el("div.tasks.tasks--done", {}, done.map((task) => taskRow({ ...task }, { store, navigate, showGo: true })))
        )
      : null
  );
}
