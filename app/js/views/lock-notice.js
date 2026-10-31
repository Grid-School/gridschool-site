/**
 * Clear copy when someone clicks a step that is not open yet.
 * Care without condescension: name what unlocks it, offer the next open step.
 */

import { el } from "../dom.js?v=c7fe5aa-202610310430";
import { btn } from "../ui.js?v=c7fe5aa-202610310430";
import { STATUS, blockedBy, nextUp } from "../graph/model.js?v=c7fe5aa-202610310430";

/** Short human reason + actions. Used on the map HUD and as a step-page gate. */
export function lockNotice({ graph, node, onGo, onDismiss }) {
  if (!node) return null;
  if (node.status === STATUS.OPEN || node.status === STATUS.LIT) return null;

  if (node.status === STATUS.FUTURE) {
    return el(
      "div.lock-note",
      { role: "status" },
      el("b.lock-note__title", {}, "This one opens later"),
      el(
        "p",
        {},
        node.coming ||
          "It is on the map so you can see the shape of the path. The work unlocks when the program reaches it."
      ),
      actions({ graph, onGo, onDismiss, goLabel: "Go to what is open now" })
    );
  }

  const blockers = blockedBy(graph, node.id);
  const names = blockers.map((item) => item.title);
  const list =
    names.length === 0
      ? "A prior step still needs to be finished."
        : names.length === 1
        ? `${names[0]} still needs to be finished.`
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} still need to be finished.`;

  // When the blocking step is itself waiting, the button goes further back: say so, or "Pick five targets
  // still needs to be finished" sits over a button to the resume with nothing joining them.
  const toward = blockers.find((item) => item.status === STATUS.OPEN) ?? null;
  const first = toward ? null : nextUp(graph);
  const chain = first && !blockers.some((item) => item.id === first.id) ? ` That starts with ${first.title}.` : "";

  return el(
    "div.lock-note",
    { role: "status" },
    el("b.lock-note__title", {}, "Not open yet"),
    el(
      "p",
      {},
      `“${node.title}” opens once the steps before it are done. ${list}${chain}`
    ),
    actions({ graph, onGo, onDismiss, goLabel: null, toward })
  );
}

/** One way on: the step that's blocking this one when it's open, else the map's next step. */
function actions({ graph, onGo, onDismiss, goLabel, toward = null }) {
  const next = toward ?? nextUp(graph);
  return el(
    "div.lock-note__acts",
    {},
    next &&
      btn({
        label: goLabel || `Go to ${next.title}`,
        variant: "solid",
        onclick: () => onGo?.(next.id),
      }),
    onDismiss && btn({ label: "Got it", variant: "quiet", onclick: onDismiss })
  );
}

/** True when a click should stay on the map and explain, not open the step. */
export function shouldInterceptLock(node) {
  return Boolean(node && (node.status === STATUS.LOCKED || node.status === STATUS.FUTURE));
}
