/**
 * The rail: one thin column of icons, one width, no toggle.
 *
 * The mark at the top is the way home. Then the doors, Map first, each an
 * icon with its word under it so nothing needs a tooltip to be understood,
 * and the Map carrying the one count that matters (required lit / total).
 * Under a hairline, the World: opens Stage or Production in a new tab
 * (world-door.js). At the bottom, the student, as an avatar that opens the
 * profile sheet.
 * Nothing about instructors or dev lives here; that is instructor-strip.js,
 * mounted only when the device is flagged, so a student rail is a student
 * rail without a mode.
 */

import { el, mount } from "./dom.js";
import { gmark } from "../../js/brand.js";
import { icon } from "./icons.js";
import { returnedUnread } from "./tasks.js";
import { progress } from "./graph/model.js";
import { createWorldDoor } from "./world-door.js";

export const DOORS = [
  { id: "map", label: "Map", icon: "map", hint: "Where you are and what is next" },
  { id: "tasks", label: "Tasks", icon: "tasks", hint: "Every checkbox on the path" },
  { id: "calendar", label: "Calendar", icon: "calendar", hint: "The week's clock" },
  { id: "today", label: "Coach", icon: "coach", hint: "Talk a next move through" },
];

export function createRail({ onNavigate, onProfile }) {
  const nav = el("nav.rail__nav", { "aria-label": "Where to go" });
  const links = new Map();
  const count = el("span.rail__count", { hidden: true });

  for (const door of DOORS) {
    const link = el(
      "a.rail__door",
      {
        href: `#/${door.id}`,
        title: door.hint,
        "aria-label": door.label,
        onclick: (event) => {
          event.preventDefault();
          onNavigate(door.id);
        },
      },
      el("span.rail__glyph", {}, icon(door.icon)),
      el("span.rail__word", {}, door.label),
      door.id === "map" ? count : null
    );
    links.set(door.id, link);
    nav.append(link);
  }

  const world = createWorldDoor();

  const avatar = el("span.rail__avatar", { "aria-hidden": "true" }, "");
  const profile = el(
    "button.rail__me",
    { type: "button", title: "You", "aria-label": "Your profile", onclick: onProfile },
    avatar,
    el("span.rail__word", {}, "You")
  );

  const root = el(
    "aside.rail",
    {},
    el("a.rail__brand", { href: "../", title: "GridSchool", "aria-label": "GridSchool home" }, gmark({ className: "rail__logo" })),
    nav,
    el("div.rail__world", {}, world.root),
    el("div.rail__foot", {}, profile)
  );

  function setActive(name) {
    links.forEach((link, id) => {
      link.classList.toggle("is-active", id === name);
      if (id === name) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  /** The Map carries the lit count. Returned reviews ride along in the title. */
  function setSignals(state) {
    const prog = progress(state.graph);
    const unread = returnedUnread(state.student).length;
    count.hidden = false;
    count.textContent = `${prog.spine.lit}/${prog.spine.total}`;
    const reviews = unread ? ` · ${unread} review${unread === 1 ? "" : "s"} came back` : "";
    links.get("map").title = `Required ${prog.spine.lit} of ${prog.spine.total}${reviews}`;
    profile.classList.toggle("has-news", unread > 0);
  }

  function setIdentity(state) {
    mount(avatar, initials(state.student.name));
    profile.title = state.student.name;
  }

  return { root, setActive, setSignals, setIdentity };
}

export function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
