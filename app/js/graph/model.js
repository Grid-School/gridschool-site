/**
 * The graph, derived. Nothing here is stored: node status comes from whether an
 * evidence URL exists, and openness comes from whether prerequisites are lit.
 *
 * Most nodes light when a URL exists. A first-run node may explicitly use
 * `completion: "tasks"` when its work belongs inside GridSchool instead of in
 * a fake external artifact.
 *
 * Side quests (`track: "side"`) are the philosophy and foundations that sit
 * beside a student's own map: always visible, never required. They light like
 * any node, but they are never offered or hidden, never "next", and never in
 * the required count, so reading them is a choice and skipping them costs
 * nothing.
 *
 * Habit tasks (`kind: "count"`) are tallies that reset each day or week. They
 * never gate a node: a habit is kept, not finished.
 */

import { taskIsComplete, isCountTask } from "../task-state.js?v=ac1f443-202610240735";
import { typeOf, specOf } from "../../../data/node-types.mjs?v=ac1f443-202610240735";
import { prepOf, prepHint, opensLater, shortDay, isFreeMap, PAID_HINT } from "../prep.js?v=ac1f443-202610240735";

export { typeOf, specOf };

/** A node's type allows it to be "do this next" (habits and references never are). */
export const canBeNext = (node) => specOf(node).canBeNext !== false;
/** A node of this type counts toward "X of Y steps done". */
const counts = (node) => specOf(node).completes !== "never";

export const STATUS = {
  LIT: "lit",
  OPEN: "open",
  LOCKED: "locked",
  FUTURE: "future",
};

export const TRACK = {
  SPINE: "spine",
  DEPTH: "depth",
  SIDE: "side",
};

const DEPTH_FAMILIES = new Set(["graph", "project"]);
// Career (signal) is a mixed family: core nodes are spine via node.track or
// family.track; expansion nodes set track: "depth" explicitly.

const TRACKS = new Set(Object.values(TRACK));

/** Spine is the graded path to the defense. Depth is elective. Side is off the path. */
export function trackOf(node, families = []) {
  if (TRACKS.has(node.track)) return node.track;
  const family = families.find((item) => item.id === node.family);
  if (TRACKS.has(family?.track)) return family.track;
  return DEPTH_FAMILIES.has(node.family) ? TRACK.DEPTH : TRACK.SPINE;
}

export function isSpine(node) {
  return (node.track ?? TRACK.SPINE) === TRACK.SPINE;
}

export function isSide(node) {
  return node?.track === TRACK.SIDE;
}

/**
 * The number a student reads on a step. Path steps show their `n` ("07").
 * Side quests count on their own ("S1", "S2"…) in `n` order, so a map whose
 * side quests are stored at 101+ never shows "101" on the floor. Stored `n`
 * is untouched: it still orders the walk.
 */
export function stepNumber(node) {
  if (!node) return "";
  if (node.sideNumber) return node.sideNumber;
  return String(node.n ?? "").padStart(2, "0");
}

