/**
 * The shell around every view: rail, banner, outlet, and the two things that
 * hang off the rail (the profile sheet and, on an instructor's device, the
 * instructor strip). Built once and updated, so navigation never repaints
 * the whole page.
 *
 * Composition only. What each piece is lives in its own file:
 *   rail.js              the doors and the avatar
 *   instructor-strip.js  dev unlock, media preview, admin, leave
 *   profile.js           the sheet behind the avatar
 */

import { el, mount } from "./dom.js";
import { signOut } from "./session.js";
import { lock } from "./gate.js";
import { createRail } from "./rail.js";
import { createInstructorStrip } from "./instructor-strip.js";
import { createProfile } from "./profile.js";

export function createChrome({
  onNavigate,
  onReset,
  onExport,
  onToggleDev,
  onTogglePreview,
  getState,
  role = "student",
  showAdminConsole = false,
}) {
  const banner = el("div.demobar", { hidden: true, role: "status" });
  const outlet = el("main.outlet", { id: "outlet", tabindex: -1 });
  const shellMain = el("div.shellmain", {}, banner, outlet);

  const profile = createProfile({
    getState,
    onExport,
    onReset,
    onNavigate,
    onSignOut: () => {
      signOut();
      // Signing out also locks the platform: the access key is forgotten on
      // this device, so the gate asks again on the next visit.
      lock();
      location.href = "./";
    },
  });

  const rail = createRail({
    onNavigate,
    onProfile: (event) => profile.open(event ? { x: event.clientX, y: event.clientY } : null),
  });

  const instructor = role === "admin" ? createInstructorStrip({ onToggleDev, onTogglePreview, showAdminConsole }) : null;
  if (instructor) rail.root.insertBefore(instructor.root, rail.root.lastElementChild);

  const root = el("div.shell", {}, rail.root, shellMain, profile.layer);

  function setIdentity(state) {
    rail.setIdentity(state);
    instructor?.render(state);
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
        el("span", {}, "This click is only on this machine. Later clicks retry. Another device will not see it until the notebook is up.")
      );
      return;
    }
    if (state.unlockAll) {
      banner.hidden = false;
      mount(
        banner,
        el("b", {}, "Dev unlock on."),
        el("span", {}, "Every node is open for reading and turn-in. Lighting still requires a real URL. The padlock in the rail restores gating.")
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

  return {
    root,
    outlet,
    shellMain,
    setActive: rail.setActive,
    setSignals: rail.setSignals,
    setIdentity,
    setBanner,
    closeProfile: profile.close,
  };
}
