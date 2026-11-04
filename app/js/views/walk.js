/**
 * The walk: the first week as one track, one screen at a time (ops/intake-and-resume-system-2026-11.md).
 *
 * The frame owns what the student never has to hold in their head: where they are (step k of n), what this
 * screen is for (one line), the one way forward (Continue), and the way back. Each screen's body is an existing
 * tool rendered inside the frame: the interview, the resume builder, the LinkedIn step, targets, sends. No body
 * opens another page; anything with no choice runs by itself; a screen is done when its map step is lit.
 *
 * The map stays the overview: every step still exists there, and on a walk seat any door to one of these steps
 * (the Next bar, an email link, a node on the floor) opens it here (boot.js).
 */

import { el, mount } from "../dom.js?v=3a2df55-202611042206";
import { stepNumber } from "../graph/model.js?v=3a2df55-202611042206";
import { btn } from "../ui.js?v=3a2df55-202611042206";
import { renderInterview } from "./interview.js?v=3a2df55-202611042206";
import { renderResume } from "./resume.js?v=3a2df55-202611042206";
import { renderLinkedinStep } from "./step-checklist.js?v=3a2df55-202611042206";
import { renderTargetsPick } from "./targets-pick.js?v=3a2df55-202611042206";
import { renderSendsWeek } from "./sends-week.js?v=3a2df55-202611042206";
import { activeTargets, peopleOnTarget, firstWeekDone } from "../search.js?v=3a2df55-202611042206";

const SCREENS = [
  {
    id: "interview",
    node: "b.resume",
    title: "Your work",
    why: "",
    next: "Continue to your resume",
  },
  {
    id: "resume",
    node: "b.resume",
    title: "Your resume",
    why: "",
    next: "Continue to your LinkedIn",
  },
  {
    id: "linkedin",
    node: "b.linkedin",
    title: "Your LinkedIn",
    why: "",
    next: "Continue to your companies",
  },
  {
    id: "targets",
    node: "s.targets",
    title: "Your companies",
    why: "",
    next: "Continue to your first notes",
  },
  {
    id: "send",
    node: "s.send",
    title: "Your first notes",
    why: "",
    next: "Continue to Home",
  },
];

const lit = (state, nodeId) => state.graph?.byId?.get(nodeId)?.status === "lit";

const byNode = new Map();
for (const screen of SCREENS) if (!byNode.has(screen.node)) byNode.set(screen.node, screen.id);

/** The walk screen a map step opens in, or null when the step isn't part of the walk. The resume step opens on
 * the interview until the resume exists, then on the resume itself. */
export function walkScreenFor(nodeId, state = null) {
  // The map's first dot ("Your work") opens the talk, or the resume once it's built.
  const screen = nodeId === "s.start" ? "interview" : byNode.get(nodeId) ?? null;
  if (screen === "interview" && state && lit(state, "b.resume")) return "resume";
  return screen;
}

/** Every screen of the walk is done for this seat. */
export function walkDone(state) {
  return SCREENS.every((s) => lit(state, s.node));
}

