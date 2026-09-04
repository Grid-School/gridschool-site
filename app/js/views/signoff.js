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
      el("b.eyebrow", {}, "Changes came back"),
      el(
        "p",
        {},
        "The review asked for changes; the ask is now a task above. Make the change, update the link if it moved, and send it for review again. Nothing that opened while this was in review has closed."
      )
    );
  }
  if (node.awaitingSignoff) {
    const out = node.reviewState === "in-review";
    return el(
      "aside.signoff.signoff--waiting",
      {},
      el("b.eyebrow", {}, "Submitted · awaiting sign-off"),
      el(
        "p",
        {},
        out
          ? "Your link is in and the review is out. The steps that build on this are open; keep moving. This step lights when the verdict comes back."
          : "Your link is in. Send it for review below. The steps that build on this are already open; this one lights when the verdict comes back, not when the link is saved."
      )
    );
  }
  return el(
    "aside.signoff",
    {},
    el("b.eyebrow", {}, "Project assignment · final sign-off"),
    el(
      "p",
      {},
      "This step ends in a verdict. Save your link, then send it for review. Submitting opens what builds on this; the returned verdict is what lights it. Only the defense waits for verdicts."
    )
  );
}

/** Form copy, so the evidence form does not need to know about sign-off. */
export function submitLabel(node, lit) {
  if (lit) return "Update the link";
  if (node.needsFix) return "Resubmit for sign-off";
  return node.signoff ? "Submit for sign-off" : "Mark this step done";
}

export function linkHint(node) {
  return node.signoff
    ? "Paste the link. It is your submission; the accepting review marks this step done."
    : "Paste the link. That is what marks this step done.";
}
