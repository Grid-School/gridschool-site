/**
 * The profile sheet. Who you are here, what you are enrolled in, and the
 * doors a member is owed: your data (export), the terms you agreed to, the
 * privacy notice, the room (Discord), and the way out (sign out).
 *
 * No billing UI on purpose: the terms say one payment through the checkout
 * partner and no subscription, so the receipt lives in the partner's email
 * and this sheet says so rather than pretending to a ledger it does not hold.
 */

import { el } from "./dom.js";
import { btn, kv } from "./ui.js";
import { createModal } from "./modal.js";
import { icon } from "./icons.js";
import { link } from "../../config.js";
import { returnedUnread } from "./tasks.js";
import { initials } from "./rail.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function createProfile({ getState, onExport, onReset, onSignOut, onNavigate }) {
  const modal = createModal({ label: "Your profile", size: "sheet", onClose: () => modal.setOpen(false) });

  function open(origin = null) {
    modal.setOpen(true, { content: sheet(getState()), origin });
  }

  function act(fn) {
    return () => {
      modal.setOpen(false);
      fn();
    };
  }

  function sheet(state) {
    const { student, cohort, slug } = state;
    const demo = slug === "demo";
    const unread = returnedUnread(student).length;
    const discord = link("discord");

    return el(
      "div.profile",
      {},
      el(
        "header.profile__head",
        {},
        el("span.profile__avatar", { "aria-hidden": "true" }, initials(student.name)),
        el("div", {}, el("h2.profile__name", {}, student.name), el("p.profile__sub", {}, `${cohort.name} · week ${Math.min(state.week, cohort.weeks)}`))
      ),

      el(
        "section.profile__block",
        {},
        el("b.eyebrow", {}, "Enrollment"),
        kv("Status", demo ? "Demo board. Nothing here is a real account." : `Enrolled · since ${student.joined ?? "day one"}`),
        kv("Residency", clockLine(student.clock)),
        kv("Your 1:1", oneOnOneLine(student.oneone)),
        kv("Payment", demo ? "None. This board is a public tour." : "One payment at checkout. Your receipt came from the checkout partner by email; there is no subscription."),
        kv("Reviews", unread ? `${unread} came back and ${unread === 1 ? "is" : "are"} unread` : "Nothing waiting on you")
      ),

      el(
        "section.profile__block",
        {},
        el("b.eyebrow", {}, "Your data"),
        el("p.profile__note", {}, "Everything on your board, as one file you own. Links, checkboxes, notes, reviews."),
        el(
          "div.profile__acts",
          {},
          btn({ label: "Export my data", variant: "quiet", onclick: act(onExport) }),
          demo && state.hasLocalEdits && btn({ label: "Reset demo", variant: "quiet", onclick: act(onReset) })
        )
      ),

      el(
        "section.profile__block",
        {},
        el("b.eyebrow", {}, "Links"),
        el(
          "nav.profile__links",
          { "aria-label": "Program links" },
          door("Discord", discord, "The room between calls"),
          door("Terms", "../terms/", "What you bought, in plain words"),
          door("Privacy", "../privacy/", "What is stored and where")
        )
      ),

      el(
        "footer.profile__foot",
        {},
        btn({ label: "Sign out", variant: "quiet", onclick: act(onSignOut) }),
        el("span.profile__hint", {}, "Signing out forgets the access key on this device.")
      )
    );
  }

  function door(label, href, note, onclick) {
    const external = href && /^https?:/.test(href);
    const missing = href === null && !onclick;
    if (missing) return el("span.profile__door.is-off", {}, el("b", {}, label), el("span", {}, "not connected yet"));
    const body = [el("b", {}, label, external ? icon("external") : null), el("span", {}, note)];
    if (!href) {
      return el("button.profile__door", { type: "button", onclick: act(onclick) }, ...body);
    }
    return el("a.profile__door", { href, target: external ? "_blank" : null, rel: external ? "noopener" : null }, ...body);
  }

  return { layer: modal.layer, open, close: () => modal.setOpen(false), isOpen: modal.isOpen };
}

function clockLine(clock) {
  if (!clock) return "Twelve months. Nothing on the map expires.";
  const months = clock.months ?? 12;
  return `${months} months, ${clock.kind === "get-in" ? "get in, then stay as long as you ship" : clock.kind}. Nothing on the map expires.`;
}

function oneOnOneLine(oneone) {
  if (!oneone) return "Set on your first call";
  const day = DAYS[oneone.weekday] ?? "";
  return `${day} ${oneone.time ?? ""}`.trim() || "Set on your first call";
}
