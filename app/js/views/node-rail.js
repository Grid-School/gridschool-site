/**
 * A row of step nodes, one open at a time: the shape every builder shares (steps.js has the rules).
 * Done is a solid green circle with a check; here is a white ring, never a fill; the line between two
 * steps is green only when both are done. A node that just finished pops once. Every node opens directly.
 */

import { el } from "../dom.js?v=a8ec4dc-202610271940";
import { stepStates } from "../steps.js?v=a8ec4dc-202610271940";

export function nodeRail({ nodes, done = [], here, fresh = [], onGo, label = "Steps" }) {
  return el(
    "ol.cnodes",
    { "aria-label": label },
    stepStates(nodes, { done, here }).map((s) =>
      el(
        "li",
        { class: [s.done ? "is-done" : "", s.here ? "is-here" : "", s.linked ? "is-linked" : "", fresh.includes(s.id) ? "is-fresh" : ""].filter(Boolean).join(" ") || null },
        el(
          "button.cnodes__node",
          { type: "button", "aria-current": s.here ? "step" : null, "aria-label": `${s.label}${s.done ? ", done" : ""}`, onclick: () => onGo(s.id) },
          el("span.cnodes__ring", { "aria-hidden": "true" }, s.done ? "✓" : String(s.n)),
          el("span.cnodes__label", {}, s.label)
        )
      )
    )
  );
}

/** The heading every node opens with: what it's for and what finishes it. */
export function nodeIntro(title, what) {
  return el("header.cnode__head", {}, el("h2", {}, title), el("p.cnode__what", {}, what));
}
