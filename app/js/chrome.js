/**
 * The shell around every view: rail, identity, the demo banner.
 * Built once and updated, so navigation never repaints the whole page.
 *
 * The rail has two doors and three drawers, on purpose. Eight items of equal
 * weight is not a menu, it is a decision, and the student paying for this is
 * already out of decisions. Today answers "what now"; the Grid answers "where am I".
 * Everything else is either reached from those two or is a tool you go looking
 * for by name, so it sits below the line, quiet, and never competes.
 *
 * The two doors carry state. A label tells you where a link goes; a badge tells
 * you whether to go. That is the difference between navigation and a menu.
 */

import { el, mount } from "./dom.js";
import { gmark, wordmark } from "../../js/brand.js";
import { btn } from "./ui.js";
import { signOut } from "./session.js";
import { lock } from "./gate.js";
import { returnedUnread } from "./tasks.js";
import { progress } from "./graph/model.js";

const DOORS = [
  { id: "today", label: "Today", hint: "Talk. One next thing." },
  { id: "map", label: "Map", hint: "The whole path" },
];

const TOOLS = [
  { id: "tasks", label: "All tasks" },
  { id: "calendar", label: "Calendar" },
  { id: "library", label: "Library" },
];

export function createChrome({ onNavigate, onReset, onExport }) {
  const railNav = el("nav.rail__nav", { "aria-label": "Where to go" });
  const railTools = el("nav.rail__tools", { "aria-label": "Tools" });
  const identity = el("div.rail__id");
  const banner = el("div.demobar", { hidden: true, role: "status" });
  const outlet = el("main.outlet", { id: "outlet", tabindex: -1 });

  const rail = el(
    "aside.rail",
    {},
    el("a.rail__brand", { href: "../", "aria-label": "GridSchool home" }, gmark({ className: "rail__logo" }), wordmark()),
    railNav,
    el("div.rail__rule", { "aria-hidden": "true" }),
    railTools,
    identity
  );

  const shellMain = el("div.shellmain", {}, banner, outlet);
  const root = el("div.shell", {}, rail, shellMain);

  const items = new Map();
  const badges = new Map();

  for (const door of DOORS) {
    const badge = el("span.rail__badge", { hidden: true });
    const link = el(
      "a.rail__link",
      {
        href: `#/${door.id}`,
        onclick: (event) => {
          event.preventDefault();
          onNavigate(door.id);
        },
      },
      el("div.rail__linktext", {}, el("b", {}, door.label), el("span", {}, door.hint)),
      badge
    );
    items.set(door.id, link);
    badges.set(door.id, badge);
    railNav.append(link);
  }

  for (const tool of TOOLS) {
    const link = el(
      "a.rail__tool",
      {
        href: `#/${tool.id}`,
        onclick: (event) => {
          event.preventDefault();
          onNavigate(tool.id);
        },
      },
      tool.label
    );
    items.set(tool.id, link);
    railTools.append(link);
  }

  function setActive(name) {
    items.forEach((link, id) => link.classList.toggle("is-active", id === name));
  }

  /**
   * Today badges what came back and has not been read — the one genuinely new
   * thing. The Grid carries the count of lit nodes, which is a fact rather than an
   * alarm, so it is styled as a count and not a dot.
   */
  function setSignals(state) {
    const unread = returnedUnread(state.student).length;
    const todayBadge = badges.get("today");
    todayBadge.hidden = unread === 0;
    todayBadge.textContent = String(unread);
    todayBadge.title = `${unread} review${unread === 1 ? "" : "s"} came back`;

    const prog = progress(state.graph);
    const mapBadge = badges.get("map");
    mapBadge.hidden = false;
    mapBadge.className = "rail__badge rail__badge--count";
    mapBadge.textContent = `${prog.lit}/${prog.total}`;
    mapBadge.title = `${prog.lit} of ${prog.total} nodes lit`;
  }

  function setIdentity(state, role) {
    mount(
      identity,
      el(
        "div.rail__who",
        {},
        el("b", {}, state.student.name),
        el("span", {}, `${state.cohort.name} · week ${Math.min(state.week, state.cohort.weeks)}`),
        role === "admin" && el("span.rail__role", {}, "Instructor view")
      ),
      el(
        "div.rail__acts",
        {},
        role === "admin" && btn({ label: "Admin", variant: "quiet", href: "../admin/" }),
        btn({ label: "Export board", variant: "quiet", onclick: onExport }),
        state.hasLocalEdits && btn({ label: "Reset demo", variant: "quiet", onclick: onReset }),
        btn({
          label: "Sign out",
          variant: "quiet",
          onclick: () => {
            signOut();
            // Signing out also locks the platform: the access key is forgotten
            // on this device, so the gate asks again on the next visit.
            lock();
            location.href = "./";
          },
        })
      )
    );
  }

  /**
   * The demo board announces itself; a real student's board does not wear a
   * "demo" label. A real board only speaks up when there are local edits that
   * would be lost, which is a fact the student needs, not a disclaimer.
   */
  function setBanner(state) {
    if (state.slug === "demo") {
      banner.hidden = false;
      mount(
        banner,
        el("b", {}, "Demo board."),
        el(
          "span",
          {},
          state.lessonsLocked
            ? "Walk everything. The full lesson text unlocks with the access key you receive at enrollment."
            : "Nothing here is connected to a real payment or account. Everything you click works."
        )
      );
      return;
    }
    if (state.hasLocalEdits) {
      banner.hidden = false;
      mount(
        banner,
        el("b", {}, "Unsaved to the record."),
        el("span", {}, "Your changes live in this browser until they are exported to your board file.")
      );
      return;
    }
    banner.hidden = true;
  }

  return { root, outlet, shellMain, setActive, setSignals, setIdentity, setBanner };
}
