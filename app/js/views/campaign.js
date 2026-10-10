/**
 * A target campaign, over the Hire page, as a row of nodes with one open at a
 * time (campaign-steps.js): research the company and the person, write the
 * Loom script one question per screen, record it, then the email, LinkedIn,
 * call and the day 3, 7 and 14 follow-ups. A node turns green with a check
 * when the student's record says it's done, and the drawer moves on to the
 * next one. Every button says what pressing it does.
 *
 * The drafts come from campaign_draft.py the first time the drawer opens and
 * stay on the student's record. They send everything themselves: mail opens
 * in their own mail app, the call is their phone, LinkedIn is their click.
 */

import { el, mount } from "../dom.js?v=d696edf-202610102057";
import { btn, copy, toast, field } from "../ui.js?v=d696edf-202610102057";
import { createModal } from "../modal.js?v=d696edf-202610102057";
import { DAY0, FOLLOWUP_DAYS, nextTouch, fillLinks, peopleLinks } from "../search.js?v=d696edf-202610102057";
import { draftCampaign } from "../roles-remote.js?v=d696edf-202610102057";
import { scriptWizard, recordNode, closeRehearsal } from "./loom-kit.js?v=d696edf-202610102057";
import { nodeRail, nodeIntro } from "./node-rail.js?v=d696edf-202610102057";
import { NODES, doneNodes, firstOpen, nextNode, prevNode, labelOf } from "../campaign-steps.js?v=d696edf-202610102057";

