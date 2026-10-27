/**
 * "This step edits ..." line under the lead. Only nodes that touch one of the
 * three owned artifacts render it. Data lives in ../artifacts.js.
 */

import { el } from "../dom.js?v=0d1e53b-202610270239";
import { artifactOf } from "../artifacts.js?v=0d1e53b-202610270239";

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
