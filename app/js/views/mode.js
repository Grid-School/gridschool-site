/**
 * Mode notice on a step page. Open is the default and is not announced, so
 * only the four other modes render. Data lives in ../modes.js.
 */

import { el } from "../dom.js?v=b335f3c-202610202219";
import { modeOf } from "../modes.js?v=b335f3c-202610202219";

export { MODES, modeOf } from "../modes.js?v=b335f3c-202610202219";

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