export function createCampaignDrawer({ slug, getTarget, onPatch, onTouch, getPortfolio, readOnly = () => false }) {
  const modal = createModal({ label: "Target campaign", size: "reading", onClose: () => closeRehearsal() || close() });
  function close() {
    closeRehearsal();
    openId = null;
    modal.setOpen(false);
  }
  modal.layer.classList.add("modal--fixed", "pack-modal", "camp-modal");
  let openId = null;
  let drafting = false;

  async function open(targetId) {
    openId = targetId;
    const target = getTarget(targetId);
    const needsDraft = Boolean(target && !target.campaign && !readOnly() && !drafting);
    if (needsDraft) drafting = true;
    render();
    if (needsDraft) {
      try {
        const result = await draftCampaign(slug, target.roleKey ? { roleKey: target.roleKey, insider: target.insider, portfolio: getPortfolio() } : { role: { company: target.company, title: target.role, url: target.link, description: target.posting || target.why }, insider: target.insider, portfolio: getPortfolio() });
        onPatch(targetId, { campaign: result.campaign });
        if (typeof result.left === "number" && result.left <= 3) toast(`${result.left} campaign drafts left today.`, "warn");
      } catch (error) {
        toast(`The campaign draft failed: ${error.message}`, "warn");
      } finally {
        drafting = false;
        render();
      }
    }
  }

  /** Which node each target is on, and which nodes were already done when this drawer last drew. */
  const at = new Map();
  const seen = new Map();

  function goTo(id) {
    const place = at.get(openId);
    if (place) place.node = id;
    render();
    modal.panel.querySelector(".modal__body")?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  /** Redraw from the record (called after every save, so Sent ticks show at once). */
  function render() {
    if (!openId) return;
    const target = getTarget(openId);
    if (!target) return;
    const c = target.campaign;
    const ro = readOnly();
    const links = { loom: target.loomUrl, portfolio: getPortfolio() };
    const sent = (channel) => target.touches?.[channel];
    const sentChip = (channel) => (sent(channel) ? el("span.camp__sent", {}, `Sent ${sent(channel)}`) : null);
    const markSent = (channel, label, entry = {}) =>
      ro || sent(channel)
        ? null
        : btn({ label: "I sent it", variant: "solid", onclick: () => onTouch(target.id, channel, { kind: "warm", company: target.company, role: target.role, contact: target.contact?.name || "", note: label, ...entry }) });

    if (!at.has(target.id)) at.set(target.id, { node: firstOpen(target) });
    const place = at.get(target.id);
    const done = doneNodes(target);
    // A node that just became done gets the check animation once, then moves on by itself.
    const before = seen.get(target.id);
    const fresh = before ? done.filter((id) => !before.includes(id)) : [];
    seen.set(target.id, done);
    if (fresh.includes(place.node) && place.node !== "script") {
      const next = nextNode(place.node);
      if (next && place.node !== "follow") setTimeout(() => openId === target.id && at.get(target.id)?.node === place.node && goTo(next), 1200);
    }

    const head = el(
      "header.pack__head",
      {},
      el("b.eyebrow", {}, "Target"),
      el("h1.pack__title", {}, target.company),
      el("p.pack__where", {}, [target.role, c?.size, nextTouch(target)].filter(Boolean).join(" · "))
    );

    const rail = nodeRail({ nodes: NODES, done, here: place.node, fresh, onGo: goTo, label: "Campaign steps" });

    let body;
    if (!c) {
      body = el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, drafting ? "Writing the campaign around what this company needs owned. About a minute." : "No campaign yet."));
    } else {
      body = nodeBody(place.node, { target, c, ro, links, sent, markSent, sentChip });
    }

    const prev = prevNode(place.node);
    const next = nextNode(place.node);
    const nav = c
      ? el(
          "div.cnav",
          {},
          prev ? btn({ label: `← ${labelOf(prev)}`, variant: "quiet", onclick: () => goTo(prev) }) : el("span"),
          done.includes(place.node) ? el("span.cnav__done", {}, "✓ Done") : el("span"),
          next ? btn({ label: `${labelOf(next)} →`, variant: "ghost", onclick: () => goTo(next) }) : el("span")
        )
      : null;

    const foot = el(
      "footer.pack__foot",
      {},
      target.link ? btn({ label: "The posting ↗", variant: "ghost", href: target.link, target: "_blank" }) : null,
      ro || target.state !== "active"
        ? null
        : [
            btn({ label: "They replied", variant: "solid", onclick: () => { onPatch(target.id, { state: "replied" }); toast("Moved to Replied. Book the call and prepare for it from your run."); } }),
            btn({ label: "Close target", variant: "quiet", onclick: () => confirm(`Close ${target.company}? It leaves your active five.`) && onPatch(target.id, { state: "closed" }) }),
          ],
      btn({ label: "Close", variant: "quiet", onclick: close })
    );
    const content = el("div.pack", {}, head, c ? rail : null, el("div.pack__body", {}, el("div.cnode", { "data-node": place.node }, body), nav), foot);
    // Already showing: swap the content in place so a Sent halfway down doesn't jump to the top.
    if (!modal.layer.hidden && !modal.layer.classList.contains("is-closing")) mount(modal.panel.querySelector(".modal__body"), content);
    else modal.setOpen(true, { content });
  }

  /** One node's content. Each says what it's for, what to do, and what pressing its button does. */
  function nodeBody(id, { target, c, ro, links, sent, markSent, sentChip }) {
    const intro = nodeIntro;

    if (id === "who") {
      const cName = field({ label: "Hiring manager's name", id: `cp-name-${target.id}`, value: target.contact?.name ?? "" });
      const cEmail = field({ label: "Their email", id: `cp-email-${target.id}`, type: "email", value: target.contact?.email ?? "" });
      const cPhone = field({ label: "Company phone", id: `cp-phone-${target.id}`, type: "tel", value: target.contact?.phone ?? "" });
      const cLinked = field({ label: "Their LinkedIn", id: `cp-li-${target.id}`, value: target.contact?.linkedin ?? "" });
      if (ro) [cName, cEmail, cPhone, cLinked].forEach((f) => (f.input.disabled = true));
      return el(
        "div",
        {},
        intro("Research the company and find the person", "Read what they need owned, then find the person who's hiring for this role. Their name and at least one way to reach them finishes this step."),
        section("What they need owned", null, el("div", {}, el("p.pack__fit", {}, c.problem), c.trust.length ? el("div.pack__gaps", {}, el("b", {}, "Why you're trusted with it"), el("ul", {}, c.trust.map((t) => el("li", {}, t)))) : null, c.words.length ? el("div.pack__chips.camp__words", {}, c.words.map((w) => el("span.chip2", {}, w))) : null)),
        section(
          "Who to reach",
          null,
          el(
            "div",
            {},
            el("div.pack__links", {}, peopleLinks(target.company).map((l) => el("a.pack__link", { href: l.href, target: "_blank", rel: "noopener" }, `${l.label} ↗`)), el("a.pack__link", { href: `https://www.google.com/search?q=${encodeURIComponent(`${target.company} careers contact phone`)}`, target: "_blank", rel: "noopener" }, "Their phone and site ↗")),
            el("p.pack__hint", {}, "These searches open in a new tab. You pick the person yourself. HN posts often include the founder's email."),
            el("div.camp__grid", {}, cName.node, cEmail.node, cPhone.node, cLinked.node),
            ro ? null : el("div.lkit__act", {}, btn({ label: "Save this person", variant: "solid", onclick: () => onPatch(target.id, { contact: { name: cName.input.value.trim(), email: cEmail.input.value.trim(), phone: cPhone.input.value.trim(), linkedin: cLinked.input.value.trim() } }) }), el("span.lkit__does", {}, "Saves them to this target. The email, LinkedIn and call steps use these details."))
          )
        )
      );
    }

    if (id === "script") {
      return el(
        "div",
        {},
        intro("Write your Loom script", "One question at a time, in your own words. Each one starts with a sentence to finish and shows a made-up example. When all five parts are done, you'll see the whole script and move on to recording."),
        scriptWizard({ target, campaign: c, readOnly: ro, onSaveScript: (loomScript) => onPatch(target.id, { loomScript }), onFinish: () => goTo("record") })
      );
    }

    if (id === "record") {
      const loomUrl = field({ label: "Your Loom link", id: `cp-loom-${target.id}`, type: "url", value: target.loomUrl ?? "", placeholder: "https://www.loom.com/share/…" });
      if (ro) loomUrl.input.disabled = true;
      return el(
        "div",
        {},
        intro("Record your Loom", "Practise with your script, record the real one on Loom, then paste its link. The link is what finishes this step."),
        recordNode({
          target,
          campaign: c,
          readOnly: ro,
          loomField: loomUrl,
          onSaveLink: () => onPatch(target.id, { loomUrl: loomUrl.input.value.trim() }),
          onTake: () => onPatch(target.id, { loomTakes: (getTarget(target.id)?.loomTakes || 0) + 1 }),
          onEditScript: () => goTo("script"),
        })
      );
    }

    if (id === "email") {
      const body = fillLinks(c.email.body, links);
      const mailto = `mailto:${encodeURIComponent(target.contact?.email ?? "")}?subject=${encodeURIComponent(c.email.subject)}&body=${encodeURIComponent(body)}`;
      return el(
        "div",
        {},
        intro("Send the email", "This email links to your Loom. Open it in your own mail app, read it once, change anything that doesn't sound like you, and send it. Then come back and press I sent it."),
        !target.loomUrl ? el("p.pack__warn", {}, "Your Loom link isn't saved yet, so the email still shows [Loom link]. Finish the Record step first.") : null,
        section("Email", `${c.email.subject}\n\n${body}`, el("div", {}, el("p.camp__subject", {}, c.email.subject), el("p.pack__text", {}, body))),
        el("div.lkit__act", {}, btn({ label: "Open in my mail app", variant: "ghost", href: mailto }), markSent("email", "Email + Loom"), sentChip("email")),
        sent("email") ? null : el("p.lkit__does", {}, "I sent it logs the email on your Hire page and starts the follow-up clock.")
      );
    }

    if (id === "linkedin") {
      const liSearch = peopleLinks(target.company)[0]?.href;
      const profile = target.contact?.linkedin ? (/^https?:/.test(target.contact.linkedin) ? target.contact.linkedin : `https://${target.contact.linkedin}`) : liSearch;
      return el(
        "div",
        {},
        intro("Send a LinkedIn request", "A connection request with a short note to the same person. Copy the note, open their profile, choose Connect, then Add a note, and paste it."),
        section("Note", c.linkedin, el("p.pack__text", {}, c.linkedin)),
        el("div.lkit__act", {}, profile ? btn({ label: target.contact?.linkedin ? "Open their profile ↗" : "Find them ↗", variant: "ghost", href: profile, target: "_blank" }) : null, markSent("linkedin", "LinkedIn request"), sentChip("linkedin")),
        sent("linkedin") ? null : el("p.lkit__does", {}, "I sent it logs the request on your Hire page.")
      );
    }

    if (id === "call") {
      return el(
        "div",
        {},
        intro("Make the call", "Call the company and ask for the person hiring for this role. Read these once before you dial. Most calls end at voicemail, and that's fine."),
        section(
          "What to say",
          `To whoever answers: ${c.call.gatekeeper}\n\nIf you reach the hiring manager: ${c.call.manager}\n\nVoicemail: ${c.call.voicemail}`,
          el("div.camp__call", {}, el("div", {}, el("b", {}, "Whoever answers"), el("p", {}, c.call.gatekeeper)), el("div", {}, el("b", {}, "The hiring manager"), el("p", {}, c.call.manager)), el("div", {}, el("b", {}, "Voicemail"), el("p", {}, c.call.voicemail)))
        ),
        el("div.lkit__act", {}, target.contact?.phone ? btn({ label: `Call ${target.contact.phone}`, variant: "ghost", href: `tel:${target.contact.phone.replace(/[^\d+]/g, "")}` }) : null, markSent("call", "Call"), sentChip("call")),
        sent("call") ? null : el("p.lkit__does", {}, "I made the call logs it on your Hire page, whether you reached someone or left a voicemail.")
      );
    }

    // Follow-ups: one card per day, each with the new thing to add.
    return el(
      "div",
      {},
      intro("Follow up on day 3, 7 and 14", "Many replies come after a follow-up. Each one adds one new thing on the same thread. Your Hire page tells you when each is due."),
      c.followups.map((f) => {
        const key = `d${FOLLOWUP_DAYS.includes(f.day) ? f.day : FOLLOWUP_DAYS[Math.min(2, c.followups.indexOf(f))]}`;
        const text = fillLinks(f.text, links);
        return section(`Day ${key.slice(1)} · ${f.channel}`, text, el("div", {}, el("p.pack__text", {}, text), el("div.row", {}, markSent(key, `Day ${key.slice(1)} follow-up`), sentChip(key))));
      })
    );
  }

  return { layer: modal.layer, open, refresh: () => !modal.layer.hidden && render(), destroy: modal.destroy };
}

function section(title, copyText, content) {
  return el(
    "section.pack__block",
    {},
    el("header.pack__bhead", {}, el("h2", {}, title), copyText ? btn({ label: "Copy", variant: "quiet", onclick: () => copy(copyText, `${title} copied.`) }) : null),
    content
  );
}

export { DAY0 };
