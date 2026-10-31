/**
 * checkout/: every plan button on the site lands here. One question at a time: who it's for, then the plan
 * (Complete is the card, with its own once/monthly toggle; the Residency is a quieter row that points to a
 * conversation), then one line that says exactly what today's charge is, and a button that says the same.
 * Then Stripe's own Payment Link. The rules and words are order.mjs; the links are config.js LINKS; the
 * funnel counts checkout.view and checkout.start (server/events.py).
 */

import { PERSIST, link } from "../config.js?v=fc7db25-202610310827";
import { markPaying } from "../check/account.js?v=fc7db25-202610310827";
import { track, visitorId } from "../check/events.js?v=fc7db25-202610310827";
import { DAY_NOT_SAVED, MONEY, PLANS, RESIDENCY_TALK, optionWords, order, payHref, payUrl, readParams, saveIntent, sendOnRange, summary } from "./order.mjs?v=fc7db25-202610310827";

const $ = (id) => document.getElementById(id);
const state = readParams(location.search);
// From the in-map offer: the free seat's account email, so the payment upgrades that seat (check/check.js).
// Read once from this tab's session storage; never from the address.
state.email = (() => {
  try {
    const email = sessionStorage.getItem("gridschool.checkout.email") || "";
    sessionStorage.removeItem("gridschool.checkout.email");
    return email;
  } catch {
    return "";
  }
})();

const el = (tag, className = "", text = "") => Object.assign(document.createElement(tag), { className, textContent: text });

/** A radio drawn as one half of a two-way switch. */
function segment(name, value, { title, detail = "", checked, onPick }) {
  const label = el("label", "co__seg-option");
  const input = Object.assign(document.createElement("input"), { type: "radio", name, value, checked });
  input.addEventListener("change", () => {
    onPick();
    // render() redraws the options: keep the keyboard where it was.
    document.querySelector(`input[name="${name}"][value="${value}"]`)?.focus();
  });
  const body = el("span", "co__seg-body");
  body.append(el("b", "", title));
  if (detail) body.append(el("small", "", detail));
  label.append(input, body);
  return label;
}

/** The chosen plan: its name, its line, how to pay for it, and what's in it. */
function planCard(key, o) {
  const spec = PLANS[key];
  const card = el("article", "co__plan is-on");
  const bar = el("div", "plan__bar eyebrow");
  bar.append(el("span", "", spec.name), el("span", "tag", spec.tag));
  const toggle = el("div", "co__seg co__seg--pay");
  toggle.setAttribute("role", "radiogroup");
  toggle.setAttribute("aria-label", "How you pay");
  for (const [billing, choice] of Object.entries(spec.billing)) {
    if (o.gift && !choice.giftKey) continue;
    toggle.append(segment("billing", billing, {
      ...optionWords(choice, o.gift),
      checked: billing === o.billing,
      onPick: () => {
        state.billing = billing;
        render();
      },
    }));
  }
  const items = el("ul", "plan__list co__items");
  items.append(...spec.items.map((text) => el("li", "", text)));
  card.append(bar, el("p", "co__line", spec.line), toggle, items);
  return card;
}

/** The plan not chosen, as one quiet row. The Residency points to a conversation, never a pay button. */
function planRow(key) {
  const spec = PLANS[key];
  const row = el("article", "co__plan co__plan--row");
  const text = el("div", "co__row-text");
  const head = el("p", "co__row-head");
  head.append(el("b", "", spec.name), el("span", "co__row-price", key === "residency" ? spec.price : spec.billing.monthly.price));
  text.append(head, el("p", "co__row-line", spec.line));
  let action;
  if (key === "residency") {
    action = Object.assign(el("a", "plan__alt co__row-act", "Talk to us"), { href: RESIDENCY_TALK });
  } else {
    action = Object.assign(el("button", "plan__alt co__row-act", `Choose ${spec.name.replace("GridSchool ", "")} instead`), { type: "button" });
    action.addEventListener("click", () => {
      state.plan = key;
      state.billing = "";
      render();
    });
  }
  row.append(text, action);
  return row;
}

