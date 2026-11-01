/**
 * Mode notice on a step page. Open is the default and is not announced, so
 * only the four other modes render. Data lives in ../modes.js.
 */

import { el } from "../dom.js?v=7b0c6e7-202611010037";
import { modeOf } from "../modes.js?v=7b0c6e7-202611010037";

export { MODES, modeOf } from "../modes.js?v=7b0c6e7-202611010037";

/** A one-line notice under the lead, only when the mode is not Open. */
export function modeLine(node) {
  const mode = modeOf(node);
  if (mode.key === "open") return null;
  return el(
    "p.step__mode",
    { class: `step__mode--${mode.key}` },
    el("b", {}, `${mode.label} mode`),
    el("span", {}, mode.rule)
  );
}
