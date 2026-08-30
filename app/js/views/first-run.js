/**
 * First visit. What is the rule, and where do I start.
 * One rule, one primary action. The rail already is the doors.
 */

import { el } from "../dom.js";
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
  const welcomeId = graph.byId?.has("or.start") ? "or.start" : first?.id;
  const discord = link("discord");

  const leave = (target, ...args) => {
    markDone(slug);
    navigate(target, ...args);
  };

  const goWelcome = () => {
    if (welcomeId) leave("map", welcomeId);
    else leave("map");
  };

  return el(
    "div.view.view--first",
    {},
    el(
      "header.view__head",
      {},
      el("b.eyebrow", {}, `${cohort.name} · welcome`),
      el("h1", {}, `Start here, ${firstName(student.name)}`),
      el(
        "p.muted",
        {},
        "One rule, then your first step. This screen will not come back once you attach a link."
      )
    ),
    el(
      "section.law",
      {},
      el("b.eyebrow", {}, "The only rule here"),
      el("p.law__line", {}, "A step is done when it has a link. Nothing else marks it done.")
    ),
    el(
      "div.frun__acts",
      {},
      btn({
        label: welcomeId ? "Open Welcome" : "Open the map",
        variant: "solid",
        onclick: goWelcome,
      }),
      discord
        ? btn({ label: "Open Discord", variant: "quiet", href: discord, target: "_blank" })
        : el("span.notwired", {}, "The Discord invite is not connected yet. It arrives on day one.")
    )
  );
}

function firstName(name) {
  return String(name ?? "").split(" ")[0] || "there";
}
