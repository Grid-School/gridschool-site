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

const DEPTH_FAMILIES = new Set(["world", "graph"]);

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

export function buildGraph(curriculum, student) {
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
  for (const node of nodes) {
    node.proof = evidence[node.id] ?? null;
  }
  for (const node of nodes) {
    node.status = statusOf(node, byId, evidence);
  }

  // Depth the map renders instead of hiding: how far into a node's tasks the
  // student is, and where its review stands. Derived here like status, never stored.
  const taskState = student?.tasks ?? {};
  const reviews = student?.reviews ?? [];
  for (const node of nodes) {
    const tasks = node.tasks ?? [];
    node.taskProgress = {
      done: tasks.filter((task) => taskState[task.id]?.state === "done").length,
      total: tasks.length,
    };
    const latest = reviews.find((review) => review.nodeId === node.id);
    node.reviewState = latest?.state ?? null;
  }

  return { nodes, byId, edges, phases: curriculum.phases, families: curriculum.families ?? [] };
}

export function statusOf(node, byId, evidence) {
  if (evidence[node.id]?.url) return STATUS.LIT;
  if (node.kind === "future") return STATUS.FUTURE;
  const requires = node.requires ?? [];
  const ready = requires.every((id) => {
    if (!byId.has(id)) return true;
    return Boolean(evidence[id]?.url);
  });
  return ready ? STATUS.OPEN : STATUS.LOCKED;
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

/** The node the student should be working. Spine first; depth only if no spine is open. */
export function nextUp(graph) {
  const open = openCore(graph);
  const spine = open.filter(isSpine);
  return (spine.length ? spine : open)[0] ?? null;
}

function countTrack(graph, track) {
  const nodes = graph.nodes.filter((node) => node.kind !== "future" && (node.track ?? TRACK.SPINE) === track);
  const lit = nodes.filter((node) => node.status === STATUS.LIT);
  return {
    lit: lit.length,
    total: nodes.length,
    pct: nodes.length ? Math.round((lit.length / nodes.length) * 100) : 0,
  };
}

export function progress(graph) {
  const spine = countTrack(graph, TRACK.SPINE);
  const depth = countTrack(graph, TRACK.DEPTH);
  const core = graph.nodes.filter((node) => node.kind !== "future");
  const lit = core.filter((node) => node.status === STATUS.LIT);
  return {
    lit: lit.length,
    total: core.length,
    pct: core.length ? Math.round((lit.length / core.length) * 100) : 0,
    spine,
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
