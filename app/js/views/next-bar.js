/**
 * The Next bar: the one next move (engine.nextMove), under every screen, the same words everywhere.
 *
 * It lives in the shell, below the page and in the layout flow, so it never covers an input. When you're
 * already where the move is done, it says so instead of offering a button. Nothing else in the app
 * computes "what now": the map marks where you are on the line, Today lists this move first and the
 * rest after it, and the coach opens with it.
 */

import { el, mount } from "../dom.js?v=3a2df55-202611042206";
import { btn } from "../ui.js?v=3a2df55-202611042206";
import { moveRoute, movesAfterNext, isHere } from "../engine.js?v=3a2df55-202611042206";
import { liveRoles, livePacks, onNextChange, currentMove } from "../next-live.js?v=3a2df55-202611042206";
import { isoDate } from "../time.js?v=3a2df55-202611042206";

export { currentMove };

/** The button says where it goes. */
const GO = {
  home: "Open home",
  step: "Go to the step",
  review: "Read the notes",
  targets: "Open the campaign",
  today: "Open Today",
  follow: "Open Today",
  insider: "Open Today",
  people: "Open People",
  applications: "Open Applications",
  profile: "Open Your LinkedIn",
  rest: "Open Today",
};

export function createNextBar({ getState, getRoute, navigate, onReviewRead }) {
  const root = el("aside.gonext", { "aria-label": "Your next move", "data-private": "" });
  let shown = "";

  function render() {
    const state = getState();
    if (!state?.graph) {
      root.hidden = true;
      return;
    }
    const move = currentMove(state);
    const target = moveRoute(move);
    // On the full map (#/map/all) the home's move keeps its button: the map is a door away from it.
    const here = isHere(getRoute(), target) && !(move.kind === "home" && (getRoute()?.args?.[0] === "all"));
    // "+N more today" only after they've done something today: the first look is one move, not a list.
    const today = isoDate(new Date());
    const s = state.student?.search ?? {};
    const doneToday = (s.apps ?? []).some((a) => a.date === today) || String(s.profileAt ?? "").startsWith(today);
    const more = doneToday ? movesAfterNext({ student: state.student, roles: liveRoles(), packs: livePacks() }) : 0;
    const key = JSON.stringify([move.title, move.why, target, here, more]);
    root.hidden = false;
    root.classList.toggle("is-here", here);
    root.classList.toggle("is-home", move.kind === "home");
    if (key === shown) return;
    shown = key;
    mount(
      root,
      el("span.gonext__dot", { "aria-hidden": "true" }),
      el(
        "div.gonext__text",
        {},
        el("span.gonext__label", {}, move.kind === "home" ? "Now" : here ? "Next · you're here" : "Next"),
        el("b.gonext__title", {}, move.title),
        move.why ? el("span.gonext__why", {}, move.why) : null
      ),
      el(
        "div.gonext__acts",
        {},
        more && !isHere(getRoute(), ["do", "today"]) ? btn({ label: `+${more} more today`, variant: "quiet", onclick: () => navigate("do", "today") }) : null,
        move.kind === "review" ? btn({ label: "Got it", variant: here ? "solid" : "ghost", onclick: () => onReviewRead?.(move.review.id) }) : null,
        here ? null : btn({ label: move.kind === "home" ? (move.home?.action?.label || "Open home") : GO[move.kind] ?? (move.targetId ? GO.targets : "Open"), variant: "solid", onclick: () => navigate(...target) })
      )
    );
  }

  onNextChange(render);
  return { root, render };
}
