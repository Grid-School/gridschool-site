/**
 * The door into the world, on the rail. One click opens a small chooser:
 * Stage (default, first, where merges land and where you meet) and
 * Production. Each opens in a new tab so the board stays where it was.
 *
 * Presence: when an environment's `presence` endpoint is configured, the
 * chooser shows how many are online right now, so "anyone there?" is answered
 * before the tab opens. Discord is for words; the world is for showing up.
 * An unconfigured environment says so instead of pretending.
 */

import { el, mount } from "./dom.js";
import { icon } from "./icons.js";
import { WORLD, isPlaceholder } from "../../config.js";

const PRESENCE_TTL_MS = 30_000;

export function createWorldDoor() {
  const menu = el("div.wdoor__menu", { hidden: true, role: "menu", "aria-label": "Open the world" });
  const button = el(
    "button.rail__door.rail__door--world",
    { type: "button", title: "Open the world in a new tab", "aria-haspopup": "menu", "aria-expanded": "false", onclick: toggle },
    el("span.rail__glyph", {}, icon("world")),
    el("span.rail__word", {}, "World")
  );
  const root = el("div.wdoor", {}, button, menu);

  let open = false;
  const presence = new Map();

  function toggle() {
    setOpen(!open);
  }

  function setOpen(next) {
    open = next;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) {
      render();
      refreshPresence();
      document.addEventListener("pointerdown", onOutside, true);
      document.addEventListener("keydown", onKey, true);
      menu.querySelector("a, button")?.focus();
    } else {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
    }
  }

  function onOutside(event) {
    if (!root.contains(event.target)) setOpen(false);
  }

  function onKey(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      button.focus();
    }
  }

  function render() {
    mount(
      menu,
      el("b.wdoor__eyebrow", {}, "Open in a new tab"),
      ...Object.entries(WORLD).map(([key, env], index) => envRow(key, env, index === 0)),
      el("p.wdoor__hint", {}, "Say where you are going in Discord; whoever is free joins.")
    );
  }

  function envRow(key, env, primary) {
    const live = !isPlaceholder(env.play);
    const online = presence.get(key);
    const count =
      online === undefined
        ? null
        : el("span.wdoor__count", { class: online > 0 ? "is-live" : null }, online === 0 ? "nobody in yet" : `${online} online`);
    const body = [
      el("b", {}, env.label, primary ? el("span.wdoor__default", {}, "default") : null),
      el("span", {}, live ? env.note : "Not connected yet."),
      count,
    ];
    return live
      ? el("a.wdoor__env", { class: primary ? "is-primary" : null, href: env.play, target: "_blank", rel: "noopener", role: "menuitem", onclick: () => setOpen(false) }, ...body)
      : el("span.wdoor__env.is-off", { role: "menuitem", "aria-disabled": "true" }, ...body);
  }

  /** One fetch per environment per open, cached briefly; a failure shows no count. */
  async function refreshPresence() {
    const now = Date.now();
    await Promise.all(
      Object.entries(WORLD).map(async ([key, env]) => {
        if (isPlaceholder(env.presence)) return;
        const cached = presence.get(`${key}:at`);
        if (cached && now - cached < PRESENCE_TTL_MS) return;
        try {
          const res = await fetch(env.presence, { cache: "no-store" });
          const data = res.ok ? await res.json() : null;
          if (typeof data?.online === "number") {
            presence.set(key, data.online);
            presence.set(`${key}:at`, now);
          }
        } catch {
          presence.delete(key);
        }
      })
    );
    if (open) render();
  }

  return { root, close: () => setOpen(false) };
}
