/**
 * The title switcher: which job this resume is aimed at. One record, many titles; the active one is the lens
 * the whole tool looks through. One line however many titles there are (a wall of chips pushed the work off
 * the screen): a select with each title's checklist score in words, "Add a title", and, quietly, remove.
 */

import { el } from "../dom.js?v=759fedf-202610271938";
import { btn } from "../ui.js?v=759fedf-202610271938";

const score = (t) => (t.fit?.total ? `${t.fit.shown} of ${t.fit.total} on the checklist` : "checklist not worked out yet");

export function titleRow({ targets = [], busy = false, onSwitch, onAdd, onRemove }) {
  if (!targets.length) return null;
  let adding = false;
  let removing = false;
  const row = el("div.tt", { role: "group", "aria-label": "Which job this resume is for" });

  function draw() {
    const active = targets.find((t) => t.active) || targets[0];
    const select = el("select.tt__select", { id: "rz-title", disabled: busy || targets.length < 2 || null, "aria-label": "Resume for" },
      targets.map((t) => el("option", { value: t.id, selected: t.active || null }, `${t.title} · ${score(t)}`)));
    select.addEventListener("change", () => { const t = targets.find((x) => x.id === select.value); if (t && !t.active) onSwitch?.(t); });
    const line = el("div.tt__line", {},
      el("label.tt__label", { for: "rz-title" }, "Resume for"),
      select,
      onAdd && targets.length < 5 && !adding ? btn({ label: "+ Add a title", variant: "quiet", disabled: busy, onclick: () => { adding = true; draw(); } }) : null,
      onRemove && targets.length > 1 && !removing && !adding ? el("button.tt__remove", { type: "button", disabled: busy || null, onclick: () => { removing = true; draw(); } }, "Remove this title") : null);
    // The viewer can't show confirm(): the confirmation is part of the page.
    const confirmRemove = removing
      ? el("div.tt__confirm", {},
          el("span", {}, `Remove "${active.title}"? Its checklist and questions go; your jobs and lines stay.`),
          btn({ label: "Remove", variant: "ghost", onclick: () => { removing = false; onRemove(active); } }),
          btn({ label: "Keep it", variant: "quiet", onclick: () => { removing = false; draw(); } }))
      : null;
    const box = el("textarea.rz__text.tt__box", { rows: 2, placeholder: "The title, or paste the whole job posting", "aria-label": "Title or posting" });
    const form = adding
      ? el("form.tt__add", { onsubmit: (e) => { e.preventDefault(); const text = box.value.trim(); if (text) { adding = false; onAdd?.(text); } } },
          box,
          el("div.rz__row", {}, btn({ label: "Add this title", variant: "solid", type: "submit", disabled: busy }),
            btn({ label: "Cancel", variant: "quiet", onclick: () => { adding = false; draw(); } })))
      : null;
    row.replaceChildren(...[line, confirmRemove, form].filter(Boolean));
    if (form) setTimeout(() => box.focus(), 0);
  }

  draw();
  return row;
}
