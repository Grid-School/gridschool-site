/**
 * How a node stands, in one word, for every surface.
 *
 * `status` (model.js) is the rule: lit, open, locked, future. Standing is
 * status plus two things only a whole board knows: which open node is the one
 * to do next, and whether a sign-off node is waiting on a verdict or was sent
 * back. The floor, the list, the HUD legend and the hover line all read this,
 * so "You are here" on the map is the same node the list marks "Do this next".
 *
 * Eight standings exist because eight things can be true of a node. A reader
 * sees four: Next (the beacon), Open (a stump), Done (green), Ahead (a flat
 * dim disc). An elective on offer is Open with a dashed rim: a door, not a
 * wall. Review and Sent back are amber and appear only when they are true.
 * "Later" (kind: future) reads as Ahead; the distinction is the model's, not
 * the student's.
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
  [STANDING.OFFERED]: "Elective, open",
  [STANDING.LOCKED]: "Ahead",
  [STANDING.FUTURE]: "Ahead",
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
  [STANDING.FUTURE]: "locked",
};

/**
 * The key a standing is read under in the legend. Future folds into Ahead so
 * the legend never shows two keys with the same word.
 */
export function legendKeyOf(standing) {
  return standing === STANDING.FUTURE ? STANDING.LOCKED : standing;
}

/** The legend, in reading order: what to do, what else you can do, then the rest. */
export const LEGEND = [
  STANDING.NEXT,
  STANDING.OPEN,
  STANDING.OFFERED,
  STANDING.REVIEW,
  STANDING.FIX,
  STANDING.LIT,
  STANDING.LOCKED,
];

/**
 * The sequence the map walks and the list prints: `n` order. Both surfaces
 * call this rather than sorting themselves, so they cannot drift.
 */
export function inSequence(nodes) {
  return [...nodes].sort((a, b) => a.n - b.n);
}