export function buildGraph(curriculum, student, { unlockAll = false, now = new Date() } = {}) {
  const extra = student?.extraNodes ?? [];
  const overrides = student?.nodeOverrides ?? {};
  const families = curriculum.families ?? [];
  const nodes = [...curriculum.nodes, ...extra].map((node) => {
    const merged = { ...node, ...(overrides[node.id] ?? {}) };
    return { ...merged, track: trackOf(merged, families) };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  nodes
    .filter(isSide)
    .sort((a, b) => a.n - b.n)
    .forEach((node, index) => {
      node.sideNumber = `S${index + 1}`;
    });

  // Parallel groups: nodes that share a place on the road, done in any order.
  // A group id in `requires` stands for the group: "all" waits on every node
  // in it, "pick" on `pick` of them. Lines are drawn from each member.
  const groups = new Map((curriculum.groups ?? []).map((group) => [group.id, { mode: "all", ...group, members: [] }]));
  for (const node of nodes) if (node.group && groups.has(node.group)) groups.get(node.group).members.push(node.id);
  const edges = [];
  for (const node of nodes) {
    for (const req of node.requires ?? []) {
      for (const from of groups.has(req) ? groups.get(req).members : [req]) {
        if (byId.has(from)) edges.push({ from, to: node.id, id: `${from}->${node.id}` });
      }
    }
  }

  // `node.evidence` is the curriculum's description of what lights this node.
  // `node.proof` is the record the student attached. Keeping them apart matters:
  // one is the requirement, the other is whether it has been met.
  const evidence = student?.evidence ?? {};
  const taskState = student?.tasks ?? {};
  const completionEvidence = { ...evidence };
  for (const node of nodes) {
    // Habits are tallies, not steps: they never hold a node open.
    const gating = (node.tasks ?? []).filter((task) => !isCountTask(task));
    if (node.completion !== "tasks" || !gating.length) continue;
    const complete = gating.every((task) => taskIsComplete(task, taskState[task.id] ?? {}));
    if (complete) completionEvidence[node.id] = { url: `gridschool:tasks/${node.id}`, internal: true };
  }
  // A campaign node lights when its day-0 email has gone out (the student's own
  // copy of the campaign records it; see search.js seedTarget).
  const sent = new Map((student?.search?.targets ?? []).map((t) => [t.id, t.touches?.email]));
  for (const node of nodes) {
    if (typeOf(node) === "campaign" && node.campaign && sent.get(node.campaign)) {
      completionEvidence[node.id] = { url: `gridschool:campaign/${node.campaign}`, internal: true };
    }
  }
  const reviews = student?.reviews ?? [];
  for (const node of nodes) {
    node.proof = evidence[node.id] ?? null;
    const latest = latestReview(node, reviews);
    node.reviewState = latest?.state ?? null;
    node.reviewOutcome = latest?.state === "returned" ? latest.outcome ?? OUTCOME.ACCEPTED : null;
    const lit = isLit(node, completionEvidence, reviews);
    // Submitted and not yet accepted: in review, or sent back for changes.
    node.awaitingSignoff = Boolean(node.signoff && node.proof?.url && !lit);
    // Sent back, and the link has not moved since: the fix is the next task.
    node.needsFix = Boolean(
      node.awaitingSignoff &&
        latest?.state === "returned" &&
        latest.outcome === OUTCOME.CHANGES &&
        (!latest.link || latest.link === node.proof.url)
    );
    if (node.needsFix) node.tasks = [...(node.tasks ?? []), fixTask(node, latest)];
  }
  // GridSchool Complete only (prep.js): the work we're doing for them, and a
  // step that opens on a date. Residency maps carry neither field.
  // A free map shows the same prepared steps as part of the paid plan: no tracker, tasks closed.
  const free = isFreeMap(curriculum);
  const prepState = free ? {} : student?.prep ?? {};
  for (const node of nodes) {
    node.status = statusOf(node, byId, completionEvidence, reviews, groups);
    const prep = prepOf(node, prepState);
    if (prep && free) {
      node.paidOnly = true;
      node.preparing = true;
      if (node.status !== STATUS.LIT) node.hint = PAID_HINT;
    } else if (prep) {
      node.prep = prep;
      // Their tasks wait for our work, unless the step says they come first.
      node.preparing = node.prepFirst !== false && !prep.ready;
      if (node.status !== STATUS.LIT) node.hint = prepHint(prep);
    }
    if (node.opens && node.status !== STATUS.LIT && opensLater(node, now)) {
      node.status = STATUS.FUTURE;
      node.hint = `Opens ${shortDay(node.opens)}`;
      node.coming = [`Opens ${shortDay(node.opens)}.`, node.coming].filter(Boolean).join(" ");
    }
    if (
      unlockAll &&
      (node.status === STATUS.LOCKED || node.status === STATUS.FUTURE)
    ) {
      node.devForced = true;
      node.status = STATUS.OPEN;
    }
  }

  // Depth is elective. A depth node the student has not picked is `offered`
  // once its prerequisites light, and stays off the map while they are not.
  const chosen = new Set(student?.chosen ?? []);
  for (const node of nodes) {
    node.chosen = chosen.has(node.id);
    node.offered = node.track === TRACK.DEPTH && node.status === STATUS.OPEN && !node.chosen;
    node.hidden = node.track === TRACK.DEPTH && node.status === STATUS.LOCKED && !node.chosen;
  }

  // Depth the map renders instead of hiding: how far into a node's tasks the
  // student is. Derived here like status, never stored. Habits are left out
  // for the same reason they do not gate completion.
  for (const node of nodes) {
    const tasks = (node.tasks ?? []).filter((task) => !isCountTask(task));
    node.taskProgress = {
      done: tasks.filter((task) => taskState[task.id]?.state === "done").length,
      total: tasks.length,
    };
  }

  return { nodes, byId, edges, groups, phases: curriculum.phases, families: curriculum.families ?? [], version: curriculum.version, plan: curriculum.plan, check: curriculum.check, started: curriculum.started };
}

/**
 * Lit means a URL exists. A node marked `signoff` (a project assignment) also
 * needs the review on that node returned: the URL is the submission, the
 * verdict is the light. Prerequisites use the same rule, so a project that is
 * only submitted does not open what depends on it.
 */
export function isLit(node, evidence, reviews = []) {
  if (!node || !evidence[node.id]?.url) return false;
  if (!node.signoff) return true;
  return Boolean(acceptedVerdict(node, evidence, reviews));
}

export const OUTCOME = { ACCEPTED: "accepted", CHANGES: "changes" };

/** Newest review on a node, or null. Reviews are stored newest first. */
export function latestReview(node, reviews = []) {
  return reviews.find((review) => review.nodeId === node.id) ?? null;
}

/**
 * A returned review that accepts the URL now on the node. A review with no
 * outcome (older records) is an acceptance. A review whose link is not the
 * current URL is stale: the student resubmitted after it, so it does not
 * light anything.
 */
export function acceptedVerdict(node, evidence, reviews = []) {
  const url = evidence[node.id]?.url;
  return (
    reviews.find(
      (review) =>
        review.nodeId === node.id &&
        review.state === "returned" &&
        (review.outcome ?? OUTCOME.ACCEPTED) === OUTCOME.ACCEPTED &&
        (!review.link || !url || review.link === url)
    ) ?? null
  );
}

/** The URL is in. For a sign-off node that is the submission, not the light. */
export function isSubmitted(node, evidence) {
  return Boolean(node && evidence[node.id]?.url);
}

/**
 * Unlock on submit, light on verdict. A submitted sign-off node opens what
 * depends on it, the way a PR under review does not stop the next ticket.
 * The exception is a `gate` (the defense and what follows it): a gate waits
 * for the verdict itself, because you defend reviewed work, not pending work.
 */
export function satisfies(prereq, dependent, evidence, reviews = []) {
  if (dependent.gate) return isLit(prereq, evidence, reviews);
  return isSubmitted(prereq, evidence);
}

export function statusOf(node, byId, evidence, reviews = [], groups = new Map()) {
  if (isLit(node, evidence, reviews)) return STATUS.LIT;
  if (node.kind === "future") return STATUS.FUTURE;
  const requires = node.requires ?? [];
  const ok = (id) => !byId.has(id) || satisfies(byId.get(id), node, evidence, reviews);
  const ready = requires.every((id) => {
    const group = groups.get(id);
    if (!group) return ok(id);
    const done = group.members.filter(ok).length;
    return group.mode === "pick" ? done >= (group.pick ?? group.members.length) : done === group.members.length;
  });
  return ready ? STATUS.OPEN : STATUS.LOCKED;
}

/**
 * The review came back asking for changes: that is now a task on the node,
 * derived like status, never stored. Its id is stable per review so the
 * student's check on it survives a redraw.
 */
function fixTask(node, review) {
  const ask = review.taughtMove || firstSentence(review.verdict) || "what the review asked for";
  return {
    id: `${node.id}.fix.${review.id}`,
    title: `Address the review: ${ask}`,
    doneWhen: "The link is updated and sent for review again.",
    derived: true,
  };
}

function firstSentence(text = "") {
  const match = text.trim().match(/^[^.!?\n]+[.!?]?/);
  return match ? match[0].trim() : "";
}

/**
 * The map the student sees: spine, the horizon, what they picked, what is on
 * offer. Locked depth waits out of sight until its prerequisites light. Edges
 * follow the nodes. `byId` keeps the whole graph so a hidden node can still be
 * opened by URL.
 */
export function visibleGraph(graph) {
  const nodes = graph.nodes.filter((node) => !node.hidden);
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  return { ...graph, nodes, edges };
}

/** Every upstream node that must light before `id` can open. */
export function ancestorsOf(graph, id) {
  const seen = new Set();
  const walk = (current) => {
    for (const from of graph.byId.get(current)?.requires ?? []) {
      if (seen.has(from)) continue;
      seen.add(from);
      walk(from);
    }
  };
  walk(id);
  return seen;
}

/** Direct prerequisites that are not lit yet. What is actually blocking. */
export function blockedBy(graph, id) {
  return (graph.byId.get(id)?.requires ?? [])
    .map((from) => graph.byId.get(from))
    .filter((node) => node && node.status !== STATUS.LIT);
}

/** Days from `now` to a node's due date (local midnight to midnight). */
function daysUntil(due, now) {
  const [y, m, d] = String(due).split("-").map(Number);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - start) / 86400000);
}

