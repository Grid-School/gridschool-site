/**
 * The instructor's controls, kept out of the student's rail on purpose.
 * A short amber-edged strip under the doors, mounted only when the device is
 * flagged as an instructor's (admin console switch, ?admin=1, ?dev=1). Icons
 * with tooltips; each says its state in its label so a screenshot reads.
 *
 * The demo board never shows this. The public tour reads ahead by clicking a
 * locked node, which previews its lesson; it does not need Dev unlock.
 */

import { el, mount } from "./dom.js";
import { icon } from "./icons.js";
import { isPreviewMedia } from "./preview-mode.js";
import { isInstructorDevice, setInstructorDevice } from "./instructor-mode.js";

export function createInstructorStrip({ onToggleDev, onTogglePreview, showAdminConsole = false }) {
  const root = el("div.istrip", { role: "group", "aria-label": "Instructor controls", hidden: true });

  function control({ label, name, on = null, onclick, href }) {
    const title = on === null ? label : `${label}: ${on ? "on" : "off"}`;
    const props = { class: on ? "is-on" : null, title, "aria-label": title, "aria-pressed": on === null ? null : String(on) };
    return href
      ? el("a.istrip__b", { ...props, href }, icon(name))
      : el("button.istrip__b", { ...props, type: "button", onclick }, icon(name));
  }

  function render(state) {
    mount(
      root,
      el("span.istrip__tag", { title: "This device renders the instructor view" }, "INSTR"),
      control({ label: "Dev unlock", name: "unlock", on: Boolean(state.unlockAll), onclick: onToggleDev }),
      onTogglePreview && control({ label: "Media preview", name: "film", on: isPreviewMedia(), onclick: onTogglePreview }),
      showAdminConsole && control({ label: "Admin console", name: "console", href: "../admin/" }),
      isInstructorDevice() &&
        control({
          label: "Leave instructor view",
          name: "eyeOff",
          onclick: () => {
            setInstructorDevice(false);
            location.reload();
          },
        })
    );
    root.hidden = false;
  }

  return { root, render };
}
