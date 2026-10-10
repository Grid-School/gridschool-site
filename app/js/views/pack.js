/**
 * Prepare: one role, ready to send. Opens over the Hire page, so the run stays
 * where it was. Asks the server (role_pack.py) the first time and keeps the
 * result on the student's own record, so opening it again is instant and Aden
 * sees exactly what they sent.
 *
 * The work is four nodes, one open at a time (node-rail.js): Fit (is it worth
 * it), Apply (what to lead with, their words, the note, then "I applied"),
 * Reach out (who to reach and the messages) and Get ready (a proof idea and
 * the questions to expect). Each node says what its button does; pressing it
 * marks the node done with a check and opens the next. What's done is kept
 * with the prepared role (entry.steps), so it reopens where they left off.
 */

import { el, mount } from "../dom.js?v=d696edf-202610102057";
import { btn, copy, toast } from "../ui.js?v=d696edf-202610102057";
import { createModal } from "../modal.js?v=d696edf-202610102057";
import { peopleLinks, ageLabel } from "../search.js?v=d696edf-202610102057";
import { prepareRole } from "../roles-remote.js?v=d696edf-202610102057";
import { nodeRail, nodeIntro } from "./node-rail.js?v=d696edf-202610102057";

export const PACK_NODES = [
  { id: "fit", label: "Fit" },
  { id: "apply", label: "Apply" },
  { id: "reach", label: "Reach out" },
  { id: "ready", label: "Get ready" },
];

/** Where Prepare opens: the first node not done yet, or the last one. */
export function packFirstOpen(steps) {
  return PACK_NODES.find((n) => !steps?.[n.id])?.id ?? PACK_NODES[PACK_NODES.length - 1].id;
}