function render() {
  const o = order(state);
  state.billing = o.billing;

  $("whom").replaceChildren(
    segment("gift", "me", { title: "For me", checked: !o.gift, onPick: () => ((state.gift = false), render()) }),
    segment("gift", "gift", { title: "A gift for someone", checked: o.gift, onPick: () => ((state.gift = true), render()) })
  );
  // The Residency sits above Complete either way: a row when Complete is chosen, the card when a link asked for it.
  $("plans").replaceChildren(
    o.plan === "residency" ? planCard("residency", o) : planRow("residency"),
    o.plan === "complete" ? planCard("complete", o) : planRow("complete")
  );

  // A gift can wait for a chosen day (graduation day): only shown, and only sent, for a gift.
  $("when").hidden = !o.gift;
  const words = summary(o, new Date(), o.gift ? state.sendOn : "");
  $("summary-line").textContent = words.line;
  $("summary-terms").textContent = o.terms;
  $("summary-next").replaceChildren(...o.next.map((text) => el("li", "", text)));
  $("money").textContent = MONEY;

  // A gift is paid by someone else, so their own email goes in at Stripe, not the seat's.
  const url = payUrl(link(o.linkKey), { ck: state.ck, visitor: visitorId(), email: o.gift ? "" : state.email });
  const pay = $("pay");
  pay.hidden = !url;
  $("closed").hidden = Boolean(url);
  if (url) {
    pay.href = payHref(url, { gift: o.gift, sendOn: state.sendOn });
    pay.firstChild.textContent = `${words.button} `;
  } else {
    $("closed-mail").href = `mailto:support@gridschool.org?subject=${encodeURIComponent(`${o.name}${o.gift ? " (gift)" : ""}, ${o.billing === "monthly" ? "monthly" : "paid once"}`)}`;
  }
  // Keep the address in step, so a refresh or a shared link opens the same choices.
  const params = new URLSearchParams(location.search);
  params.set("plan", o.plan);
  params.set("billing", o.billing);
  if (o.gift) params.set("gift", "1");
  else params.delete("gift");
  history.replaceState(null, "", `?${params}`);
}

state.sendOn = "";
const range = sendOnRange();
Object.assign($("send-on"), { min: range.min, max: range.max });
$("send-on").addEventListener("input", (event) => {
  state.sendOn = event.target.value;
  render();
});

/** Save the chosen day first (Stripe's fields can't hold a date); the intent's id goes to Stripe instead of the visitor's. */
function saveDay() {
  return saveIntent((url, init) => fetch(url, init), PERSIST.endpoint, { sendOn: state.sendOn, visitor: visitorId() });
}

// The choices are a form only for its fieldsets: Enter in the date box must not reload the page as a plain GET
// (which would drop the gift and the day).
$("choices").addEventListener("submit", (event) => event.preventDefault());

$("pay").addEventListener("click", async (event) => {
  const o = order(state);
  track(PERSIST.endpoint, "checkout.start", { source: state.from, check: state.ck, props: { plan: `${o.plan}.${o.billing}${o.gift ? ".gift" : ""}` } });
  if (!o.gift || !state.sendOn) {
    try {
      sessionStorage.removeItem("gridschool.gift.sendOn");
    } catch {
      /* nothing to clear */
    }
    return;
  }
  event.preventDefault();
  const error = $("pay-error");
  error.hidden = true;
  try {
    const saved = await saveDay();
    try {
      // gift/?sent=1 says "we'll send it on <day>" when the giver comes back from Stripe.
      sessionStorage.setItem("gridschool.gift.sendOn", saved.send_on || "");
    } catch {
      /* the thank-you page just won't name the day */
    }
    location.href = payUrl(link(o.linkKey), { intent: saved.id, visitor: visitorId() });
  } catch (problem) {
    error.textContent = problem.message || DAY_NOT_SAVED;
    error.hidden = false;
  }
});

// Off to pay for Complete for themselves: begin/ and signin/ wait for this payment instead of opening the free map.
$("pay").addEventListener("click", () => {
  const o = order(state);
  if (!o.gift && o.plan === "complete") markPaying();
});

render();
track(PERSIST.endpoint, "checkout.view", { source: state.from, check: state.ck, props: { plan: state.plan } });
