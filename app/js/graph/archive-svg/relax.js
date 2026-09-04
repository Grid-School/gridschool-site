/**
 * Relaxation. The column layout gives every node a truthful seed: x is time,
 * y is its rail. Left there, the board is a lattice and reads as a spreadsheet.
 * This pass lets the nodes settle the way a hand-drawn map would: chains pull
 * their links toward them, families gather, and nothing sits on anything else.
 *
 * Deterministic on purpose. No random start, fixed step count, nodes visited
 * in `n` order, so two loads of the same board draw the same board and the
 * walkthrough can assert on it. Pinned nodes (a student's saved drag) never move.
 *
 * Forces, each small:
 *   anchor   x springs hard to its time column, y softly to its rail seed
 *   edge     an edge wants its two ends level, and about one column apart
 *   family   a node drifts toward the mean y of its family
 *   repel    two nodes closer than a node-plus-label box push apart, in y
 */

/** Minimum center-to-center clearance. Wider than tall: labels hang below. */
export const CLEAR_X = 165;
export const CLEAR_Y = 150;

const STEPS = 160;
const DAMP = 0.82;
const K = { anchorX: 0.09, anchorY: 0.012, edge: 0.03, family: 0.006, repel: 0.6 };
/** How far x may drift from its column. Time stays legible. */
const X_DRIFT = 46;

export function relax(nodes, edges) {
  const free = nodes.filter((node) => !node.pinned);
  if (free.length < 2) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seed = new Map(free.map((node) => [node.id, { x: node.x, y: node.y }]));
  const vel = new Map(free.map((node) => [node.id, { x: 0, y: 0 }]));
  const ordered = [...free].sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  const links = edges
    .map((edge) => [byId.get(edge.from), byId.get(edge.to)])
    .filter(([a, b]) => a && b);

  for (let step = 0; step < STEPS; step += 1) {
    const force = new Map(free.map((node) => [node.id, { x: 0, y: 0 }]));
    const push = (node, fx, fy) => {
      const f = force.get(node.id);
      if (f) {
        f.x += fx;
        f.y += fy;
      }
    };

    for (const node of ordered) {
      const home = seed.get(node.id);
      push(node, (home.x - node.x) * K.anchorX, (home.y - node.y) * K.anchorY);
    }

    for (const [a, b] of links) {
      const dy = b.y - a.y;
      push(a, 0, dy * K.edge);
      push(b, 0, -dy * K.edge);
    }

    for (const [, members] of groupBy(nodes, (node) => node.family)) {
      if (members.length < 2) continue;
      const mean = members.reduce((sum, node) => sum + node.y, 0) / members.length;
      for (const node of members) push(node, 0, (mean - node.y) * K.family);
    }

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) >= CLEAR_X || Math.abs(dy) >= CLEAR_Y) continue;
        const gap = CLEAR_Y - Math.abs(dy);
        const dir = dy === 0 ? ((a.n ?? 0) < (b.n ?? 0) ? -1 : 1) : Math.sign(dy);
        push(a, 0, -dir * gap * K.repel * 0.5);
        push(b, 0, dir * gap * K.repel * 0.5);
      }
    }

    for (const node of ordered) {
      const v = vel.get(node.id);
      const f = force.get(node.id);
      v.x = (v.x + f.x) * DAMP;
      v.y = (v.y + f.y) * DAMP;
      const home = seed.get(node.id);
      node.x = clamp(node.x + v.x, home.x - X_DRIFT, home.x + X_DRIFT);
      node.y += v.y;
    }
  }

  settle(nodes, ordered);
  for (const node of free) {
    node.x = Math.round(node.x);
    node.y = Math.round(node.y);
  }
  return nodes;
}

/**
 * Springs leave residual overlap when three or more nodes crowd one column.
 * Sweep top to bottom and push the lower one down until the pair clears.
 */
function settle(nodes, movable) {
  const canMove = new Set(movable.map((node) => node.id));
  for (let pass = 0; pass < 6; pass += 1) {
    let moved = false;
    const sorted = [...nodes].sort((a, b) => a.y - b.y || (a.n ?? 0) - (b.n ?? 0));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        if (Math.abs(b.x - a.x) >= CLEAR_X) continue;
        const need = CLEAR_Y - (b.y - a.y);
        if (need <= 0) continue;
        if (canMove.has(b.id)) b.y += need;
        else if (canMove.has(a.id)) a.y -= need;
        else continue;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
