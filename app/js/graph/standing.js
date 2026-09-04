/**
 * How a node stands, in one word, for every surface.
 *
 * `status` (model.js) is the rule: lit, open, locked, future. Standing is
 * status plus two things only a whole board knows: which open node is the one
 * to do next, and whether a sign-off node is waiting on a verdict or was sent
 * back. The floor, the list, the HUD legend and the hover line all read this,
 * so "You are here" on the map is the same node the list marks "Do this next".
 *
 * Order matters for a reader: what to do next, what else you can do, what is
 * waiting on someone else, what is done, what is ahead.
 */

export const STANDING = {
  NEXT: "next",
  OPEN: "open",
  FIX: "fix",
  REVIEW: "review",
  LIT: "lit",
  OFFERED: "offered",
  LOCKED: "locked",
  FUTURE: "future",
};

export function standingOf(node, nextId) {
  if (node.needsFix) return STANDING.FIX;
  if (node.awaitingSignoff) return STANDING.REVIEW;
  if (node.offered) return STANDING.OFFERED;
  if (node.status === "lit") return STANDING.LIT;
  if (node.id === nextId) return STANDING.NEXT;
  if (node.status === "open") return STANDING.OPEN;
  if (node.status === "future") return STANDING.FUTURE;
  return STANDING.LOCKED;
}

/** The words a student reads beside a node. */
export const STANDING_LABEL = {
  [STANDING.NEXT]: "Do this next",
  [STANDING.OPEN]: "You can do this now",
  [STANDING.FIX]: "Changes came back",
  [STANDING.REVIEW]: "In review",
  [STANDING.LIT]: "Done",
  [STANDING.OFFERED]: "On offer",
  [STANDING.LOCKED]: "Ahead",
  [STANDING.FUTURE]: "Later",
};

/** Palette key per standing (scene3d/palette.js reads these tokens from app.css). */
export const STANDING_TONE = {
  [STANDING.NEXT]: "open",
  [STANDING.OPEN]: "open",
  [STANDING.FIX]: "amber",
  [STANDING.REVIEW]: "amber",
  [STANDING.LIT]: "lit",
  [STANDING.OFFERED]: "open",
  [STANDING.LOCKED]: "locked",
  [STANDING.FUTURE]: "amber",
};

/** The legend, in reading order. */
export const LEGEND = [
  STANDING.NEXT,
  STANDING.OPEN,
  STANDING.REVIEW,
  STANDING.FIX,
  STANDING.LIT,
  STANDING.OFFERED,
  STANDING.LOCKED,
  STANDING.FUTURE,
];

/**
 * The sequence the map walks and the list prints: `n` order. Both surfaces
 * call this rather than sorting themselves, so they cannot drift.
 */
export function inSequence(nodes) {
  return [...nodes].sort((a, b) => a.n - b.n);
}
