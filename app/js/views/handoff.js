/**
 * Handing work over for review.
 *
 * This used to be a page of its own, which put the act of asking for a review
 * as far as possible from the work being reviewed. It is now a disclosure that
 * appears in two places: inside a node's room, where it already knows which
 * node and which URL, and on Today, for anything that is not tied to a node.
 *
 * A review request without a stated doubt wastes both sides, so the doubt field
 * is not optional decoration - it is the point of the form.
 */

import { el } from "../dom.js";
import { btn, field, toast } from "../ui.js";

const KINDS = [
  { id: "pr", label: "A pull request" },
  { id: "scope", label: "A scope proposal" },
  { id: "linkedin", label: "LinkedIn or resume" },
  { id: "story", label: "A story or write-up" },
  { id: "recording", label: "A recording" },
];

/** `node` prefills the form and ties the review to a node when it exists. */
export function handoffForm({ store, node = null, onDone = () => {} } = {}) {
  const suffix = node ? `-${node.id}` : "";
  const title = field({
    label: "What is it",
    id: `rv-title${suffix}`,
    value: node ? `${String(node.n).padStart(2, "0")} ${node.title}` : "",
    placeholder: "Studio repo: the caching change",
  });
  const url = field({
    label: "Link to the work",
    id: `rv-url${suffix}`,
    type: "url",
    value: node?.proof?.url ?? "",
    placeholder: "https://",
  });
  const ask = field({
    label: "What should I look at hardest",
    id: `rv-ask${suffix}`,
    textarea: true,
    placeholder: "Name your own doubt. That is what makes a review fast.",
    hint: "A review request without a doubt in it wastes both of us.",
  });

  const select = el(
    "select",
    { id: `rv-kind${suffix}` },
    KINDS.map((kind) => el("option", { value: kind.id }, kind.label))
  );

  return el(
    "form.rvform",
    {
      onsubmit: (event) => {
        event.preventDefault();
        if (!title.input.value.trim()) return toast("Give it a name.", "warn");
        if (!/^https?:\/\/.+/.test(url.input.value.trim())) return toast("I need a link I can open.", "warn");
        store.addReview({
          title: title.input.value.trim(),
          link: url.input.value.trim(),
          kind: select.value,
          ask: ask.input.value.trim(),
          nodeId: node?.id ?? null,
        });
        title.input.value = node ? `${String(node.n).padStart(2, "0")} ${node.title}` : "";
        url.input.value = "";
        ask.input.value = "";
        toast("Sent. Notes come back Sunday evening.");
        onDone();
      },
    },
    title.node,
    el("label.field", { for: `rv-kind${suffix}` }, el("span.field__label", {}, "Kind"), select),
    url.node,
    ask.node,
    btn({ label: "Send it", variant: "solid", type: "submit" })
  );
}

/** The collapsed version. Native disclosure: no state to manage, keyboard works. */
export function handoffDisclosure({ store, node = null, label = "Send for review" } = {}) {
  return el(
    "details.reveal",
    {},
    el("summary.reveal__sum", {}, label),
    el("div.reveal__body", {}, handoffForm({ store, node }))
  );
}
