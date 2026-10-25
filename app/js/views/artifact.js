/**
 * "This step edits ..." line under the lead. Only nodes that touch one of the
 * three owned artifacts render it. Data lives in ../artifacts.js.
 */

import { el } from "../dom.js?v=ccd0c2c-202610250604";
import { artifactOf } from "../artifacts.js?v=ccd0c2c-202610250604";

export function artifactLine(node) {
  const artifact = artifactOf(node);
  if (!artifact) return null;
  return el(
    "p.step__artifact",
    { class: `step__artifact--${artifact.key}` },
    el("b", {}, `Edits · ${artifact.label}`),
    el("span", {}, artifact.edits)
  );
}
