/**
 * Line icons for the rail and the instructor strip. 24-unit grid, 1.6 stroke,
 * currentColor, so a token change in app.css recolours every one. Each is a
 * function returning a fresh <svg>; icons are decorative, the label beside
 * them (visible or as a tooltip and aria-label) carries the meaning.
 */

import { el } from "./dom.js?v=e1b1240-202610280516";

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
  /** The job search: a briefcase. */
  search: () => svg(el("rect", { x: 3.5, y: 7.5, width: 17, height: 12, rx: 2 }), path("M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17")),
  /** The resume builder: a page with a folded corner and lines. */
  resume: () => svg(path("M6.5 3.5h7.5l4 4v11.5A1.5 1.5 0 0 1 16.5 20.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5zM14 3.5V7.5h4M8.5 12h7M8.5 15.5h7")),
  /** Project ideas: a lightbulb. */
  projects: () => svg(path("M9 18h6M10 21h4M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.3 1.2 2.2V16h4v-.3c0-.9.5-1.7 1.2-2.2A5.5 5.5 0 0 0 12 3.5z")),
  /** Post drafts: a pen. */
  drafts: () => svg(path("M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM13.5 7l3 3")),
  /** Profile photos: a picture. */
  photos: () => svg(el("rect", { x: 3.5, y: 5, width: 17, height: 14, rx: 2 }), el("circle", { cx: 9, cy: 10, r: 1.6 }), path("M3.5 17l5-4.5 3.5 3 3-2.5 5.5 4.5")),
  /** Back to your step: a crosshair, as in every map app. */
  locate: () => svg(el("circle", { cx: 12, cy: 12, r: 6.5 }), el("circle", { cx: 12, cy: 12, r: 2 }), path("M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3")),
  /** Zoom in and out. */
  zoomin: () => svg(path("M12 5v14M5 12h14")),
  zoomout: () => svg(path("M5 12h14")),
  /** Calendar. */
  calendar: () => svg(el("rect", { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }), path("M3.5 10h17M8 3v4M16 3v4")),
  /** The coach: a speech mark. */
  coach: () => svg(path("M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z")),
  /** Posts worth a comment: a card of lines. */
  posts: () => svg(el("rect", { x: 4, y: 3.5, width: 16, height: 17, rx: 2 }), path("M8 8h8M8 12h8M8 16h5")),
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
