/**
 * "What this job is screened for": the target's needs (server/resume_needs.py) and whether the resume
 * shows each one. It's why the questions are the questions: each one is about a need that's missing or
 * weak. A need that isn't for them can be switched off; it stops being asked about.
 */

import { el } from "../dom.js?v=6536b3c-202610261714";
import { btn } from "../ui.js?v=6536b3c-202610261714";

const STATUS = {
  shown: { text: "On your resume", cls: "is-shown" },
  weak: { text: "Mentioned, no result yet", cls: "is-weak" },
  missing: { text: "Not on your resume yet", cls: "is-missing" },
};

/** The need a question is about, if it's one of them (resume_needs.findings ids them q-need-<need id>). */
export const needFor = (q, needs = []) => (q?.id?.startsWith("q-need-") ? needs.find((n) => q.id === `q-need-${n.id}`) : null) || null;

/** Open shows the whole list; closed, one line (once they're answering, the question matters more). */
export function needsPanel({ title, needs = [], busy = false, onToggle, onRefresh, open = true, current = null }) {
  if (!title) return null;
  if (!needs.length) {
    return el("section.nd", {},
      el("p.nd__head.nd__head--plain", {}, el("b", {}, `What ${title} jobs are screened for`)),
      el("p.nd__empty", {}, "We'll list the 6 to 8 things a screen for this job checks first, so every question is about one of them."),
      onRefresh ? btn({ label: "Show me", variant: "ghost", disabled: busy, onclick: onRefresh }) : null);
  }
  const on = needs.filter((n) => n.state !== "off");
  const shown = on.filter((n) => n.status === "shown").length;
  return el("details.nd", { "aria-label": "What this job is screened for", open: open || null },
    el("summary.nd__head", {}, el("b", {}, `What ${title} jobs are screened for`),
      el("span.nd__score", {}, `${shown} of ${on.length} on your resume`),
      el("span.nd__dots", { "aria-hidden": "true" }, on.map((n) => el(`i.${(STATUS[n.status] || STATUS.missing).cls}`)))),
    el("ul.nd__list", {}, needs.map((n) => {
      const off = n.state === "off";
      const s = STATUS[n.status] || STATUS.missing;
      return el(`li.nd__item.${off ? "is-off" : s.cls}${current?.id === n.id ? ".is-current" : ""}`, { title: n.why || "" },
        el("span.nd__dot", { "aria-hidden": "true" }, !off && n.status === "shown" ? "✓" : ""),
        el("span.nd__label", {}, n.label, el("small", {}, off ? "Not for you: we won't ask about it" : s.text)),
        onToggle ? el("button.nd__toggle", { type: "button", disabled: busy, onclick: () => onToggle(n, off ? "on" : "off"),
          "aria-label": off ? `Ask about ${n.label} again` : `${n.label} isn't for me` }, off ? "Undo" : "Not for me") : null);
    })));
}
