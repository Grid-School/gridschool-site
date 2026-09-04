/**
 * Shared parts. Every surface is built from these so the platform stays one
 * object visually and a change to a panel changes it everywhere.
 */

import { el } from "./dom.js";

export function panel({ eyebrow, title, note, actions, tone } = {}, ...children) {
  return el(
    "section.panel",
    { class: tone ? `panel--${tone}` : null },
    (eyebrow || title || actions) &&
      el(
        "header.panel__head",
        {},
        el(
          "div.panel__heading",
          {},
          eyebrow && el("b.eyebrow", {}, eyebrow),
          title && el("h2.panel__title", {}, title),
          note && el("p.panel__note", {}, note)
        ),
        actions && el("div.panel__actions", {}, actions)
      ),
    el("div.panel__body", {}, children)
  );
}

export function chip(text, tone = "") {
  return el("span.chip2", { class: tone ? `chip2--${tone}` : null }, text);
}

export function meter(pct, label) {
  return el(
    "div.meter",
    { role: "img", "aria-label": label ?? `${pct} percent` },
    el("div.meter__fill", { style: { width: `${Math.max(0, Math.min(100, pct))}%` } })
  );
}

export function empty(text, sub) {
  return el("div.empty", {}, el("p", {}, text), sub && el("p.empty__sub", {}, sub));
}

/**
 * An honest placeholder. It says what is coming and that it is not here yet,
 * rather than faking a working feature.
 */
export function placeholder({ title, note, when }) {
  return el(
    "div.ph",
    {},
    el("div.ph__mark", { "aria-hidden": "true" }),
    el(
      "div.ph__body",
      {},
      el("b", {}, title),
      note && el("p", {}, note),
      when && el("span.ph__when", {}, when)
    )
  );
}

/**
 * `type` defaults to "button" so a button inside a form never submits it by
 * accident. Pass type: "submit" when the button IS the form's action.
 */
export function btn({ label, onclick, href, variant = "ghost", disabled, title, target, type = "button" }) {
  const props = { class: `b b--${variant}`, title, disabled: disabled || null };
  if (href) {
    return el("a", { ...props, href, target, rel: target ? "noopener" : null }, label);
  }
  return el("button", { ...props, type, onclick }, label);
}

export function kv(label, value) {
  return el("div.kv", {}, el("b", {}, label), el("span", {}, value));
}

export function field({ label, id, type = "text", value = "", placeholder: ph, hint, textarea }) {
  const input = textarea
    ? el("textarea", { id, rows: 3, placeholder: ph }, value)
    : el("input", { id, type, value, placeholder: ph });
  return {
    input,
    node: el(
      "label.field",
      { for: id },
      el("span.field__label", {}, label),
      input,
      hint && el("span.field__hint", {}, hint)
    ),
  };
}

/** A dot that reads as state without needing a legend. */
export function dot(status) {
  return el("span.dot", { class: `dot--${status}`, "aria-hidden": "true" });
}

/** Copy with a spoken result. Silent clipboard writes leave you guessing. */
export function copy(text, message = "Copied.") {
  if (!text) return toast("Nothing to copy.", "warn");
  return navigator.clipboard
    ?.writeText(text)
    .then(() => toast(message))
    .catch(() => toast("Could not reach the clipboard. Select and copy by hand.", "warn"));
}

export function toast(message, tone = "ok", { ms = 2600 } = {}) {
  const node = el("div.toast", { class: `toast--${tone}`, role: "status" }, message);
  document.body.append(node);
  requestAnimationFrame(() => node.classList.add("is-in"));
  setTimeout(() => {
    node.classList.remove("is-in");
    setTimeout(() => node.remove(), 300);
  }, ms);
}
