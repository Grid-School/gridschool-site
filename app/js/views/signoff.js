/**
 * Project assignments end in a verdict, not a link. A `signoff` node lights
 * when an accepting review comes back on the link that is on it; the URL is
 * the submission, the verdict is the light. Submitting opens what depends on
 * the node (a PR under review does not stop the next ticket); only a gate,
 * the defense, waits for the verdict itself. This module owns the words for
 * those states; the rule lives in graph/model.js (isLit, satisfies).
 */

import { el } from "../dom.js";

export function signoffNotice(node) {
  if (!node.signoff) return null;
  if (node.needsFix) {
    return el(
      "aside.signoff.signoff--fix",
      {},
      el("b.eyebrow", {}, "Changes requested"),
      el(
        "p",
        {},
        "The review asked for changes. That ask is now a task above. Make the change, update the link if it moved, and send it for review again. Other open steps stay open."
      )
    );
  }
  if (node.awaitingSignoff) {
    const out = node.reviewState === "in-review";
    return el(
      "aside.signoff.signoff--waiting",
      {},
      el("b.eyebrow", {}, out ? "In review" : "Submitted"),
      el(
        "p",
        {},
        out
          ? "Your link is in review. You can keep working on the next open step. This step is accepted when the review comes back, not while it is waiting."
          : "Your link is submitted. Send it for review below. The next steps are already open. This one is accepted only when the review comes back."
      )
    );
  }
  if (node.status === "lit") {
    return el(
      "aside.signoff.signoff--accepted",
      {},
      el("b.eyebrow", {}, "Accepted"),
      el("p", {}, "The review accepted this link. You can still replace it if the work moved.")
    );
  }
  return el(
    "aside.signoff",
    {},
    el("b.eyebrow", {}, "Ends in a review"),
    el(
      "p",
      {},
      "Save the link, then send it for review. Submitting opens the next work. This step is accepted only when the review comes back."
    )
  );
}

/** Form copy, so the evidence form does not need to know about sign-off. */
export function submitLabel(node, lit) {
  if (lit) return "Update the link";
  if (node.needsFix) return "Resubmit for sign-off";
  return node.signoff ? "Submit for sign-off" : "Save the link";
}

export function linkHint(node) {
  return node.signoff ? "Your submission. The accepting review lights the step." : "This is what lights the step.";
}
