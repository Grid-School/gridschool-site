/**
 * The first twenty minutes.
 *
 * A first-time board should not open on a dashboard. Nobody's first question is
 * "which of these five things should I click"that question only exists
 * because we asked it. So the first visit opens on one screen that teaches the
 * three things the rest of the product assumes you know: the one rule, where the
 * two doors go, and what your first URL is.
 *
 * It is not a tour and it does not follow you around. It appears once, it can be
 * skipped, and it never appears again once there is evidence on the board - 
 * because at that point the student has already done the only thing that matters.
 */

import { el, mount } from "../dom.js";
import { btn } from "../ui.js";
import { nextUp } from "../graph/model.js";
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
  const first = nextUp(graph) ?? [...graph.nodes].sort((a, b) => a.n - b.n)[0];
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
        "Three things and you are running. Read the rule, see the path, open the first step. This screen will not come back once you attach your first link."
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
        "A link a stranger can open is what marks a step done. That is the whole system, and it is why this board always shows you exactly where you are."
      )
    ),
    el(
      "section.gloss",
      {},
      el("b.eyebrow", {}, "Where work lives"),
      el(
        "ul.gloss__list",
        {},
        el("li", {}, el("b", {}, "World"), ": the live game at play.gridschool.org. We build it together. Friends can walk in and see what you shipped."),
        el("li", {}, el("b", {}, "GridSeak"), ": the graph engine. Take a slice that matches what you want to own."),
        el("li", {}, el("b", {}, "The ticket board"), ": your user stories, on Jira. What to work on next lives there. Week 1 teaches it."),
        el("li", {}, el("b", {}, "The map"), ": lessons, films, and milestones. A step lights when it has a link.")
      )
    ),
    el(
      "ol.fsteps",
      {},
      step({
        n: 1,
        title: "See the whole path",
        body: "The required path: learn the weekly loop, get the world running, read it, ship stories from the ticket board, prove them, defend your strongest, then one public trail. GridSeak is extra ownership when your goals want it.",
        action: btn({ label: "Open the map", variant: "solid", onclick: () => leave("map") }),
      }),
      step({
        n: 2,
        title: "Open the first step and do the work",
        body: "Open Welcome. This chapter shows you the eight weeks. Write a short public note and paste the link.",
        action: first
          ? btn({
              label: `Go to ${first.title}`,
              variant: "solid",
              onclick: () => leave("map", first.id),
            })
          : btn({ label: "Open the map", variant: "solid", onclick: () => leave("map") }),
      }),
      step({
        n: 3,
        title: first ? `Save your first link on: ${first.title}` : "Save your first link",
        body: "On that step: write the board rule in your words, name two steps you can work this week, put both in one gist or doc, paste the URL under Turn this in.",
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
        door("The map", "The whole path, and every link you have shipped.", () => leave("map"))
      ),
      el(
        "p.doors__note",
        {},
        "Tasks, the calendar, and the library sit below the line. You go get them by name when you need them, and long graph readings open from the graph steps themselves."
      )
    ),
    el(
      "div.frun__acts",
      {},
      btn({ label: "Take me to my board", variant: "solid", onclick: () => leave("today") }),
      discord
        ? btn({ label: "Open Discord", variant: "quiet", href: discord, target: "_blank" })
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