export function renderWalk(ctx, screenArg = "", options = {}) {
  const root = el("div.view.view--walk", { class: options.lens ? "is-lens" : null });
  let current = ctx;
  let asked = screenArg || "";
  const bodies = new Map(); // screen id → the tool instance, kept across repaints

  const nodeOf = (screen) => current.state.graph?.byId?.get(screen.node) ?? null;
  const interviewState = () => bodies.get("interview")?.state?.() ?? { goodEnough: false, done: false };
  const resumeState = () => bodies.get("resume")?.state?.() ?? { saved: false, kept: false };

  function isDone(screen) {
    if (screen.id === "interview") return interviewState().goodEnough || lit(current.state, "b.resume") || resumeState().saved;
    // One target is enough to go on; the step's own task is ticked when the student continues.
    if (screen.id === "targets") return lit(current.state, screen.node) || activeTargets(current.state.student).length > 0;
    // A saved resume is a finished step, whatever the folded profile tasks say: the interview replaced them.
    if (screen.id === "resume") return lit(current.state, screen.node) || resumeState().saved;
    // The first week ends on something the student did: the first note sent.
    if (screen.id === "send") return lit(current.state, screen.node) || activeTargets(current.state.student).some((t) => peopleOnTarget(t).some((c) => c.touches?.note));
    return lit(current.state, screen.node);
  }

  /** Leaving a screen by Continue settles what the screen's map step needs ticked. */
  function settle(screen) {
    if (lit(current.state, screen.node)) return;
    const tasks = nodeOf(screen)?.tasks ?? [];
    const tick = (ids) => ids.forEach((id) => { if (current.state.student?.tasks?.[id]?.state !== "done") current.store.setTaskState(id, "done"); });
    if (screen.id === "targets" && tasks[0]) tick([tasks[0].id]);
    if (screen.id === "send" && isDone(screen)) tick(tasks.map((t) => t.id));
    // Leaving a saved resume ticks every task folded into its step, so the map and the walk agree.
    if (screen.id === "resume" && resumeState().saved) tick(tasks.map((t) => t.id));
  }

  /** Where the walk opens with no screen named: the first screen not done, else the last. */
  function firstOpen() {
    return SCREENS.find((s) => !isDone(s))?.id ?? SCREENS[SCREENS.length - 1].id;
  }

  function here() {
    const wanted = SCREENS.find((s) => s.id === asked);
    return wanted ?? SCREENS.find((s) => s.id === firstOpen());
  }

  function body(screen) {
    const node = nodeOf(screen);
    let inst = bodies.get(screen.id);
    if (!inst) {
      const make = {
        interview: () => renderInterview(current, { embedded: true, node, onBuild: () => go("resume"), onState: () => refreshFrame(), next: nextOf(screen) }),
        resume: () => renderResume(current, { embedded: true, node, interview: true, onState: () => refreshFrame(), next: nextOf(screen) }),
        linkedin: () => renderLinkedinStep(current, { node, next: nextOf(screen) }),
        // Targets picked for the student from the roles radar, with the reason for each (targets-pick.js).
        targets: () => renderTargetsPick(current, { node, next: nextOf(screen) }),
        // Your first notes: one move on one company; the first note sent ends the first week (sends-week.js).
        send: () => renderSendsWeek(current, { node, walk: true, onSent: () => refreshFrame(), next: nextOf(screen) }),
      }[screen.id];
      inst = make();
      bodies.set(screen.id, inst);
    } else {
      inst.update(current, { node, interview: screen.id === "resume" ? true : undefined });
    }
    return inst.node;
  }

  /** Repaint the rail and the foot around a body that changed on its own (a save landed, a draft finished). */
  function refreshFrame() {
    const at = here();
    if (!root.isConnected) return;
    // A saved resume finishes its step on the map too, right away, so the rail reads the same from any screen.
    const resumeScreen = SCREENS.find((s) => s.id === "resume");
    if (resumeState().saved && !lit(current.state, resumeScreen.node)) settle(resumeScreen);
    root.querySelector(".walk__nav")?.replaceWith(nav(at));
    root.classList.toggle("is-after-week", afterWeek());
    root.querySelector(".walk__foot")?.replaceWith(foot(at));
  }

  function go(id) {
    asked = id;
    location.hash = id === "map" ? "#/map" : `#/walk/${id}`;
  }

  function nav(at) {
    let seenOpen = false;
    return el("nav.walk__nav", { "aria-label": "The steps" },
      el("b.eyebrow", {}, "Your first week"),
      el("ol.walk__steps", {}, SCREENS.map((s, i) => {
        const done = isDone(s);
        const ahead = !done && seenOpen && s.id !== at.id;
        if (!done && s.id !== at.id) seenOpen = true;
        if (!done && s.id === at.id) seenOpen = true;
        return el("li", {}, el("button.walk__step", {
          type: "button",
          class: [s.id === at.id ? "is-here" : null, done ? "is-done" : null, ahead ? "is-ahead" : null].filter(Boolean).join(" ") || null,
          disabled: ahead ? true : null,
          "aria-current": s.id === at.id ? "step" : null,
          onclick: () => go(s.id),
        }, el("span.walk__mark", { "aria-hidden": "true" }, done ? "✓" : String(i + 1)), el("span", {}, s.title)));
      })));
  }

  /** The way on, handed to each body: the solid is always the last thing in the reading column, after the object,
   * and it opens the next screen. The foot never holds a solid. */
  function nextOf(at) {
    const i = SCREENS.indexOf(at);
    const last = i === SCREENS.length - 1;
    return { label: at.next, go: () => { settle(at); go(last ? "map" : SCREENS[i + 1].id); }, settle: () => settle(at) };
  }

  const afterWeek = () => firstWeekDone(current.state.student);

  function foot(at) {
    const i = SCREENS.indexOf(at);
    if (afterWeek() || options.lens) return el("footer.walk__foot", {}, btn({ label: "Back to your map", variant: "quiet", onclick: () => (options.onClose ? options.onClose() : go("map")) }));
    return el("footer.walk__foot", {},
      i > 0 ? btn({ label: `Back to ${SCREENS[i - 1].title.replace(/^Your/, "your")}`, variant: "quiet", onclick: () => go(SCREENS[i - 1].id) }) : null,
      btn({ label: isDone(at) ? "Done for now" : "Finish later", variant: "quiet", onclick: () => go("map") }));
  }

  function render() {
    const at = here();
    // The frame holds the screen it showed: finishing a screen never moves the student; Continue does.
    asked = at.id;
    const i = SCREENS.indexOf(at);
    root.classList.toggle("is-after-week", afterWeek());
    // One title per screen, and it's the body's move. The rail shows where you are; on a phone, where the rail
    // folds away, the step line stands in for it.
    const bodyEl = el("div.walk__body", {}, body(at));
    const main = el("section.walk__main", {},
      el("header.walk__head.is-compact", {},
        el("b.eyebrow.walk__step-line", {}, options.lens ? `${stepNumber(nodeOf(at)) ? `${stepNumber(nodeOf(at))} · ` : ""}${at.title}` : afterWeek() ? at.title : `Step ${i + 1} of ${SCREENS.length} · ${at.title}`)),
      bodyEl);
    mount(root, options.lens ? null : nav(at), main);
    main.append(foot(at));
    document.title = `${at.title} · ${current.state.student.name} · GridSchool`;
  }

  render();
  return {
    node: root,
    /** The map node a screen stands on, for the lens camera. */
    nodeFor: (screenId) => {
      const s = SCREENS.find((x) => x.id === (screenId || here().id)) || here();
      if (s.id === "targets") return current.state.graph?.byId?.has("t.next") ? "t.next" : s.node;
      if (s.id === "interview") return lit(current.state, "b.resume") ? "b.resume" : "s.start";
      return s.node;
    },
    screenId: () => here().id,
    sendFocus: () => bodies.get("send")?.focus?.() || null,
    update(next, nextScreen) {
      current = next;
      if (typeof nextScreen === "string" && nextScreen) asked = nextScreen;
      // The tools keep their own state (an answer being typed, a draft mid-way); only the frame repaints around them.
      const at = here();
      const frameOnly = root.querySelector(".walk__body")?.firstChild === bodies.get(at.id)?.node;
      if (frameOnly) {
        body(at);
        root.querySelector(".walk__nav")?.replaceWith(nav(at));
        root.querySelector(".walk__foot")?.replaceWith(foot(at));
        return;
      }
      render();
    },
  };
}
