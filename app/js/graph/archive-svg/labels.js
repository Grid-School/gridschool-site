/**
 * Rail labels share one gutter column on the map. Two families whose first
 * nodes sit on the same row (Career over The world, Repo beside Your system)
 * would otherwise print on top of each other.
 */

/**
 * Minimum spacing in scene units. Labels keep a constant on-screen size (they
 * scale by 1/zoom), so the gap has to clear one line of text at the fit zoom,
 * where the whole board is visible and the gutter is actually read. At fit the
 * board is roughly a quarter scale, so an 11px line is about 44 units tall.
 */
export const LABEL_GAP = 48;

/**
 * Sort by y and push each label below the one before it until they clear.
 * Order is preserved, so a label never jumps past its neighbour, and a set
 * with no collisions comes back unchanged apart from the sort.
 */
export function spreadLabels(items, gap = LABEL_GAP) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) {
    const floor = sorted[i - 1].y + gap;
    if (sorted[i].y < floor) sorted[i] = { ...sorted[i], y: floor };
  }
  return sorted;
}
