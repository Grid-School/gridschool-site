/**
 * A verdict arrives once. The board shows it as a standing (review, fix, lit)
 * and the rail badge counts it, but neither says "this just happened". This
 * module notices when a review moves to `returned` while the app is open and
 * says so in one line, with the outcome and the node it belongs to.
 *
 * `arrivals` is pure: given the reviews before and after a state change, the
 * ones that just came back. `watchReviewArrivals` wires it to the store.
 */

import { OUTCOME } from "./graph/model.js";
import { toast } from "./ui.js";

export function arrivals(before = [], after = []) {
  const wasReturned = new Set(before.filter((r) => r.state === "returned").map((r) => r.id));
  return after.filter((r) => r.state === "returned" && !wasReturned.has(r.id));
}

/** The one line the student reads. */
export function arrivalLine(review, byId) {
  const node = review.nodeId ? byId?.get(review.nodeId) : null;
  const where = node ? `${String(node.n).padStart(2, "0")} · ${node.title}` : review.title ?? "your work";
  return (review.outcome ?? OUTCOME.ACCEPTED) === OUTCOME.CHANGES
    ? `Changes came back on ${where}. The fix is on the node.`
    : `Accepted: ${where}. It is lit.`;
}

export function watchReviewArrivals(store) {
  let seen = store.state().student?.reviews ?? [];
  return store.subscribe(() => {
    const state = store.state();
    const now = state.student?.reviews ?? [];
    for (const review of arrivals(seen, now)) {
      const changes = (review.outcome ?? OUTCOME.ACCEPTED) === OUTCOME.CHANGES;
      toast(arrivalLine(review, state.graph?.byId), changes ? "warn" : "ok", { ms: 9000 });
    }
    seen = now;
  });
}
