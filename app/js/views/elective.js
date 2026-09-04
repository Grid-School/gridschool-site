/**
 * Electives. Depth is offered, never assigned: when a depth node's
 * prerequisites light it appears on the board as a door, and the student
 * decides whether to walk through. Picking it puts it on their plate (counted
 * in progress, eligible for Next); un-picking takes it off again. Nothing here
 * touches evidence.
 */

import { el } from "../dom.js";
import { btn, toast } from "../ui.js";
import { STATUS } from "../graph/model.js";

export function isElective(node) {
  return node.track === "depth" && node.kind !== "future";
}

/** The block for a depth node the student can act on. Null for spine, locked or lit. */
export function electiveBlock({ node, store }) {
  if (!isElective(node) || node.status !== STATUS.OPEN) return null;

  if (node.chosen) {
    return el(
      "aside.elective.elective--on",
      {},
      el("b.eyebrow", {}, "On your path"),
      el("p", {}, "You picked this. It counts toward your depth and can be your Next once the required steps are clear."),
      btn({
        label: "Take it off my path",
        variant: "quiet",
        onclick: () => {
          store.unchooseNode(node.id);
          toast(`${node.title} is back on offer.`);
        },
      })
    );
  }

  return el(
    "aside.elective.elective--offer",
    {},
    el("b.eyebrow", {}, "On offer"),
    el("p", {}, offerLine(node)),
    btn({
      label: "Add to my path",
      variant: "solid",
      onclick: () => {
        store.chooseNode(node.id);
        toast(`${node.title} added to your path.`);
      },
    })
  );
}

function offerLine(node) {
  const transfer = node.proves?.transfer;
  const base = "The steps before this one are lit, so it is yours to take or leave. Nothing required waits on it.";
  return transfer ? `${base} If you take it: ${transfer}` : base;
}
