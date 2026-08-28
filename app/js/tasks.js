/**
 * The task engine. This is the productivity system: it answers "what do I do
 * right now", "how do I know it is done", and "what can I do while I wait".
 *
 * Task state lives on the student. Everything else here is derived.
 */

import { STATUS, blockedBy } from "./graph/model.js";
import { weekRange, isoDate } from "./time.js";

export const TASK_STATE = {
  TODO: "todo",
  DOING: "doing",
  WAITING: "waiting",
  DONE: "done",
};

export const KIND_LABEL = {
  ship: "Ship",
  write: "Write",
  post: "Post",
  apply: "Search",
  practice: "Practice",
  record: "Record",
  evidence: "Turn in",
};

/** Flatten every node task into one indexable list. */
export function allNodeTasks(graph) {
  return graph.nodes.flatMap((node) =>
    (node.tasks ?? []).map((task) => ({ ...task, nodeId: node.id, nodeTitle: node.title, nodeN: node.n }))
  );
}

export function taskState(student, id) {
  return student?.tasks?.[id]?.state ?? TASK_STATE.TODO;
}

function withState(task, student) {
  return { ...task, state: taskState(student, task.id) };
}

/**
 * The queue, ordered so the top item is always the honest next action:
 * the current node's open tasks first, then this week's recurring work.
 */
export function buildQueue({ graph, curriculum, student, week }) {
  const focusNodes = graph.nodes
    .filter((node) => node.status === STATUS.OPEN && node.kind !== "future")
    .sort((a, b) => a.n - b.n);

  const nodeTasks = focusNodes.flatMap((node) =>
    (node.tasks ?? [])
      .map((task) => withState({ ...task, nodeId: node.id, nodeTitle: node.title, nodeN: node.n }, student))
      .filter((task) => task.state !== TASK_STATE.DONE)
  );

  const weeklyTasks = (curriculum.weekly ?? [])
    .filter((task) => week >= (task.fromWeek ?? 1))
    .map((task) => withState({ ...task, recurring: true, weekKey: `${task.id}#w${week}` }, student))
    .map((task) => ({ ...task, state: student?.tasks?.[task.weekKey]?.state ?? TASK_STATE.TODO }))
    .filter((task) => task.state !== TASK_STATE.DONE);

  return [...nodeTasks, ...weeklyTasks];
}

/**
 * The queue minus anything already handed over. Today asks for this rather than
 * the raw queue: a task you are waiting on is not a next action, and putting one
 * at the top of the list — or worse, in the primary button — teaches the student
 * that the list is decoration.
 *
 * The full ledger on the Tasks page still shows them, because that page is where
 * you go to change your mind about a hand-off.
 */
export function actionable(queue) {
  return queue.filter((task) => task.state !== TASK_STATE.WAITING);
}

/**
 * Reviews that came back and have not been read. This is the only badge on the
 * rail, because it is the only thing that is genuinely new information: work is
 * always waiting, but a verdict arrives once.
 */
export function returnedUnread(student) {
  const read = new Set(student?.readReviews ?? []);
  return (student?.reviews ?? []).filter((review) => review.state === "returned" && !read.has(review.id));
}

/** Tasks the student handed to me and cannot move forward alone. */
export function waitingOn({ graph, student }) {
  const waitingTasks = allNodeTasks(graph)
    .map((task) => withState(task, student))
    .filter((task) => task.state === TASK_STATE.WAITING);

  const openReviews = (student?.reviews ?? []).filter((review) => review.state === "in-review");

  const blockedNodes = graph.nodes
    .filter((node) => node.status === STATUS.LOCKED)
    .map((node) => ({ node, blockers: blockedBy(graph, node.id) }))
    .filter((entry) => entry.blockers.length);

  return { tasks: waitingTasks, reviews: openReviews, blockedNodes };
}

/**
 * What to do in parallel while something is in review. Curriculum names which
 * tasks are safe to run while blocked, so this never invents busywork.
 */
export function parallelWork({ graph, curriculum, student, week }) {
  const allowed = new Set(curriculum.parallelWhileWaiting ?? []);
  return actionable(buildQueue({ graph, curriculum, student, week }))
    .filter((task) => allowed.has(task.id))
    .slice(0, 4);
}

/**
 * The quota is weekly, so it has to be counted weekly. This used to read a
 * lifetime counter on the student and label it "this week", which meant a good
 * week in week 3 showed as met for the rest of the program — the one number the
 * whole deal rests on, quietly wrong. It now counts dated entries inside the
 * week's own date range.
 */
export function quotaStatus({ curriculum, student, cohort, week }) {
  const rule = (curriculum.weekly ?? []).find((task) => task.id === "w.quota");
  if (!rule || week < rule.fromWeek) {
    return { active: false, fromWeek: rule?.fromWeek ?? 3, applications: 0, outreach: 0 };
  }
  const counts = quotaCounts({ student, cohort, week });
  const met = counts.applications >= rule.target || counts.outreach >= rule.altTarget;
  return {
    active: true,
    met,
    ...counts,
    target: rule.target,
    altTarget: rule.altTarget,
    pct: Math.min(
      100,
      Math.round(Math.max(counts.applications / rule.target, counts.outreach / rule.altTarget) * 100)
    ),
  };
}

/** What the student logged inside one program week. */
export function quotaCounts({ student, cohort, week }) {
  const { start, end } = weekRange(cohort.start, week);
  const from = isoDate(start);
  const to = isoDate(end);
  const counts = { applications: 0, outreach: 0, posts: 0 };
  for (const entry of student?.quotaLog ?? []) {
    if (!entry?.at || entry.at < from || entry.at > to) continue;
    if (counts[entry.kind] !== undefined) counts[entry.kind] += 1;
  }
  return counts;
}

/** Rough time left this week, so the queue can honestly say "you have room". */
export function remainingMinutes(queue) {
  return queue.reduce((total, task) => total + (task.est ?? 0), 0);
}

export function formatEstimate(mins) {
  if (!mins) return "";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
