/**
 * The free sample's step view (complete_map.sample_node, server/free_sample.py): one fresh
 * role picked for them, what to lead with, and a note they can send, then the four more
 * waiting on the full plan. A taste of the paid work, shown in full, never teased.
 *
 * It never says we found a person at the company: that research is the paid plan's and
 * isn't built. On the demo board the role is a made-up stand-in, and says so.
 */

import { el } from "../dom.js?v=2c47259-202610271924";
import { btn, toast } from "../ui.js?v=2c47259-202610271924";
import { shortDay, PAID_ASK } from "../prep.js?v=2c47259-202610271924";

export function sampleBlock(node, { upgrade = null } = {}) {
  const sample = node?.sample;
  if (!sample || !sample.title) return null;
  const note = sample.note ?? {};
  const noteText = [note.subject ? `Subject: ${note.subject}` : "", note.body ?? ""].filter(Boolean).join("\n\n");
  const copy = btn({
    label: "Copy the note",
    variant: "quiet",
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(noteText);
        toast("Copied. Paste it into your own email or LinkedIn.");
      } catch {
        toast("Couldn't copy here. Select the note instead.", "warn");
      }
    },
  });
  const meta = [sample.company, sample.where, sample.posted ? `Posted ${shortDay(sample.posted) || sample.posted}` : null].filter(Boolean).join(" · ");
  return el(
    "section.sample",
    { "aria-label": "Picked for you" },
    el("b.eyebrow", {}, "Picked for you"),
    sample.fictional ? el("p.sample__fiction", {}, "A made-up role for this walkthrough, like Sam.") : null,
    el("h2.sample__role", {}, sample.title),
    meta ? el("p.sample__meta", {}, meta) : null,
    sample.url ? btn({ label: "Open the posting", variant: "quiet", href: sample.url, target: "_blank" }) : null,
    sample.lead?.length
      ? el("div.sample__part", {}, el("b.sample__label", {}, "What to lead with"), el("ol.sample__lead", {}, sample.lead.map((line) => el("li", {}, line))))
      : null,
    sample.fit ? el("p.sample__fit", {}, sample.fit) : null,
    note.body
      ? el(
          "div.sample__part",
          {},
          el("b.sample__label", {}, "A note you can send"),
          el("pre.sample__note", {}, noteText),
          el("div.sample__acts", {}, copy)
        )
      : null,
    node.waiting && upgrade
      ? el(
          "div.sample__more",
          {},
          el("span.dfy__avatar", { "aria-hidden": "true" }, "C"),
          el("p", {}, el("b", {}, `${node.waiting} more waiting on the full plan.`), " Each week we pick roles like this one, write what to lead with, and draft the note."),
          upgrade ? btn({ label: PAID_ASK, variant: "cta", href: upgrade }) : null
        )
      : null
  );
}
