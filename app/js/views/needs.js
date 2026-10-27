/**
 * "What this job is screened for": the target's needs (server/resume_needs.py) and whether the resume
 * shows each one. It's why the questions are the questions: each one is about a need that's missing or
 * weak. A need that isn't for them can be switched off; it stops being asked about. A need they haven't
 * done yet carries a plan to earn it, with the line it will earn written in advance, and a button that
 * puts the plan on their map.
 */

import { el } from "../dom.js?v=c78f81e-202610272041";
import { btn } from "../ui.js?v=c78f81e-202610272041";

const STATUS = {
  shown: { text: "On your resume", cls: "is-shown" },
  weak: { text: "Mentioned, no result yet", cls: "is-weak" },
  missing: { text: "Not on your resume yet", cls: "is-missing" },
  later: { text: "Not yet. Here's how to earn it", cls: "is-later" },
};

/** The need a question is about, if it's one of them (resume_needs.findings ids them q-need-<need id>). */
export const needFor = (q, needs = []) => (q?.id?.startsWith("q-need-") ? needs.find((n) => q.id === `q-need-${n.id}`) : null) || null;

/** The plan to earn a need: what to do, the proof, the weeks, and the line it earns. */
export function planBlock(n, { busy = false, onMap } = {}) {
  const p = n?.plan;
  if (!p) return null;
  return el("div.nd__plan", {},
    el("p.nd__do", {}, el("b", {}, "To earn it: "), p.do, p.weeks ? el("span.nd__weeks", {}, ` · about ${p.weeks} ${p.weeks === 1 ? "week" : "weeks"}`) : null),
    p.proof ? el("p.nd__proof", {}, el("b", {}, "You'll have: "), p.proof) : null,
    el("p.nd__line", {}, el("b", {}, "When it's done, this goes on your resume: "), el("q", {}, p.line)),
    onMap ? (p.mapped
      ? el("p.nd__mapped", {}, "✓ On its way to your map")
      : btn({ label: "Put it on my map", variant: "solid", disabled: busy, onclick: () => onMap(n) })) : null);
}

/** Open shows the whole list; closed, one line (once they're answering, the question matters more). */
export function needsPanel({ title, needs = [], busy = false, onToggle, onRefresh, onMap, open = true, current = null }) {
  if (!title) return null;
  if (!needs.length) {
    return el("section.nd", {},
      el("p.nd__head.nd__head--plain", {}, el("b", {}, `What ${title} jobs are screened for`)),
      el("p.nd__empty", {}, "We'll list the 6 to 8 things a screen for this job checks first, so every question is about one of them."),
      onRefresh ? btn({ label: "Show me", variant: "ghost", disabled: busy, onclick: onRefresh }) : null);
  }
  const on = needs.filter((n) => n.state !== "off");
  const shown = on.filter((n) => n.status === "shown").length;
  const toEarn = needs.filter((n) => n.state === "later");
  return el("details.nd", { "aria-label": "What this job is screened for", open: open || null },
    el("summary.nd__head", {}, el("b", {}, `What ${title} jobs are screened for`),
      el("span.nd__score", {}, `${shown} of ${on.length} on your resume${toEarn.length ? ` · ${toEarn.length} to earn` : ""}`),
      el("span.nd__dots", { "aria-hidden": "true" }, on.map((n) => el(`i.${(STATUS[n.state === "later" ? "later" : n.status] || STATUS.missing).cls}`)))),
    el("ul.nd__list", {}, needs.map((n) => {
      const off = n.state === "off";
      const later = n.state === "later";
      const s = later ? STATUS.later : STATUS[n.status] || STATUS.missing;
      return el(`li.nd__item.${off ? "is-off" : s.cls}${current?.id === n.id ? ".is-current" : ""}`, { title: n.why || "" },
        el("span.nd__dot", { "aria-hidden": "true" }, !off && n.status === "shown" ? "✓" : later ? "→" : ""),
        el("span.nd__label", {}, n.label, el("small", {}, off ? "Not for you: we won't ask about it" : s.text), later ? planBlock(n, { busy, onMap }) : null),
        onToggle ? el("button.nd__toggle", { type: "button", disabled: busy, onclick: () => onToggle(n, off || later ? "on" : "off"),
          "aria-label": off || later ? `Ask about ${n.label} again` : `${n.label} isn't for me` }, off ? "Undo" : later ? "I've done it after all" : "Not for me") : null);
    })));
}
