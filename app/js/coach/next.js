/**
 * The one next action. Today and the Coach both quote
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
      why: review.verdict ?? "Read the reviewer's verdict before you continue.",
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
      title: `${waiting.reviews.length} ${waiting.reviews.length === 1 ? "item is" : "items are"} waiting for review. Notes come back Sunday evening.`,
      why: "Continue with another open step while you wait.",
      node,
      task: null,
    };
  }

  return {
    kind: "open",
    title: student.next || "Open the Board and choose the next step",
    why: node?.evidence ?? "Your next step will be set on Monday after your review comes back.",
    node,
    task: null,
  };
}
