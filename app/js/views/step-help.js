/**
 * "Need help with this step?" on every open step. The question goes to Aden
 * with this step's title and link (store.askAboutStep), so help happens on the
 * node it's about, not in a chat thread that has lost the context.
 */

import { el } from "../dom.js?v=2f611ec-202610272301";
import { btn, toast } from "../ui.js?v=2f611ec-202610272301";

export function helpBlock({ node, store, isAdmin = false }) {
  if (isAdmin || node.kind === "future" || node.type === "reference") return null;
  const id = `help-${node.id}`;
  const box = el("textarea", { id, rows: 2, placeholder: "What's in the way? One sentence is enough." });
  return el(
    "section.step__help",
    {},
    el("b.eyebrow", {}, "Need help with this step?"),
    el(
      "div.task__field",
      {},
      el("label", { for: id }, "Ask your coach here. They get it with a link to this step."),
      box
    ),
    btn({
      label: "Ask your coach",
      variant: "quiet",
      onclick: () => {
        const text = box.value.trim();
        if (!text) {
          box.focus();
          return;
        }
        box.value = "";
        // Saving redraws the step, so the confirmation lives in a toast, not on the page.
        store.askAboutStep({ nodeId: node.id, title: node.title, text });
        toast("Sent to your coach. They'll answer on Discord.");
      },
    })
  );
}
