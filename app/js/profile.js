/**
 * The profile sheet. Who you are here, what you are enrolled in, and the
 * doors a member is owed: your data (export), the terms you agreed to, the
 * privacy notice, the room (Discord), and the way out (sign out).
 *
 * No billing UI on purpose: the terms say one payment through the checkout
 * partner and no subscription, so the receipt lives in the partner's email
 * and this sheet says so rather than pretending to a ledger it does not hold.
 */

import { el } from "./dom.js?v=fbad271-202610110101";
import { btn, kv } from "./ui.js?v=fbad271-202610110101";
import { createModal } from "./modal.js?v=fbad271-202610110101";
import { icon } from "./icons.js?v=fbad271-202610110101";
import { link } from "../../config.js?v=fbad271-202610110101";
import { returnedUnread } from "./tasks.js?v=fbad271-202610110101";
import { initials } from "./rail.js?v=fbad271-202610110101";
import { slotSummary } from "./call-slot.js?v=fbad271-202610110101";
import { displayZone, studentSlot } from "./time.js?v=fbad271-202610110101";


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
    const { student, slug } = state;
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
        el("div", {}, el("h2.profile__name", {}, student.name), el("p.profile__sub", {}, `Week ${state.week}`))
      ),

      el(
        "section.profile__block",
        {},
        el("b.eyebrow", {}, "Enrollment"),
        kv("Status", demo ? "Demo board. Nothing here is a real account." : `Enrolled · since ${student.joined ?? "day one"}`),
        clockLine(student.clock) && kv("Residency", clockLine(student.clock)),
        kv("Your 1:1", oneOnOneLine(state.cohort, student)),
        demo
          ? kv("Payment", "None. This board is a public tour.")
          : student.clock?.payment && kv("Payment", student.clock.payment),
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
    if (missing) {
      const note = label === "Discord"
        ? "Opens after you sign in on a paid seat"
        : "not connected yet";
      return el("span.profile__door.is-off", {}, el("b", {}, label), el("span", {}, note));
    }
    const body = [el("b", {}, label, external ? icon("external") : null), el("span", {}, note)];
    if (!href) {
      return el("button.profile__door", { type: "button", onclick: act(onclick) }, ...body);
    }
    return el("a.profile__door", { href, target: external ? "_blank" : null, rel: external ? "noopener" : null }, ...body);
  }

  return { layer: modal.layer, open, close: () => modal.setOpen(false), isOpen: modal.isOpen };
}

/**
 * The seat's own words. A seat with no clock set says nothing here rather
 * than a program default that may not be what this student bought.
 */
function clockLine(clock) {
  if (!clock || typeof clock !== "object") return null;
  if (typeof clock.text === "string" && clock.text.trim()) return clock.text.trim();
  if (!clock.weeks && !clock.months) return null;
  const after = clock.kind === "get-in" || !clock.kind ? "then I stay until you're hired" : clock.kind;
  const span = clock.weeks ? `${clock.weeks} weeks` : `${clock.months} months`;
  return `${span}, ${after}. Nothing on the map expires.`;
}

/** Same record and same math as the calendar, so the two cannot disagree. */
function oneOnOneLine(cohort, student) {
  const slot = studentSlot(cohort, student);
  if (!slot) return "Not set yet. Aden sets it after your first call.";
  return slotSummary(slot, displayZone(student));
}
