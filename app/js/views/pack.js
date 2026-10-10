/**
 * Prepare: one role, ready to send. Opens over the Hire page, so the run stays
 * where it was. Asks the server (role_pack.py) the first time and keeps the
 * result on the student's own record, so opening it again is instant and Aden
 * sees exactly what they sent.
 *
 * Reading order is the order of the work: is this worth it (fit, gaps), what
 * to lead with, the note, who to reach and the message, a proof idea, the
 * questions to expect. Every block has one Copy. The footer is the two
 * things that move the search: open the posting, and say it went out.
 */

import { el, mount } from "../dom.js?v=5802f60-202610100134";
import { btn, copy, toast } from "../ui.js?v=5802f60-202610100134";
import { createModal } from "../modal.js?v=5802f60-202610100134";
import { peopleLinks, ageLabel } from "../search.js?v=5802f60-202610100134";
import { prepareRole } from "../roles-remote.js?v=5802f60-202610100134";

export function createPackDrawer({ slug, getPack, savePack, onApplied, onTarget = null, readOnly = () => false }) {
  const modal = createModal({ label: "Prepare this role", size: "reading", onClose: () => modal.setOpen(false) });
  modal.layer.classList.add("modal--fixed", "pack-modal");

  async function open(target) {
    // target: { key, title, company, url, published_at } for a radar role,
    // or { pasted: {title, company, description, url} } for a posting found elsewhere.
    const key = target.key ?? `pasted:${(target.pasted?.company ?? "").toLowerCase()}:${(target.pasted?.title ?? "").toLowerCase()}`;
    const role = target.pasted ?? target;
    const body = el("div.pack__body");
    const head = el(
      "header.pack__head",
      {},
      el("b.eyebrow", {}, "Prepare"),
      el("h1.pack__title", {}, role.title || "This role"),
      el("p.pack__where", {}, [role.company, ageLabel(target.published_at)].filter(Boolean).join(" · "))
    );
    const foot = el(
      "footer.pack__foot",
      {},
      role.url ? btn({ label: "Open the posting ↗", variant: "ghost", href: role.url, target: "_blank" }) : null,
      readOnly() || !onTarget
        ? null
        : btn({
            label: "Make it a target",
            variant: "ghost",
            title: "Work this company on every channel: email with a Loom, LinkedIn, a call, follow-ups",
            onclick: () => {
              modal.setOpen(false);
              onTarget({ key: target.key, title: role.title, company: role.company, url: role.url, description: role.description ?? "" });
            },
          }),
      readOnly()
        ? null
        : btn({
            label: "I applied",
            variant: "solid",
            onclick: () => {
              onApplied({ key: target.key, title: role.title, company: role.company, url: role.url });
              modal.setOpen(false);
            },
          }),
      btn({ label: "Close", variant: "quiet", onclick: () => modal.setOpen(false) })
    );
    modal.setOpen(true, { content: el("div.pack", {}, head, body, foot) });

    const cached = getPack(key);
    if (cached?.pack) {
      draw(body, cached.pack, role);
      return;
    }
    if (readOnly()) {
      mount(body, el("p.muted", {}, "Not prepared yet. The student prepares a role from their Hire page."));
      return;
    }
    mount(body, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Reading the posting against your record. About thirty seconds.")));
    try {
      const result = await prepareRole(slug, target.key ? { roleKey: target.key } : { role: target.pasted });
      savePack(result.key ?? key, { pack: result.pack, role: { title: role.title, company: role.company, url: role.url } });
      if (modal.isOpen()) draw(body, result.pack, role);
      if (typeof result.left === "number" && result.left <= 5) toast(`${result.left} prepared roles left today.`, "warn");
    } catch (error) {
      if (modal.isOpen()) mount(body, el("p.pack__error", {}, `That didn't work: ${error.message}`));
    }
  }

  return { layer: modal.layer, open, close: () => modal.setOpen(false), destroy: modal.destroy };
}

function block(title, content, copyText) {
  return el(
    "section.pack__block",
    {},
    el(
      "header.pack__bhead",
      {},
      el("h2", {}, title),
      copyText ? btn({ label: "Copy", variant: "quiet", onclick: () => copy(copyText, `${title} copied.`) }) : null
    ),
    content
  );
}

const list = (items, tag = "ul") => el(tag, {}, items.map((item) => el("li", {}, item)));

function draw(body, pack, role) {
  const parts = [];
  if (pack.no_ai) parts.push(el("p.pack__warn", {}, "This posting asks candidates not to use AI in the application. Write the note yourself, in your own words."));
  parts.push(
    block(
      "Fit",
      el("div", {}, pack.fit_level ? el("span.pack__level", { class: `pack__level--${pack.fit_level}` }, { strong: "Strong fit", possible: "Possible fit", weak: "Weak fit" }[pack.fit_level]) : null, el("p.pack__fit", {}, pack.fit), pack.gaps.length ? el("div.pack__gaps", {}, el("b", {}, "What it wants that your record doesn't show yet"), list(pack.gaps)) : null)
    )
  );
  if (pack.emphasis.length) parts.push(block("Lead with", list(pack.emphasis, "ol"), pack.emphasis.join("\n")));
  if (pack.keywords.length) parts.push(block("Their words, where true", el("div.pack__chips", {}, pack.keywords.map((k) => el("span.chip2", {}, k))), pack.keywords.join(", ")));
  if (pack.note) parts.push(block("Application note", el("p.pack__text", {}, pack.note), pack.note));
  const links = peopleLinks(role.company, pack.people.length ? pack.people.slice(0, 2).map((p) => p.toLowerCase()) : undefined);
  parts.push(
    block(
      "Who to reach",
      el(
        "div",
        {},
        pack.people.length ? list(pack.people) : null,
        el("div.pack__links", {}, links.map((link) => el("a.pack__link", { href: link.href, target: "_blank", rel: "noopener" }, `${link.label} ↗`))),
        el("p.pack__hint", {}, "You open these and pick the person. GridSchool never acts on your LinkedIn.")
      )
    )
  );
  if (pack.message) parts.push(block("Connection note (under 300 characters)", el("p.pack__text", {}, pack.message), pack.message));
  if (pack.message_long) parts.push(block("Longer message or email", el("p.pack__text", {}, pack.message_long), pack.message_long));
  if (pack.proof) parts.push(block("A proof worth a few hours", el("p.pack__text", {}, pack.proof), pack.proof));
  if (pack.prep.length) parts.push(block("Questions to expect", list(pack.prep), pack.prep.join("\n")));
  mount(body, parts);
}
