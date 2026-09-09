/**
 * Line icons for the rail and the instructor strip. 24-unit grid, 1.6 stroke,
 * currentColor, so a token change in app.css recolours every one. Each is a
 * function returning a fresh <svg>; icons are decorative, the label beside
 * them (visible or as a tooltip and aria-label) carries the meaning.
 */

import { el } from "./dom.js";

function svg(...children) {
  return el(
    "svg.icon",
    { viewBox: "0 0 24 24", width: 22, height: 22, fill: "none", stroke: "currentColor", "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" },
    ...children
  );
}

const path = (d) => el("path", { d });

export const ICONS = {
  /** The map: a path of three rings walked forward. */
  map: () => svg(el("circle", { cx: 6, cy: 18, r: 2.4 }), el("circle", { cx: 12, cy: 11, r: 2.4 }), el("circle", { cx: 18, cy: 5, r: 2.4 }), path("M7.6 16.2 10.4 12.8M13.6 9.2 16.4 6.8")),
  /** All tasks: a checked list. */
  tasks: () => svg(path("M4 7h2M9 7h11M4 12h2M9 12h11M4 17h2M9 17h11")),
  /** Calendar. */
  calendar: () => svg(el("rect", { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }), path("M3.5 10h17M8 3v4M16 3v4")),
  /** The coach: a speech mark. */
  coach: () => svg(path("M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z")),
  /** The world: a globe with one meridian and the equator. */
  world: () => svg(el("circle", { cx: 12, cy: 12, r: 8.5 }), path("M3.5 12h17M12 3.5c2.6 2.6 3.9 5.4 3.9 8.5s-1.3 5.9-3.9 8.5c-2.6-2.6-3.9-5.4-3.9-8.5S9.4 6.1 12 3.5z")),
  /** Profile: a person. */
  user: () => svg(el("circle", { cx: 12, cy: 8.5, r: 3.6 }), path("M4.5 20a7.5 7.5 0 0 1 15 0")),
  /** Export: a tray with an arrow out. */
  download: () => svg(path("M12 4v10M8 10l4 4 4-4M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2")),
  /** Sign out: a door and an arrow. */
  signout: () => svg(path("M10 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h4M15 8l4 4-4 4M19 12H10")),
  /** Dev unlock: an open padlock. */
  unlock: () => svg(el("rect", { x: 5, y: 11, width: 14, height: 9.5, rx: 2 }), path("M8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2")),
  /** Media preview: a film frame. */
  film: () => svg(el("rect", { x: 3.5, y: 5, width: 17, height: 14, rx: 2 }), path("M3.5 9h17M3.5 15h17M8 5v14M16 5v14")),
  /** Admin console: a terminal prompt. */
  console: () => svg(el("rect", { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 }), path("M7.5 9l3 3-3 3M12.5 15h4")),
  /** Leave instructor view: an eye, struck. */
  eyeOff: () => svg(path("M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"), el("circle", { cx: 12, cy: 12, r: 2.6 }), path("M4 20 20 4")),
  /** Reset: a circular arrow. */
  reset: () => svg(path("M4.5 12a7.5 7.5 0 1 1 2.2 5.3M4.5 12V7.5M4.5 12H9")),
  /** External link. */
  external: () => svg(path("M14 4h6v6M20 4l-9 9M18 13.5v5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h5")),
};

export function icon(name) {
  const make = ICONS[name];
  return make ? make() : svg();
}
