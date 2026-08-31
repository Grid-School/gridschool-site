/**
 * Founding token door. Demo never sees this. The access key opens the
 * curriculum; this secret opens the lab notebook on Postgres.
 */

import { el, mount } from "./dom.js";
import { persistToken, setPersistToken } from "./session.js";
import { remoteEnabled } from "./persist-remote.js";

export function needsPersistToken(slug) {
  return remoteEnabled(slug) && !persistToken();
}

export function renderPersistDoor(app, slug) {
  const input = el("input", {
    type: "password",
    id: "persist-key",
    placeholder: "Lab notebook secret",
    autocomplete: "off",
    style:
      "width:100%;font:inherit;font-size:15px;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:11px 13px;",
  });
  const err = el(
    "p",
    { style: "color:#ff9d9d;font-size:13px;margin-top:8px;", hidden: true },
    "Paste the secret Aden sent you. It is not the lesson access key."
  );
  const form = el(
    "form",
    {
      style: "margin-top:14px",
      onsubmit: (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) {
          err.hidden = false;
          input.focus();
          return;
        }
        setPersistToken(value);
        location.reload();
      },
    },
    el(
      "label",
      { for: "persist-key", style: "display:block;font-size:14px;margin-bottom:6px;color:var(--text)" },
      "Lab notebook secret"
    ),
    input,
    err,
    el("button.b.b--solid", { type: "submit", style: "margin-top:12px" }, "Open my notebook")
  );

  mount(
    app,
    el(
      "div.gate",
      {},
      el(
        "div.picker",
        {},
        el("h1", {}, "This board writes to the lab"),
        el(
          "p.muted",
          {},
          `${slug} is a real seat. Progress, notes, and reviews live in the school notebook, not only this browser. Demo never asks for this.`
        ),
        form
      )
    )
  );
}
