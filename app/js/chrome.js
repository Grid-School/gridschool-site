/**
 * The shell around every view: rail, identity, the demo banner.
 * Built once and updated, so navigation never repaints the whole page.
 *
 * The rail has one door and two drawers, on purpose. Eight items of equal
 * weight is not a menu, it is a decision, and the student paying for this is
 * already out of decisions. The Map answers both "where am I" and "what now":
 * the lit column is the step you are on, and Next opens it. Everything else is
 * either reached from the map or is a tool you go looking for by name, so it
 * sits below the line, quiet, and never competes. The Coach keeps its route
 * (#/coach) and is reached from the step page and the first run, not the rail.
 *
 * The door carries state. A label tells you where a link goes; a badge tells
 * you whether to go. That is the difference between navigation and a menu.
 */

import { el, mount } from "./dom.js";
import { gmark, wordmark } from "../../js/brand.js";
import { btn } from "./ui.js";
import { signOut } from "./session.js";
import { lock } from "./gate.js";
import { returnedUnread } from "./tasks.js";
import { progress } from "./graph/model.js";

/** One door. The map is where the student is, what is next, and the whole path. */
const DOORS = [{ id: "map", label: "Map", hint: "Where you are. What is next." }];

const TOOLS = [
  { id: "tasks", label: "All tasks" },
  { id: "calendar", label: "Calendar" },
];

export function createChrome({
  onNavigate,
  onReset,
  onExport,
  onToggleDev,
  role: chromeRole = "student",
  showAdminConsole = false,
}) {
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
   * The Map carries the count of lit nodes, a fact rather than an alarm, so it
   * is styled as a count and not a dot. Reviews that came back and have not
   * been read ride along in the title; the step page is where they are read.
   */
  function setSignals(state) {
    const unread = returnedUnread(state.student).length;
    const prog = progress(state.graph);
    const mapBadge = badges.get("map");
    mapBadge.hidden = false;
    mapBadge.className = "rail__badge rail__badge--count";
    mapBadge.textContent = `${prog.spine.lit}/${prog.spine.total}`;
    const reviews = unread ? ` ${unread} review${unread === 1 ? "" : "s"} came back.` : "";
    mapBadge.title = `Required ${prog.spine.lit} of ${prog.spine.total}. Depth ${prog.depth.lit} of ${prog.depth.total}.${reviews}`;
  }

  function setIdentity(state, role) {
    const instructor = role === "admin" || chromeRole === "admin";
    const canDev = instructor || state.slug === "demo";
    mount(
      identity,
      el(
        "div.rail__who",
        {},
        el("b", {}, state.student.name),
        el("span", {}, `${state.cohort.name} · week ${Math.min(state.week, state.cohort.weeks)}`),
        instructor && el("span.rail__role", {}, "Instructor view"),
        canDev &&
          state.unlockAll &&
          el("span.rail__role.rail__role--dev", {}, "Dev unlock")
      ),
      el(
        "div.rail__acts",
        {},
        canDev &&
          btn({
            label: state.unlockAll ? "Dev unlock: on" : "Dev unlock: off",
            variant: "quiet",
            onclick: onToggleDev,
          }),
        showAdminConsole && btn({ label: "Admin", variant: "quiet", href: "../admin/" }),
        btn({ label: "Export board", variant: "quiet", onclick: onExport }),
        state.slug === "demo" &&
          state.hasLocalEdits &&
          btn({ label: "Reset demo", variant: "quiet", onclick: onReset }),
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
   * Demo announces itself. A real board is silent when the notebook has the
   * click. It only speaks when the click is still only on this machine.
   */
  function setBanner(state) {
    if (state.slug !== "demo" && state.persistStatus?.state === "local-only") {
      banner.hidden = false;
      mount(
        banner,
        el("b", {}, "Notebook unreachable."),
        el(
          "span",
          {},
          "This click is only on this machine. Later clicks retry. Another device will not see it until the notebook is up."
        )
      );
      return;
    }
    if (state.unlockAll) {
      banner.hidden = false;
      mount(
        banner,
        el("b", {}, "Dev unlock on."),
        el(
          "span",
          {},
          "Every node is open for reading and turn-in. Lighting still requires a real URL. Use Dev unlock in the rail to restore gating."
        )
      );
      return;
    }
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
    banner.hidden = true;
  }

  return { root, outlet, shellMain, setActive, setSignals, setIdentity, setBanner };
}
