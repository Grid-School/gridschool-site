/**
 * The one next action. Today, the Coach, and the first-run screen all quote
 * this so they cannot disagree. The board is the source of truth; this is
 * only the sentence we put at the top of the page.
 */

import { buildQueue, actionable, waitingOn, returnedUnread } from "../tasks.js";
import { nextUp } from "../graph/model.js";

export function nextAction(state) {
  const { graph, student, curriculum, week } = state;
  const unread = returnedUnread(student);
  const queue = actionable(buildQueue({ graph, curriculum, student, week }));
  const waiting = waitingOn({ graph, student });
  const node = nextUp(graph);

  if (unread.length) {
    const review = unread[0];
    return {
      kind: "review",
      title: `${review.title} came back`,
      why: review.verdict ?? "Read the verdict, then keep moving.",
      review,
      node,
      task: queue[0] ?? null,
    };
  }

  if (queue[0]) {
    const task = queue[0];
    return {
      kind: "task",
      title: task.title,
      why: task.done_when ? `Done when ${task.done_when}` : node?.evidence ?? student.next,
      node,
      task,
    };
  }

  if (waiting.reviews.length) {
    return {
      kind: "wait",
      title: `${waiting.reviews.length} waiting for review. Notes come back Sunday evening.`,
      why: "Nothing here is on you. Do a different step, or rest.",
      node,
      task: null,
    };
  }

  return {
    kind: "open",
    title: student.next || "Open the Grid and pick the next step",
    why: node?.evidence ?? "This gets set on Monday after your review comes back.",
    node,
    task: null,
  };
}
