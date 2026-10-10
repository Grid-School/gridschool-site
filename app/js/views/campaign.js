/**
 * A target campaign, over the Hire page. One company, every channel, in the
 * order they're sent: the problem they need owned, who to reach and how, the
 * email with a Loom, the Loom script, the LinkedIn note, the call, then the
 * day 3, 7 and 14 follow-ups. Each block has Copy and a "Sent" that logs the
 * touch, so the cadence and the counts on Hire stay true.
 *
 * The drafts come from campaign_draft.py the first time the drawer opens and
 * stay on the student's record. They send everything themselves: mail opens
 * in their own mail app, the call is their phone, LinkedIn is their click.
 */

import { el, mount } from "../dom.js?v=022c412-202610100125";
import { btn, copy, toast, field } from "../ui.js?v=022c412-202610100125";
import { createModal } from "../modal.js?v=022c412-202610100125";
import { DAY0, FOLLOWUP_DAYS, nextTouch, fillLinks, peopleLinks } from "../search.js?v=022c412-202610100125";
import { draftCampaign } from "../roles-remote.js?v=022c412-202610100125";

export function createCampaignDrawer({ slug, getTarget, onPatch, onTouch, getPortfolio, readOnly = () => false }) {
  const modal = createModal({ label: "Target campaign", size: "reading", onClose: () => close() });
  function close() {
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
        const result = await draftCampaign(slug, target.roleKey ? { roleKey: target.roleKey, insider: target.insider, portfolio: getPortfolio() } : { role: { company: target.company, title: target.role, url: target.link, description: target.why }, insider: target.insider, portfolio: getPortfolio() });
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
        : btn({ label: "Sent", variant: "solid", onclick: () => onTouch(target.id, channel, { kind: "warm", company: target.company, role: target.role, contact: target.contact?.name || "", note: label, ...entry }) });

    const head = el(
      "header.pack__head",
      {},
      el("b.eyebrow", {}, "Target"),
      el("h1.pack__title", {}, target.company),
      el("p.pack__where", {}, [target.role, c?.size, nextTouch(target)].filter(Boolean).join(" · "))
    );

    const blocks = [];
    if (!c) {
      blocks.push(el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, drafting ? "Writing the campaign around what this company needs owned. About a minute." : "No campaign yet.")));
    } else {
      blocks.push(
        section("What they need owned", null, el("div", {}, el("p.pack__fit", {}, c.problem), c.trust.length ? el("div.pack__gaps", {}, el("b", {}, "Why you're trusted with it"), el("ul", {}, c.trust.map((t) => el("li", {}, t)))) : null, c.words.length ? el("div.pack__chips.camp__words", {}, c.words.map((w) => el("span.chip2", {}, w))) : null))
      );

      // Who: the contact the student fills in as they find them.
      const cName = field({ label: "Hiring manager", id: `cp-name-${target.id}`, value: target.contact?.name ?? "" });
      const cEmail = field({ label: "Their email", id: `cp-email-${target.id}`, type: "email", value: target.contact?.email ?? "" });
      const cPhone = field({ label: "Company phone", id: `cp-phone-${target.id}`, type: "tel", value: target.contact?.phone ?? "" });
      const cLinked = field({ label: "Their LinkedIn", id: `cp-li-${target.id}`, value: target.contact?.linkedin ?? "" });
      const saveContact = btn({ label: "Save contact", variant: "ghost", onclick: () => onPatch(target.id, { contact: { name: cName.input.value.trim(), email: cEmail.input.value.trim(), phone: cPhone.input.value.trim(), linkedin: cLinked.input.value.trim() } }) });
      if (ro) [cName, cEmail, cPhone, cLinked].forEach((f) => (f.input.disabled = true));
      blocks.push(
        section(
          "Who",
          null,
          el(
            "div",
            {},
            el("div.camp__grid", {}, cName.node, cEmail.node, cPhone.node, cLinked.node),
            ro ? null : el("div.row", {}, saveContact),
            el("div.pack__links", {}, peopleLinks(target.company).map((l) => el("a.pack__link", { href: l.href, target: "_blank", rel: "noopener" }, `${l.label} ↗`)), el("a.pack__link", { href: `https://www.google.com/search?q=${encodeURIComponent(`${target.company} careers contact phone`)}`, target: "_blank", rel: "noopener" }, "Their phone and site ↗")),
            el("p.pack__hint", {}, "HN posts often include the founder's email. You open these and pick the person yourself.")
          )
        )
      );

      // Loom first: the email links to it.
      const loomUrl = field({ label: "Your Loom link", id: `cp-loom-${target.id}`, type: "url", value: target.loomUrl ?? "", placeholder: "https://www.loom.com/share/…" });
      if (ro) loomUrl.input.disabled = true;
      blocks.push(
        section(
          "The Loom (60 to 90 seconds)",
          c.loom.map((b) => `${b.t} ${b.say}`).join("\n\n"),
          el(
            "div",
            {},
            el("ol.camp__beats", {}, c.loom.map((b) => el("li", {}, el("span.camp__t", {}, b.t), el("span", {}, b.say)))),
            el("p.pack__hint", {}, "Say it in your own words, camera on, screen showing the proof. One take is fine."),
            el("div.row.camp__loom", {}, btn({ label: "Record on Loom ↗", variant: "ghost", href: "https://www.loom.com/", target: "_blank" }), loomUrl.node, ro ? null : btn({ label: "Save link", variant: "quiet", onclick: () => onPatch(target.id, { loomUrl: loomUrl.input.value.trim() }) }))
          )
        )
      );

      const body = fillLinks(c.email.body, links);
      const mailto = `mailto:${encodeURIComponent(target.contact?.email ?? "")}?subject=${encodeURIComponent(c.email.subject)}&body=${encodeURIComponent(body)}`;
      blocks.push(
        section(
          "Email",
          `${c.email.subject}\n\n${body}`,
          el(
            "div",
            {},
            el("p.camp__subject", {}, c.email.subject),
            el("p.pack__text", {}, body),
            !target.loomUrl ? el("p.pack__warn", {}, "Record the Loom and save its link first; it goes into this email.") : null,
            el("div.row", {}, btn({ label: "Open in my mail", variant: "ghost", href: mailto }), markSent("email", "Email + Loom"), sentChip("email"))
          )
        )
      );

      const liSearch = peopleLinks(target.company)[0]?.href;
      blocks.push(
        section(
          "LinkedIn request",
          c.linkedin,
          el("div", {}, el("p.pack__text", {}, c.linkedin), el("div.row", {}, target.contact?.linkedin ? btn({ label: "Their profile ↗", variant: "ghost", href: /^https?:/.test(target.contact.linkedin) ? target.contact.linkedin : `https://${target.contact.linkedin}`, target: "_blank" }) : liSearch ? btn({ label: "Find them ↗", variant: "ghost", href: liSearch, target: "_blank" }) : null, markSent("linkedin", "LinkedIn request"), sentChip("linkedin")))
        )
      );

      blocks.push(
        section(
          "Call",
          `To whoever answers: ${c.call.gatekeeper}\n\nIf you reach the hiring manager: ${c.call.manager}\n\nVoicemail: ${c.call.voicemail}`,
          el(
            "div.camp__call",
            {},
            el("div", {}, el("b", {}, "Whoever answers"), el("p", {}, c.call.gatekeeper)),
            el("div", {}, el("b", {}, "The hiring manager"), el("p", {}, c.call.manager)),
            el("div", {}, el("b", {}, "Voicemail"), el("p", {}, c.call.voicemail)),
            el("div.row", {}, target.contact?.phone ? btn({ label: `Call ${target.contact.phone}`, variant: "ghost", href: `tel:${target.contact.phone.replace(/[^\d+]/g, "")}` }) : null, markSent("call", "Call"), sentChip("call"))
          )
        )
      );

      for (const f of c.followups) {
        const key = `d${FOLLOWUP_DAYS.includes(f.day) ? f.day : FOLLOWUP_DAYS[Math.min(2, c.followups.indexOf(f))]}`;
        const text = fillLinks(f.text, links);
        blocks.push(section(`Day ${key.slice(1)} · ${f.channel}`, text, el("div", {}, el("p.pack__text", {}, text), el("div.row", {}, markSent(key, `Day ${key.slice(1)} follow-up`), sentChip(key)))));
      }
    }

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
    const content = el("div.pack", {}, head, el("div.pack__body", {}, blocks), foot);
    // Already showing: swap the content in place so a Sent halfway down doesn't jump to the top.
    if (!modal.layer.hidden && !modal.layer.classList.contains("is-closing")) mount(modal.panel.querySelector(".modal__body"), content);
    else modal.setOpen(true, { content });
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
