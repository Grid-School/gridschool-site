/**
 * The title row: every job title they're aiming at, as chips. One record, many titles: the active chip is
 * the lens the whole tool looks through (its checklist, its questions, its headline and line order, its
 * saves). Each chip shows how close the resume is to that title, so the row is also the comparison.
 * "+ Add a title" takes a title or a pasted posting.
 */

import { el } from "../dom.js?v=6536b3c-202610261714";
import { btn } from "../ui.js?v=6536b3c-202610261714";

export function titleRow({ targets = [], busy = false, onSwitch, onAdd, onRemove }) {
  if (!targets.length) return null;
  let adding = false;
  const row = el("div.tt", { role: "group", "aria-label": "Titles you're aiming at" });

  function draw() {
    const chips = targets.map((t) =>
      el(`button.tt__chip${t.active ? ".is-active" : ""}`, { type: "button", disabled: busy || null, "aria-pressed": t.active ? "true" : "false",
        onclick: () => (t.active ? null : onSwitch?.(t)) },
        el("span.tt__name", {}, t.title || "Untitled"),
        t.fit?.total ? el("span.tt__fit", { title: "What this job is screened for, shown on your resume" }, `${t.fit.shown}/${t.fit.total}`) : null));
    const active = targets.find((t) => t.active);
    const form = adding
      ? el("form.tt__add", { onsubmit: (e) => { e.preventDefault(); const text = box.value.trim(); if (text) { adding = false; onAdd?.(text); } } },
          el("textarea.rz__text.tt__box", { rows: 2, placeholder: "The title, or paste the whole job posting", "aria-label": "Title or posting" }),
          el("div.rz__row", {}, btn({ label: "Add this title", variant: "solid", type: "submit", disabled: busy }),
            btn({ label: "Cancel", variant: "quiet", onclick: () => { adding = false; draw(); } })))
      : null;
    const box = form?.querySelector("textarea");
    row.replaceChildren(...[
      el("div.tt__chips", {}, chips,
        !adding && onAdd && targets.length < 5 ? el("button.tt__chip.tt__chip--add", { type: "button", disabled: busy || null, onclick: () => { adding = true; draw(); } }, "+ Add a title") : null,
        !adding && onRemove && targets.length > 1 && active ? el("button.tt__remove", { type: "button", disabled: busy || null,
          onclick: () => confirm(`Remove "${active.title}"? Your jobs and lines stay; only this title's checklist and questions go.`) && onRemove(active) },
          `Remove ${active.title}`) : null),
      form].filter(Boolean));
    if (box) setTimeout(() => box.focus(), 0);
  }

  draw();
  return row;
}
