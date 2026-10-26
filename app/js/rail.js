/**
 * The rail: one thin column of icons, one width, no toggle.
 *
 * The mark at the top is the way home. Then the doors: the Map (the one home:
 * the path, the every-day tools on it, and what to do next), then the Calendar, each an
 * icon with its word under it so nothing needs a tooltip to be understood,
 * and the Map carrying the one count that matters (required lit / total).
 * Under a hairline, the tools they come back to: the resume builder, the job
 * search, project ideas, post drafts, profile photos, and Posts (the day's
 * LinkedIn comments). Each also opens from its step on the map; the rail is the
 * way back to it once that step is done. On a phone the tools ride in the same
 * scrolling row as the doors.
 * Coach and Posts are drawn only when they work (features.js).
 * At the bottom, the student, as an avatar that opens the profile sheet.
 * Nothing about instructors or dev lives here; that is instructor-strip.js,
 * mounted only when the device is flagged, so a student rail is a student
 * rail without a mode.
 */

import { el, mount } from "./dom.js?v=c18e1b4-202610261602";
import { gmark } from "../../js/brand.js?v=c18e1b4-202610261602";
import { icon } from "./icons.js?v=c18e1b4-202610261602";
import { returnedUnread } from "./tasks.js?v=c18e1b4-202610261602";
import { progress } from "./graph/model.js?v=c18e1b4-202610261602";
import { enabledViews, isViewEnabled } from "./features.js?v=c18e1b4-202610261602";

export const DOORS = [
  { id: "map", label: "Map", icon: "map", hint: "Your path, the tools you use every day, and what to do next" },
  { id: "calendar", label: "Calendar", icon: "calendar", hint: "The week's clock" },
  { id: "today", label: "Coach", icon: "coach", hint: "Talk a next move through" },
];

/** Tools used more than once. `route` is where the door goes; its id is what setActive matches. */
export const TOOLS = [
  { id: "resume", route: "resume", label: "Resume", icon: "resume", hint: "Build, tailor and download your resume" },
  { id: "do", route: "do", label: "Jobs", icon: "search", hint: "Roles, people and follow-ups for today" },
  { id: "studio/projects", route: "studio/projects", label: "Projects", icon: "projects", hint: "Practice project ideas written for you" },
  { id: "studio/posts", route: "studio/posts", label: "Drafts", icon: "drafts", hint: "Post ideas and drafts in your voice" },
  { id: "images", route: "images", label: "Photos", icon: "photos", hint: "Your headshot and banner, sized for LinkedIn" },
  { id: "posts", route: "posts", label: "Posts", icon: "posts", hint: "Posts worth a comment today" },
];

/** What a route lights on the rail: a tool's own door, else the view itself. */
export function activeDoor(name, args = []) {
  if (name === "studio") return args[0] === "posts" ? "studio/posts" : "studio/projects";
  return name;
}

export function createRail({ onNavigate, onProfile, flags = enabledViews() }) {
  const nav = el("nav.rail__nav", { "aria-label": "Where to go" });
  const links = new Map();
  const count = el("span.rail__count", { hidden: true });

  for (const door of DOORS.filter((d) => isViewEnabled(d.id, flags))) {
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

  const tools = TOOLS.filter((tool) => isViewEnabled(tool.route.split("/")[0], flags));
  if (tools.length) nav.append(el("span.rail__sep", { role: "separator", "aria-hidden": "true" }));
  for (const tool of tools) {
    const link = el(
      "a.rail__door.rail__door--tool",
      {
        href: `#/${tool.route}`,
        title: tool.hint,
        "aria-label": tool.label,
        onclick: (event) => {
          event.preventDefault();
          onNavigate(...tool.route.split("/"));
        },
      },
      el("span.rail__glyph", {}, icon(tool.icon)),
      el("span.rail__word", {}, tool.label)
    );
    links.set(tool.id, link);
    nav.append(link);
  }

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
