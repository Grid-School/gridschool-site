/**
 * "This step edits ..." line under the lead. Only nodes that touch one of the
 * three owned artifacts render it. Data lives in ../artifacts.js.
 */

import { el } from "../dom.js?v=9300f22-202610261745";
import { artifactOf } from "../artifacts.js?v=9300f22-202610261745";

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
