/**
 * The title row: every job title they're aiming at, as chips. One record, many titles: the active chip is
 * the lens the whole tool looks through (its checklist, its questions, its headline and line order, its
 * saves). Each chip shows how close the resume is to that title, so the row is also the comparison.
 * "+ Add a title" takes a title or a pasted posting.
 */

import { el } from "../dom.js?v=a3b9988-202610262033";
import { btn } from "../ui.js?v=a3b9988-202610262033";

export function titleRow({ targets = [], busy = false, onSwitch, onAdd, onRemove }) {
  if (!targets.length) return null;
  let adding = false;
  const row = el("div.tt", { role: "group", "aria-label": "Titles you're aiming at" });

  function draw() {
    const active = targets.find((t) => t.active);
    const chips = targets.map((t) =>
      el(`span.tt__item${t.active ? ".is-active" : ""}`, {},
        el("button.tt__chip", { type: "button", disabled: busy || null, "aria-pressed": t.active ? "true" : "false",
          onclick: () => (t.active ? null : onSwitch?.(t)) },
          el("span.tt__name", {}, t.title || "Untitled"),
          t.fit?.total ? el("span.tt__fit", { title: "What this job is screened for, shown on your resume" }, `${t.fit.shown}/${t.fit.total}`) : null),
        // Remove lives on the active chip only, so the row never grows a loose line of links.
        t.active && onRemove && targets.length > 1
          ? el("button.tt__x", { type: "button", disabled: busy || null, "aria-label": `Remove ${t.title}`, title: `Remove ${t.title}`,
              onclick: () => confirm(`Remove "${t.title}"? Your jobs and lines stay; only this title's checklist and questions go.`) && onRemove(t) }, "×")
          : null));
    const form = adding
      ? el("form.tt__add", { onsubmit: (e) => { e.preventDefault(); const text = box.value.trim(); if (text) { adding = false; onAdd?.(text); } } },
          el("textarea.rz__text.tt__box", { rows: 2, placeholder: "The title, or paste the whole job posting", "aria-label": "Title or posting" }),
          el("div.rz__row", {}, btn({ label: "Add this title", variant: "solid", type: "submit", disabled: busy }),
            btn({ label: "Cancel", variant: "quiet", onclick: () => { adding = false; draw(); } })))
      : null;
    const box = form?.querySelector("textarea");
    row.replaceChildren(...[
      el("div.tt__chips", {}, chips,
        !adding && onAdd && targets.length < 5 ? el("button.tt__chip.tt__chip--add", { type: "button", disabled: busy || null, onclick: () => { adding = true; draw(); } }, "+ Add a title") : null),
      form].filter(Boolean));
    if (box) setTimeout(() => box.focus(), 0);
  }

  draw();
  return row;
}
