/**
 * The first twenty minutes.
 *
 * A first-time board should not open on a dashboard. Nobody's first question is
 * "which of these five things should I click" — that question only exists
 * because we asked it. So the first visit opens on one screen that teaches the
 * three things the rest of the product assumes you know: the one law, where the
 * two doors go, and what your first URL is.
 *
 * It is not a tour and it does not follow you around. It appears once, it can be
 * skipped, and it never appears again once there is evidence on the board —
 * because at that point the student has already done the only thing that matters.
 */

import { el } from "../dom.js";
import { btn } from "../ui.js";
import { STATUS } from "../graph/model.js";
import { link } from "../../../config.js";

const KEY = (slug) => `gridschool.firstrun.v1.${slug}`;

export function firstRunDone(slug) {
  return localStorage.getItem(KEY(slug)) === "1";
}

function markDone(slug) {
  localStorage.setItem(KEY(slug), "1");
}

/** A board with evidence on it has outgrown this screen, flag or no flag. */
export function shouldOpenFirstRun(slug, state) {
  if (firstRunDone(slug)) return false;
  return !Object.values(state.student.evidence ?? {}).some((proof) => proof?.url);
}

export function renderFirstRun(ctx) {
  const { state, navigate } = ctx;
  const { graph, student, cohort, slug } = state;
  const first =
    graph.nodes.find((node) => node.status === STATUS.OPEN && node.kind !== "future") ??
    [...graph.nodes].sort((a, b) => a.n - b.n)[0];
  const discord = link("discord");

  const leave = (target, ...args) => {
    markDone(slug);
    navigate(target, ...args);
  };

  return el(
    "div.view.view--first",
    {},
    el(
      "header.view__head",
      {},
      el("b.eyebrow", {}, `${cohort.name} · welcome`),
      el("h1", {}, `Twenty minutes, ${firstName(student.name)}`),
      el(
        "p.muted",
        {},
        "Three things and you are running. You can leave this screen whenever you want; it will not come back once you have attached your first link."
      )
    ),
    el(
      "section.law",
      {},
      el("b.eyebrow", {}, "The only rule here"),
      el("p.law__line", {}, "A step is done when it has a link. Nothing else marks it done."),
      el(
        "p.law__sub",
        {},
        "Not effort, not hours, not a course marked complete. A link a stranger can open. That is the whole system, and it is why this board can never lie to you about where you are."
      )
    ),
    el(
      "ol.fsteps",
      {},
      step({
        n: 1,
        title: "See the whole path",
        body: "Three tracks, in parallel: LinkedIn, skills, and the portfolio. They meet in a capstone. A step is done when it has a link.",
        action: btn({ label: "Open the Grid", variant: "solid", onclick: () => leave("map") }),
      }),
      step({
        n: 2,
        title: "Watch the first two videos",
        body: "LinkedIn, then the one-page site. They are in the Library. Watch those two, then come back and do the work. Do not binge the rest.",
        action: btn({ label: "Open the Library", variant: "solid", onclick: () => leave("library") }),
      }),
      step({
        n: 3,
        title: first ? `Save your first link: ${first.title}` : "Save your first link",
        body: first?.evidence ?? "One link, live, that a stranger can open.",
        action: first
          ? btn({
              label: "Go to this step",
              variant: "solid",
              onclick: () => leave("map", first.id),
            })
          : null,
      })
    ),
    el(
      "section.doors",
      {},
      el("b.eyebrow", {}, "Where things live"),
      el(
        "div.doors__pair",
        {},
        door("Today", "The next action, and the Coach. Talk from here.", () => leave("today")),
        door("The Grid", "The whole path, and every link you have shipped.", () => leave("map"))
      ),
      el(
        "p.doors__note",
        {},
        "Tasks, the calendar, and the library sit below the line. You go get them by name when you need them."
      )
    ),
    el(
      "div.frun__acts",
      {},
      btn({ label: "Take me to my board", variant: "solid", onclick: () => leave("today") }),
      discord
        ? btn({ label: "Open the room in Discord", variant: "quiet", href: discord, target: "_blank" })
        : el("span.notwired", {}, "The Discord invite is not connected yet. It arrives on day one.")
    )
  );
}

function step({ n, title, body, action }) {
  return el(
    "li.fstep",
    {},
    el("b.fstep__n", {}, String(n)),
    el("div.fstep__body", {}, el("h2", {}, title), el("p", {}, body), action)
  );
}

function door(label, body, onclick) {
  return el(
    "button.door",
    { type: "button", onclick },
    el("b", {}, label),
    el("span", {}, body)
  );
}

function firstName(name) {
  return String(name ?? "").split(" ")[0] || "there";
}
