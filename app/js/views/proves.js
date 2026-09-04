/**
 * What this step proves. Every step carries the same six-field contract:
 * the capability claimed, the challenge that would show it, the evidence
 * that records it, what would falsify the claim, the passing threshold, and
 * where the same capability must show up again later.
 *
 * The block exists so the curriculum is held to the epistemology it teaches:
 * a lesson with no falsification is a lecture, not a proof.
 */

import { el } from "../dom.js";

export const PROVES_FIELDS = [
  ["claim", "Claim"],
  ["challenge", "Challenge"],
  ["evidence", "Evidence"],
  ["falsification", "Falsification"],
  ["threshold", "Threshold"],
  ["transfer", "Transfer"],
];

export function hasProves(node) {
  return Boolean(node?.proves && PROVES_FIELDS.some(([key]) => node.proves[key]));
}

export function provesBlock(node) {
  if (!hasProves(node)) return null;
  return el(
    "section.step__proves",
    {},
    el("b.eyebrow", {}, "What this step proves"),
    el(
      "p.room__hint",
      {},
      "The claim this step makes about you, and what would show the claim is false. Read the falsification line before you start."
    ),
    el(
      "div.proves",
      {},
      PROVES_FIELDS.filter(([key]) => node.proves[key]).map(([key, label]) =>
        el(
          "div.proves__row",
          { class: key === "falsification" ? "proves__row--falsify" : "" },
          el("b", {}, label),
          el("p", {}, node.proves[key])
        )
      )
    )
  );
}
