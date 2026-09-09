/**
 * A reading opens over the step, not instead of it. The lesson, the tasks and
 * anything typed into the link form stay exactly where they were; closing the
 * modal shows them again. "Done reading" at the end marks the row in the
 * step's column. Deep links (#/map/<id>/m/<module>) still render the reading
 * as a page for sharing; this is how a student reads it.
 */

import { el, mount } from "../dom.js";
import { btn } from "../ui.js";
import { createModal } from "../modal.js";
import { renderMarkdown, splitTitle } from "../markdown.js";
import { hydrateMermaid } from "../mermaid.js";

const MODULE_ID = /^[a-z0-9][a-z0-9/-]*[a-z0-9]$/;

export function createReadingModal({ onDone }) {
  const modal = createModal({ label: "Reading", size: "reading", onClose: () => modal.setOpen(false) });
  modal.layer.classList.add("modal--fixed");

  async function open(module, { read = false } = {}) {
    const title = el("h1.reading__title", {}, module.title);
    const article = el("article.step__prose.prose", {}, el("p.muted", {}, "Loading…"));
    const foot = el(
      "footer.reading__foot",
      {},
      read
        ? el("span.reading__done", {}, "Read")
        : btn({
            label: "Done reading",
            variant: "solid",
            onclick: () => {
              onDone(module);
              modal.setOpen(false);
            },
          }),
      btn({ label: "Close", variant: "quiet", onclick: () => modal.setOpen(false) })
    );
    modal.setOpen(true, {
      content: el("div.reading", {}, el("b.eyebrow", {}, "Reading"), title, article, foot),
    });

    if (!MODULE_ID.test(module.id ?? "")) {
      mount(article, el("p", {}, "That reading id is not allowed."));
      return;
    }
    try {
      const res = await fetch(new URL(`../../../read/modules/${module.id}.md`, import.meta.url), { cache: "no-store" });
      if (!res.ok) throw new Error("missing");
      const parsed = splitTitle(await res.text());
      if (parsed.title) title.textContent = parsed.title;
      article.innerHTML = renderMarkdown(parsed.body);
      hydrateMermaid(article);
    } catch {
      mount(article, el("p", {}, "That file is not on disk yet. If this is a graph module, sync reading before deploy."));
    }
  }

  return { layer: modal.layer, open, close: () => modal.setOpen(false), destroy: modal.destroy };
}
