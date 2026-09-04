/**
 * Layout. Columns are time. Rails have a home: Career above, skills in the
 * middle, portfolio below. Extra nodes in a fat column swell out from the
 * center. The edges move. The middle stays put. Neighbors stay near neighbors.
 * A student's saved layout always wins. The lattice this produces is a seed;
 * `relax.js` then lets the unpinned nodes settle so chains read as chains and
 * families gather (see that file for the forces).
 */

import { relax } from "./relax.js";

export const COL_W = 206;
/** Center to center. Every pair of stacked nodes uses this, never a squeeze. */
export const LANE_H = 216;

const RADIUS = { core: 33, future: 25, outcome: 40 };
/** Rail order, top to bottom: Career · The world · Skills+Mission · Repo · Your system · Graph. */
const FAMILY_RANK = { signal: 0, linkedin: 0, world: 0.5, ccvv: 1, capstone: 1, portfolio: 2, project: 2.5, graph: 3 };

export function radiusOf(node) {
  if (node.kind === "future") return RADIUS.future;
  if (node.phase === "outcome") return RADIUS.outcome;
  return RADIUS.core;
}

/** Assign x, y, r to every node. Mutates the graph nodes in place. */
export function applyLayout(graph, savedLayout = {}) {
  const columns = new Map();
  for (const node of graph.nodes) {
    const col = node.col ?? 0;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col).push(node);
  }

  for (const [col, nodes] of columns) {
    for (const node of nodes) {
      node.r = radiusOf(node);
      const saved = savedLayout[node.id];
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        node.x = saved.x;
        node.y = saved.y;
        node.pinned = true;
      } else {
        node.x = col * COL_W;
        node.pinned = false;
      }
    }
    placeLump(nodes.filter((node) => !node.pinned));
  }
  relax(graph.nodes, graph.edges ?? []);
  return graph;
}

/**
 * Skills sit on y = 0. LinkedIn and portfolio hold ±LANE_H until a column
 * has more than one middle node, then only those rails step out by one step.
 */
function placeLump(nodes) {
  const top = nodes.filter((node) => railOf(node) === "top").sort(stackOrder);
  const mid = nodes.filter((node) => railOf(node) === "mid").sort(stackOrder);
  const bot = nodes.filter((node) => railOf(node) === "bot").sort(stackOrder);

  spreadAround(mid, 0);
  const midMin = mid.length ? Math.min(...mid.map((node) => node.y)) : 0;
  const midMax = mid.length ? Math.max(...mid.map((node) => node.y)) : 0;

  stackInto(top, mid.length ? midMin - LANE_H : -LANE_H, "up");
  stackInto(bot, mid.length ? midMax + LANE_H : LANE_H, "down");
}

function railOf(node) {
  if (node.family === "signal" || node.family === "linkedin" || node.family === "world") {
    return "top";
  }
  if (node.family === "portfolio" || node.family === "project" || node.family === "graph") return "bot";
  return "mid";
}

function spreadAround(nodes, center) {
  const count = nodes.length;
  if (!count) return;
  nodes.forEach((node, index) => {
    node.y = center + (index - (count - 1) / 2) * LANE_H;
  });
}

function stackInto(nodes, edge, direction) {
  if (!nodes.length) return;
  nodes.forEach((node, index) => {
    node.y =
      direction === "up"
        ? edge - (nodes.length - 1 - index) * LANE_H
        : edge + index * LANE_H;
  });
}

/**
 * Career stays the top rail. Skills and capstone share the middle.
 * Portfolio is always under those. Authored `lane` only breaks ties.
 */
function stackOrder(a, b) {
  const family = rankOf(a) - rankOf(b);
  if (family) return family;
  const lane = (Number(a.lane) || 0) - (Number(b.lane) || 0);
  if (lane) return lane;
  return (a.n ?? 0) - (b.n ?? 0);
}

function rankOf(node) {
  return FAMILY_RANK[node.family] ?? 1;
}