/** A due date this close (or past) moves a node to the front. */
export const DUE_SOON_DAYS = 3;

function openCore(graph, now = new Date()) {
  const soon = (node) => (node.due ? daysUntil(node.due, now) <= DUE_SOON_DAYS : false);
  return graph.nodes
    .filter((node) => node.status === STATUS.OPEN && node.kind !== "future" && !isSide(node) && canBeNext(node) && !node.preparing)
    .sort((a, b) => Number(soon(b)) - Number(soon(a)) || (soon(a) && soon(b) ? a.due.localeCompare(b.due) : 0) || a.n - b.n);
}

/**
 * The node the student should be working. A step due within three days
 * first; then spine; then depth they picked; a merely offered depth node only
 * when nothing else is open. Habits and references are never next.
 */
export function nextUp(graph, now = new Date()) {
  const open = openCore(graph, now);
  const spine = open.filter(isSpine);
  if (spine.length) return spine[0];
  const chosen = open.filter((node) => node.chosen);
  return (chosen.length ? chosen : open)[0] ?? null;
}

function tally(nodes) {
  const lit = nodes.filter((node) => node.status === STATUS.LIT);
  return {
    lit: lit.length,
    total: nodes.length,
    pct: nodes.length ? Math.round((lit.length / nodes.length) * 100) : 0,
  };
}

