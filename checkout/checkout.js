/**
 * checkout/: every plan button on the site lands here. Three choices (plan, how you pay, who it's for),
 * the exact terms for that combination next to the button, then Stripe's own Payment Link.
 * The rules and words are order.mjs; the links are config.js LINKS; the funnel counts checkout.view
 * and checkout.start (server/events.py).
 */

import { PERSIST, link } from "../config.js?v=89ee485-202610270204";
import { track, visitorId } from "../check/events.js?v=89ee485-202610270204";
import { MONEY, PLANS, order, payUrl, readParams } from "./order.mjs?v=89ee485-202610270204";

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

function option(group, value, { title, price = "", detail = "", checked = false, disabled = false }) {
  const label = document.createElement("label");
  label.className = `co__option${disabled ? " is-off" : ""}`;
  label.innerHTML = `<input type="radio" name="${group}" value="${value}"><span class="co__option-body"><b></b><span class="co__price"></span><small></small></span>`;
  const input = label.querySelector("input");
  input.checked = checked;
  input.disabled = disabled;
  label.querySelector("b").textContent = title;
  label.querySelector(".co__price").textContent = price;
  label.querySelector("small").textContent = detail;
  input.addEventListener("change", () => {
    state[group] = group === "gift" ? value === "gift" : value;
    render();
  });
  return label;
}

function render() {
  const o = order(state);
  state.billing = o.billing;
  const spec = PLANS[o.plan];

  $("plans").replaceChildren(
    ...Object.entries(PLANS).map(([key, plan]) =>
      option("plan", key, { title: plan.name, price: plan.billing.once.price, detail: plan.tag, checked: key === o.plan })
    )
  );
  $("billing").replaceChildren(
    ...Object.entries(spec.billing).map(([key, choice]) =>
      option("billing", key, {
        title: choice.label,
        price: choice.price,
        detail: choice.detail,
        checked: key === o.billing,
        disabled: o.gift && !choice.giftKey,
      })
    )
  );
  const note = $("billing-note");
  note.hidden = !(o.gift && o.plan === "complete");
  note.textContent = "A gift is paid once, up front, so the free trial is only for buying it for yourself.";
  $("whom").replaceChildren(
    option("gift", "me", { title: "Me", detail: "Your own map and seat", checked: !o.gift }),
    option("gift", "gift", { title: "Someone else, as a gift", detail: "They accept it from their own email", checked: o.gift })
  );

  $("summary-name").textContent = o.gift ? `${spec.name}, as a gift` : spec.name;
  $("summary-tag").textContent = spec.tag;
  $("summary-line").textContent = spec.line;
  $("summary-items").replaceChildren(...spec.items.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
  $("summary-due").textContent = o.due;
  $("summary-terms").textContent = o.terms;
  $("summary-next").replaceChildren(...o.next.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
  $("money").textContent = MONEY;

  // A gift is paid by someone else, so their own email goes in at Stripe, not the seat's.
  const url = payUrl(link(o.linkKey), { ck: state.ck, visitor: visitorId(), email: o.gift ? "" : state.email });
  const pay = $("pay");
  pay.hidden = !url;
  $("closed").hidden = Boolean(url);
  if (url) {
    pay.href = url;
    pay.firstChild.textContent = `${o.billing === "monthly" && o.plan === "complete" && !o.gift ? "Start my free week" : "Continue to secure checkout"} `;
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

$("pay").addEventListener("click", () => {
  const o = order(state);
  track(PERSIST.endpoint, "checkout.start", { source: state.from, check: state.ck, props: { plan: `${o.plan}.${o.billing}${o.gift ? ".gift" : ""}` } });
});

render();
track(PERSIST.endpoint, "checkout.view", { source: state.from, check: state.ck, props: { plan: state.plan } });
