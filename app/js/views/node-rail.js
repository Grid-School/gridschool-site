/**
 * A row of step nodes, one open at a time: the shape the campaign drawer and
 * Prepare share. Rings like the map's: white is where you are, green with a
 * check is done (and only ever means "you did it"), a node that just finished
 * pops once. Every node can be opened directly.
 */

import { el } from "../dom.js?v=8b71053-202610102102";

export function nodeRail({ nodes, done = [], here, fresh = [], onGo, label = "Steps" }) {
  return el(
    "ol.cnodes",
    { "aria-label": label },
    nodes.map((n, i) => {
      const isDone = done.includes(n.id);
      const isHere = here === n.id;
      return el(
        "li",
        { class: [isDone ? "is-done" : "", isHere ? "is-here" : "", fresh.includes(n.id) ? "is-fresh" : ""].join(" ").trim() || null },
        el(
          "button.cnodes__node",
          { type: "button", "aria-current": isHere ? "step" : null, "aria-label": `${n.label}${isDone ? ", done" : ""}`, onclick: () => onGo(n.id) },
          el("span.cnodes__ring", {}, isDone ? "✓" : String(i + 1)),
          el("span.cnodes__label", {}, n.label)
        )
      );
    })
  );
}

/** The heading every node opens with: what it's for and what finishes it. */
export function nodeIntro(title, what) {
  return el("header.cnode__head", {}, el("h2", {}, title), el("p.cnode__what", {}, what));
}
