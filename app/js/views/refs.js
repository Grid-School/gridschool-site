/**
 * Free material a step points at until its film exists. At most two links
 * per node, each with one line on why it is there; the data rule (enforced
 * in curriculum.test.mjs) is that a filmed node carries none, so the list
 * shrinks as the films ship instead of growing into a link farm.
 */

import { el } from "../dom.js";

export function refsBlock(node, { filmed = false } = {}) {
  if (filmed || !node.refs?.length) return null;
  return el(
    "section.step__refs",
    {},
    el("b.eyebrow", {}, "Reference"),
    el("p.room__hint", {}, "Only the part this step names. Each link says which."),
    el(
      "div.step__modlist",
      {},
      node.refs.map((ref) =>
        el(
          "a.step__mod",
          { href: ref.href, target: "_blank", rel: "noopener noreferrer" },
          el("b", {}, ref.title),
          el("span", {}, ref.why)
        )
      )
    )
  );
}