/**
 * Spine counts every required node. Depth counts what the student took on
 * (picked or lit), and reports separately how much is on offer and how much
 * exists, so "0 of 0" on a new board reads as a choice not made rather than
 * a course with no depth. Side quests are counted on their own and nowhere
 * else, so reading one never moves "Required X of Y".
 */
export function progress(graph) {
  const sideNodes = graph.nodes.filter((node) => node.kind !== "future" && isSide(node));
  // Habits are kept, not finished, so they never count toward "X of Y".
  // A free map counts only the steps a free seat can finish: never the ones we do on the paid plan.
  const core = graph.nodes.filter((node) => node.kind !== "future" && !isSide(node) && counts(node) && !node.paidOnly);
  const spineNodes = core.filter(isSpine);
  const depthNodes = core.filter((node) => !isSpine(node));
  const taken = depthNodes.filter((node) => node.chosen || node.status === STATUS.LIT);
  const depth = {
    ...tally(taken),
    offered: depthNodes.filter((node) => node.offered).length,
    available: depthNodes.length,
  };
  return {
    ...tally(core),
    spine: tally(spineNodes),
    depth,
    side: tally(sideNodes),
  };
}

export function nodesByPhase(graph) {
  const groups = new Map(graph.phases.map((phase) => [phase.id, { phase, nodes: [] }]));
  for (const node of graph.nodes.sort((a, b) => a.n - b.n)) {
    groups.get(node.phase)?.nodes.push(node);
  }
  return [...groups.values()].filter((group) => group.nodes.length);
}

/** The node plus everything upstream of it: the route that earns it. */
export function traceSet(graph, id) {
  const set = new Set([id]);
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    for (const from of graph.byId.get(current)?.requires ?? []) {
      if (set.has(from)) continue;
      set.add(from);
      stack.push(from);
    }
  }
  return set;
}
