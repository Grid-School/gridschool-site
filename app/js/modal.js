/**
 * A modal that grows out of the thing you clicked.
 *
 * The point is spatial continuity: a panel that fades in from nowhere makes you
 * re-find your place afterwards, while a panel that expands from the node you
 * pressed and collapses back into it keeps the map fixed in your head. Callers
 * pass the screen point it should grow from; everything else - the scrim, escape,
 * focus, the return trip - is handled here so no view has to reimplement it.
 *
 * There is one door: `setOpen(shouldBeOpen, …)`. Callers declare what is true
 * rather than issuing open and close commands, so a panel cannot be left on
 * screen by an owner that believes it is shut. Where it matters - escape, and
 * teardown - this asks the document what is showing rather than trusting its
 * own flag, because the flag is exactly what drifts when something goes wrong.
 */

import { el, mount, clear } from "./dom.js";

const OUT_MS = 220;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * `layer` is positioned by the caller's stylesheet - it fills whatever box it is
 * appended to, so a modal over the map covers the map and not the whole page.
 */
export function createModal({ label, size = "wide", onClose = () => {} } = {}) {
  const body = el("div.modal__body");
  const panel = el(`section.modal__panel.modal__panel--${size}`, {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": label,
    tabindex: "-1",
  }, body);
  const scrim = el("div.modal__scrim", { onclick: () => request("scrim") });
  const layer = el("div.modal", { hidden: true, "data-no-pan": "" }, scrim, panel);

  let open = false;
  let closing = null;
  let returnFocusTo = null;

  /** Ask to close. The owner decides, because the owner holds the selection. */
  function request(reason) {
    onClose(reason);
  }

  /**
   * Origin is expressed as the offset from the panel's resting centre to the
   * point it grows from, so the transform stays a pure translate plus scale and
   * the browser can run it on the compositor.
   */
  function setOrigin(point) {
    // Measure with no offset applied: getBoundingClientRect reports the
    // transformed box, so a leftover offset from the last open would move the
    // centre this calculation is measuring from.
    layer.style.removeProperty("--ox");
    layer.style.removeProperty("--oy");
    if (!point) return;
    const box = panel.getBoundingClientRect();
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;
    layer.style.setProperty("--ox", `${Math.round(point.x - centreX)}px`);
    layer.style.setProperty("--oy", `${Math.round(point.y - centreY)}px`);
  }

  /** What the document is showing, whatever this module happens to believe. */
  const isShowing = () => !layer.hidden && layer.classList.contains("is-open");

  /** The only door. Callers pass what should be true, not what to do. */
  function setOpen(next, { content = null, origin = null } = {}) {
    if (next) show(content, { origin });
    else hide();
  }

  function show(content, { origin = null } = {}) {
    if (closing) {
      clearTimeout(closing);
      closing = null;
      layer.classList.remove("is-closing");
    }

    // Re-rendering while open throws away the element that had focus (the submit
    // button that just fired, say). Without this, focus lands on <body> and the
    // trap has nothing to hold.
    const hadFocus = panel.contains(document.activeElement);
    mount(body, content);
    /* Every open - same node or a new one - starts at the top. The panel is the
       scroll container; remounting content alone leaves scrollTop in place. */
    panel.scrollTop = 0;
    body.scrollTop = 0;
    if (open && hadFocus && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }

    layer.style.pointerEvents = "";
    layer.inert = false;
    if (open) return;
    open = true;
    returnFocusTo = document.activeElement;
    layer.hidden = false;
    // The panel has to be laid out before its centre is known, and the start
    // frame has to be painted before the class that transitions away from it.
    layer.classList.remove("is-open");
    setOrigin(origin);
    requestAnimationFrame(() => {
      layer.classList.add("is-open");
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
    });
  }

  function hide() {
    open = false;
    if (layer.hidden && !closing && !layer.classList.contains("is-open")) return;
    layer.classList.remove("is-open");
    layer.classList.add("is-closing");
    // The YouTube player keeps eating pointer events after the scrim fades, even
    // when this layer is pointer-events: none - iframes do not inherit that.
    // Pull them out now so the grid can be dragged the moment the room closes.
    layer.style.pointerEvents = "none";
    layer.inert = true;
    for (const frame of layer.querySelectorAll("iframe")) frame.remove();
    if (closing) clearTimeout(closing);
    closing = setTimeout(() => {
      layer.hidden = true;
      layer.classList.remove("is-closing");
      clear(body);
      panel.scrollTop = 0;
      closing = null;
    }, OUT_MS);

    // Sending focus back to the node keeps keyboard order intact: tab from where
    // you were, not from the top of the document.
    if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true });
    returnFocusTo = null;
  }

  /**
   * Escape is handled at the window, not on the panel. Focus can end up outside
   * the dialog for reasons the dialog does not control, and a modal you cannot
   * dismiss is a trap. Capture phase, so it lands before the app's shortcuts.
   */
  function onWindowKey(event) {
    if (event.key !== "Escape" || !isShowing()) return;
    event.preventDefault();
    event.stopPropagation();
    request("escape");
  }
  window.addEventListener("keydown", onWindowKey, true);

  /** Tab stays inside: aria-modal has to be true in fact, not just in the attribute. */
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const stops = [...panel.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null);
    if (!stops.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  return {
    layer,
    panel,
    setOpen,
    isOpen: isShowing,
    destroy() {
      window.removeEventListener("keydown", onWindowKey, true);
      if (closing) clearTimeout(closing);
    },
  };
}