export function createPackDrawer({ slug, getPack, savePack, onApplied, onTarget = null, readOnly = () => false }) {
  const modal = createModal({ label: "Prepare this role", size: "reading", onClose: () => modal.setOpen(false) });
  modal.layer.classList.add("modal--fixed", "pack-modal");

  /** `node` opens a given step, e.g. "ready" when a screen is booked. */
  async function open(target, { node = null } = {}) {
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
      btn({ label: "Close", variant: "quiet", onclick: () => modal.setOpen(false) })
    );
    modal.setOpen(true, { content: el("div.pack", {}, head, body, foot) });

    const flow = { key, role, target, steps: {}, entry: null, here: node };
    const cached = getPack(key);
    if (cached?.pack) {
      flow.entry = cached;
      flow.steps = { ...(cached.steps ?? {}) };
      draw(body, flow);
      return;
    }
    if (readOnly()) {
      mount(body, el("p.muted", {}, "Not prepared yet. The student prepares a role from their Hire page."));
      return;
    }
    mount(body, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Reading the posting against your record. About thirty seconds.")));
    try {
      const result = await prepareRole(slug, target.key ? { roleKey: target.key } : { role: target.pasted });
      flow.key = result.key ?? key;
      flow.entry = { pack: result.pack, role: { title: role.title, company: role.company, url: role.url } };
      savePack(flow.key, flow.entry);
      if (modal.isOpen()) draw(body, flow);
      if (typeof result.left === "number" && result.left <= 5) toast(`${result.left} prepared roles left today.`, "warn");
    } catch (error) {
      if (modal.isOpen()) mount(body, el("p.pack__error", {}, `That didn't work: ${error.message}`));
    }
  }

  /** Draw the open node. A node's button saves its step with the role and opens the next node. */
  function draw(body, flow, fresh = []) {
    const { pack, role } = { pack: flow.entry.pack, role: flow.role };
    const ro = readOnly();
    flow.here ??= packFirstOpen(flow.steps);
    const done = PACK_NODES.map((n) => n.id).filter((id) => flow.steps[id]);
    const go = (id) => {
      flow.here = id;
      draw(body, flow);
    };
    const finish = (id) => {
      if (!flow.steps[id]) {
        flow.steps[id] = new Date().toISOString().slice(0, 10);
        if (!ro) savePack(flow.key, { ...flow.entry, steps: flow.steps });
      }
      draw(body, flow, [id]);
      const i = PACK_NODES.findIndex((n) => n.id === id);
      const next = PACK_NODES[i + 1]?.id;
      if (next) setTimeout(() => modal.isOpen() && flow.here === id && go(next), 1100);
    };
    const action = (label, does, onclick) => (ro ? null : el("div.lkit__act", {}, btn({ label, variant: "solid", onclick }), el("span.lkit__does", {}, does)));
    const doneLine = (id) => (flow.steps[id] ? el("p.lkit__saved", {}, `✓ Done ${flow.steps[id]}`) : null);

    let node;
    if (flow.here === "fit") {
      node = [
        nodeIntro("Is it worth applying?", "Read how your record fits this role and what it asks for that your record doesn't show yet. Most listings describe a wish list, so apply when you meet most of it."),
        pack.no_ai ? el("p.pack__warn", {}, "This posting asks candidates not to use AI in the application. Write the note yourself, in your own words.") : null,
        block("Fit", el("div", {}, pack.fit_level ? el("span.pack__level", { class: `pack__level--${pack.fit_level}` }, { strong: "Strong fit", possible: "Possible fit", weak: "Weak fit" }[pack.fit_level]) : null, el("p.pack__fit", {}, pack.fit), pack.gaps.length ? el("div.pack__gaps", {}, el("b", {}, "What it wants that your record doesn't show yet"), list(pack.gaps)) : null)),
        doneLine("fit"),
        flow.steps.fit ? null : action("It's worth it", "Marks this step done and opens Apply. If it isn't worth it, close this and pick another role.", () => finish("fit")),
      ];
    } else if (flow.here === "apply") {
      node = [
        nodeIntro("Apply", "Open the posting and apply on their site. Lead with the points below, use their words where they're true, and paste the note if the form has a box for one."),
        pack.emphasis.length ? block("Lead with", list(pack.emphasis, "ol"), pack.emphasis.join("\n")) : null,
        pack.keywords.length ? block("Their words, where true", el("div.pack__chips", {}, pack.keywords.map((k) => el("span.chip2", {}, k))), pack.keywords.join(", ")) : null,
        pack.note ? block("Application note", el("p.pack__text", {}, pack.note), pack.note) : null,
        role.url ? el("div.lkit__act", {}, btn({ label: "Open the posting ↗", variant: "ghost", href: role.url, target: "_blank" })) : null,
        doneLine("apply"),
        flow.steps.apply
          ? null
          : action("I applied", "Logs the application on your Hire page, marks this step done and opens Reach out.", () => {
              onApplied({ key: flow.target.key, title: role.title, company: role.company, url: role.url });
              finish("apply");
            }),
      ];
    } else if (flow.here === "reach") {
      const links = peopleLinks(role.company, pack.people.length ? pack.people.slice(0, 2).map((p) => p.toLowerCase()) : undefined);
      node = [
        nodeIntro("Reach someone there", "A short note to a person on the team gets read far more often than the application alone. Find one person, then send the connection note or the longer message."),
        block(
          "Who to reach",
          el(
            "div",
            {},
            pack.people.length ? list(pack.people) : null,
            el("div.pack__links", {}, links.map((link) => el("a.pack__link", { href: link.href, target: "_blank", rel: "noopener" }, `${link.label} ↗`))),
            el("p.pack__hint", {}, "These searches open in a new tab, and you pick the person. GridSchool never acts on your LinkedIn.")
          )
        ),
        pack.message ? block("Connection note (under 300 characters)", el("p.pack__text", {}, pack.message), pack.message) : null,
        pack.message_long ? block("Longer message or email", el("p.pack__text", {}, pack.message_long), pack.message_long) : null,
        doneLine("reach"),
        flow.steps.reach ? null : action("I sent a note", "Marks this step done and opens Get ready.", () => finish("reach")),
      ];
    } else {
      node = [
        nodeIntro("Get ready for a reply", "If they write back, this is what to have ready: one small proof you could build for them, and the questions they're likely to ask."),
        pack.proof ? block("A proof worth a few hours", el("p.pack__text", {}, pack.proof), pack.proof) : null,
        pack.prep.length ? block("Questions to expect", list(pack.prep), pack.prep.join("\n")) : null,
        doneLine("ready"),
        flow.steps.ready ? null : action("I've read them", "Marks this role as fully prepared.", () => finish("ready")),
      ];
    }

    const i = PACK_NODES.findIndex((n) => n.id === flow.here);
    const prev = PACK_NODES[i - 1];
    const next = PACK_NODES[i + 1];
    mount(
      body,
      nodeRail({ nodes: PACK_NODES, done, here: flow.here, fresh, onGo: go, label: "Prepare steps" }),
      el("div.cnode", {}, node),
      el(
        "div.cnav",
        {},
        prev ? btn({ label: `← ${prev.label}`, variant: "quiet", onclick: () => go(prev.id) }) : el("span"),
        next ? btn({ label: `${next.label} →`, variant: "ghost", onclick: () => go(next.id) }) : el("span")
      )
    );
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