/** The left pad defaults wide because the SVG rail labels hang there. */
export function bounds(graph, pad = 130, left = Math.max(pad, 300)) {
  if (!graph.nodes.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  const xs = graph.nodes.map((n) => n.x);
  const ys = graph.nodes.map((n) => n.y);
  return {
    minX: Math.min(...xs) - left,
    minY: Math.min(...ys) - pad,
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
  };
}

/**
 * One header per time band. A column's phase prefers a Career spine node
 * in that column, so two phases cannot claim the same x and sit on each other.
 */
export function phaseBands(graph) {
  const byCol = new Map();
  for (const node of graph.nodes) {
    const col = node.col ?? 0;
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col).push(node);
  }

  const columns = [...byCol.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([col, nodes]) => {
      const spine =
        nodes.find((node) => node.family === "signal" && node.track !== "depth") ??
        nodes.find((node) => node.family === "signal") ??
        nodes.find((node) => node.family === "linkedin") ??
        nodes[0];
      const phase = (graph.phases ?? []).find((item) => item.id === spine.phase);
      const weeks = nodes.flatMap((node) => node.weeks ?? []).filter(Number.isFinite);
      return {
        col,
        phase,
        minX: Math.min(...nodes.map((node) => node.x - node.r)),
        maxX: Math.max(...nodes.map((node) => node.x + node.r)),
        weeks: weeks.length
          ? `${Math.min(...weeks)} to ${Math.max(...weeks)}`
          : phase?.weeks ?? "",
      };
    });

  const bands = [];
  for (const column of columns) {
    const last = bands.at(-1);
    const same = last && last.phase?.id && last.phase.id === column.phase?.id;
    if (same) {
      last.maxX = column.maxX;
      last.weeks = joinWeeks(last.weeks, column.weeks);
    } else {
      bands.push({ ...column });
    }
  }
  return bands;
}

function joinWeeks(a, b) {
  const nums = `${a} ${b}`
    .replace(/to/gi, " ")
    .replace(/[–—-]/g, " ")
    .split(/\s+/)
    .map(Number)
    .filter(Number.isFinite);
  if (!nums.length) return a || b;
  return `${Math.min(...nums)} to ${Math.max(...nums)}`;
}

/**
 * Every edge is one cubic, and both ends travel horizontally. The wire leaves
 * the east or west of a circle and arrives the same way, so a tall drop is an
 * S, not a plug in the top of the next node. Same-column edges bulge east and
 * still enter on the horizontal.
 *
 * One curve per edge, never a chain of segments: a path with corners in it reads
 * as plumbing, and this graph is meant to read as flow.
 */
export function edgePath(a, b) {
  const c = edgeCurve(a, b);
  return `M ${round(c.x1)} ${round(c.y1)} C ${round(c.c1x)} ${round(c.c1y)} ${round(c.c2x)} ${round(c.c2y)} ${round(c.x2)} ${round(c.y2)}`;
}

/**
 * The one cubic behind every edge, as eight numbers. The SVG scene turns it
 * into a path string; the 3D scene samples it onto the floor. One curve, two
 * renderers, so the beams and the wires cannot disagree about the route.
 */
export function edgeCurve(a, b) {
  const dx = b.x - a.x;
  if (Math.abs(dx) < 8) return sameColumnCurve(a, b);
  return horizontalCurve(a, b, dx);
}

/** A point on the cubic at t in [0, 1]. */
export function pointOnCurve(c, t) {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * c.x1 + w1 * c.c1x + w2 * c.c2x + w3 * c.x2,
    y: w0 * c.y1 + w1 * c.c1y + w2 * c.c2y + w3 * c.y2,
  };
}

/**
 * Control points reach out half the span. Capping this was a mistake worth
 * naming: a long edge with short handles is a diagonal line with two little
 * kinks on the ends, which is the one thing the board must never look like.
 * Half the span keeps a long edge a true S and a short one a gentle bow.
 */
function tension(distance) {
  return Math.max(30, Math.abs(distance) * 0.5);
}

function horizontalCurve(a, b, dx) {
  const dir = dx >= 0 ? 1 : -1;
  const x1 = a.x + dir * (a.r + GAP);
  const x2 = b.x - dir * (b.r + GAP);
  const pull = tension(x2 - x1);
  return { x1, y1: a.y, c1x: x1 + dir * pull, c1y: a.y, c2x: x2 - dir * pull, c2y: b.y, x2, y2: b.y };
}

function sameColumnCurve(a, b) {
  const dir = 1;
  const x1 = a.x + dir * (a.r + GAP);
  const x2 = b.x + dir * (b.r + GAP);
  const pull = Math.max(40, Math.abs(b.y - a.y) * 0.35);
  return { x1, y1: a.y, c1x: x1 + dir * pull, c1y: a.y, c2x: x2 + dir * pull, c2y: b.y, x2, y2: b.y };
}

/** Breathing room between the rim and the wire, so the two never touch. */
const GAP = 5;

const round = (value) => Math.round(value * 10) / 10;

/** Where a new node should land: right of the busiest column, stacked under it. */
export function freeSlot(graph) {
  const maxCol = Math.max(0, ...graph.nodes.map((n) => n.col ?? 0));
  const inCol = graph.nodes.filter((n) => (n.col ?? 0) === maxCol);
  if (inCol.length >= 5) return { col: maxCol + 1, lane: 0 };
  return { col: maxCol, lane: inCol.length };
}
