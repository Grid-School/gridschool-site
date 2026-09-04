/**
 * The graph, derived. Nothing here is stored: node status comes from whether an
 * evidence URL exists, and openness comes from whether prerequisites are lit.
 *
 * The one invariant the whole product rests on:
 *   a node lights only when a URL exists. Tasks are guidance.
 */

export const STATUS = {
  LIT: "lit",
  OPEN: "open",
  LOCKED: "locked",
  FUTURE: "future",
};

export const TRACK = {
  SPINE: "spine",
  DEPTH: "depth",
};

const DEPTH_FAMILIES = new Set(["world", "graph", "project"]);
// Career (signal) is a mixed family: core nodes are spine via node.track or
// family.track; expansion nodes set track: "depth" explicitly.

/** Spine is the graded path to the defense. Depth is elective. */
export function trackOf(node, families = []) {
  if (node.track === TRACK.SPINE || node.track === TRACK.DEPTH) return node.track;
  const family = families.find((item) => item.id === node.family);
  if (family?.track === TRACK.SPINE || family?.track === TRACK.DEPTH) return family.track;
  return DEPTH_FAMILIES.has(node.family) ? TRACK.DEPTH : TRACK.SPINE;
}

export function isSpine(node) {
  return (node.track ?? TRACK.SPINE) === TRACK.SPINE;
}

export function buildGraph(curriculum, student, { unlockAll = false } = {}) {
  const extra = student?.extraNodes ?? [];
  const overrides = student?.nodeOverrides ?? {};
  const families = curriculum.families ?? [];
  const nodes = [...curriculum.nodes, ...extra].map((node) => {
    const merged = { ...node, ...(overrides[node.id] ?? {}) };
    return { ...merged, track: trackOf(merged, families) };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const edges = [];
  for (const node of nodes) {
    for (const from of node.requires ?? []) {
      if (byId.has(from)) edges.push({ from, to: node.id, id: `${from}->${node.id}` });
    }
  }

  // `node.evidence` is the curriculum's description of what lights this node.
  // `node.proof` is the record the student attached. Keeping them apart matters:
  // one is the requirement, the other is whether it has been met.
  const evidence = student?.evidence ?? {};
  const reviews = student?.reviews ?? [];
  for (const node of nodes) {
    node.proof = evidence[node.id] ?? null;
    const latest = latestReview(node, reviews);
    node.reviewState = latest?.state ?? null;
    node.reviewOutcome = latest?.state === "returned" ? latest.outcome ?? OUTCOME.ACCEPTED : null;
    const lit = isLit(node, evidence, reviews);
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
  for (const node of nodes) {
    node.status = statusOf(node, byId, evidence, reviews);
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
  // student is. Derived here like status, never stored.
  const taskState = student?.tasks ?? {};
  for (const node of nodes) {
    const tasks = node.tasks ?? [];
    node.taskProgress = {
      done: tasks.filter((task) => taskState[task.id]?.state === "done").length,
      total: tasks.length,
    };
  }

  return { nodes, byId, edges, phases: curriculum.phases, families: curriculum.families ?? [] };
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

export function statusOf(node, byId, evidence, reviews = []) {
  if (isLit(node, evidence, reviews)) return STATUS.LIT;
  if (node.kind === "future") return STATUS.FUTURE;
  const requires = node.requires ?? [];
  const ready = requires.every((id) => {
    if (!byId.has(id)) return true;
    return satisfies(byId.get(id), node, evidence, reviews);
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

function openCore(graph) {
  return graph.nodes
    .filter((node) => node.status === STATUS.OPEN && node.kind !== "future")
    .sort((a, b) => a.n - b.n);
}

/**
 * The node the student should be working. Spine first; then depth they picked;
 * a merely offered depth node only when nothing else is open.
 */
export function nextUp(graph) {
  const open = openCore(graph);
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
 * a course with no depth.
 */
export function progress(graph) {
  const core = graph.nodes.filter((node) => node.kind !== "future");
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
