/**
 * Where each node stands on the floor. Pure: graph in, positions and edge
 * lists out. No three.js, so it is unit-testable and the camera, pillars and
 * beams all read one plan.
 *
 * Depth is sequence. Nodes are walked in `n` order (a topological sort of
 * `requires`, see ops/curriculum-operating-plan.md), and every node stands
 * one STEP further ahead than the one before it: no two rings are ever the
 * same distance from the camera, so "the next one" is always literally the
 * next one forward. Finishing a node is a step ahead.
 *
 * Width is classification. Each family has a lane (curriculum.json): Career
 * left, Skills and Mission centre-left, Repo centre-right, Graph right, with
 * the world and the student's own system between. Two consecutive nodes never
 * share an x, so the walk always turns.
 *
 * Two kinds of edge. The **sequence** (n → n+1, solid) is the road. Every
 * other `requires` edge is a **tie** (dashed): a prerequisite that is not the
 * step right before you, drawn so the dependency is visible without becoming
 * a second road.
 */

export const NODE_R = 33;
/** Ahead per node. More than a diameter, so rings never overlap in depth. */
export const STEP = 120;
/** Between lane centres. */
export const LANE_W = 230;
/** Lanes are 0..3 in the data; this lane sits at x = 0. */
const LANE_CENTER = 1.5;
/** A same-lane repeat is nudged this far so the walk still turns. */
const STAGGER = 0.45;

export function planFloor(graph) {
  const laneOf = new Map((graph.families ?? []).map((family) => [family.id, family.lane]));
  const ordered = [...graph.nodes].sort((a, b) => a.n - b.n);
  const at = new Map();

  let previousX = null;
  ordered.forEach((node, rank) => {
    let x = ((laneOf.get(node.family) ?? LANE_CENTER) - LANE_CENTER) * LANE_W;
    if (previousX !== null && Math.abs(x - previousX) < 1) {
      x += (rank % 2 ? 1 : -1) * LANE_W * STAGGER;
    }
    at.set(node.id, { x, z: -rank * STEP, rank, r: node.r ?? NODE_R });
    previousX = x;
  });

  const sequence = [];
  for (let i = 1; i < ordered.length; i += 1) {
    sequence.push({ from: ordered[i - 1].id, to: ordered[i].id });
  }
  const road = new Set(sequence.map((edge) => `${edge.from}->${edge.to}`));
  const ties = (graph.edges ?? []).filter((edge) => !road.has(`${edge.from}->${edge.to}`) && at.has(edge.from) && at.has(edge.to));

  return { at, order: ordered.map((node) => node.id), sequence, ties, box: boxOf(at) };
}

/** The floor's extent, padded by a node. Empty graphs get a unit box. */
function boxOf(at) {
  if (!at.size) return { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of at.values()) {
    minX = Math.min(minX, p.x - p.r);
    maxX = Math.max(maxX, p.x + p.r);
    minZ = Math.min(minZ, p.z - p.r);
    maxZ = Math.max(maxZ, p.z + p.r);
  }
  return { minX, maxX, minZ, maxZ };
}
