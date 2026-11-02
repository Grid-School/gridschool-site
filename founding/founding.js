/**
 * founding/: the founding cohort (ops/gridschool-vision.md §6). Everyone sees what it is, the price and the terms.
 * The pay buttons show only on the link Aden sends after the family call (?pay=1) and only once the Stripe links are
 * real (ops/stripe-setup.py --write-config). ?paid=1 is where Stripe returns after a payment.
 */

import { LINKS, isPlaceholder } from "../config.js?v=b7c5890-202611020907";
import { applySiteOverrides } from "../js/site-overrides.js?v=b7c5890-202611020907";

await applySiteOverrides().catch(() => null);

const params = new URLSearchParams(location.search);
const pay = document.querySelector("[data-pay]");
const join = document.querySelector("[data-join]");
const thanks = document.querySelector("[data-paid]");

const options = [
  { key: "depositCheckout", label: "Reserve a seat, $300", note: "Fully refundable until December 28, then it counts toward the price." },
  { key: "foundingCheckout", label: "Pay in full, $3,000", note: "One payment." },
  { key: "foundingCheckoutMonthly", label: "3 payments of $1,100", note: "Monthly, then it stops." },
].filter((o) => !isPlaceholder(LINKS[o.key]));

if (params.get("paid") === "1") {
  thanks.hidden = false;
  join.hidden = true;
} else if (params.get("pay") === "1" && options.length) {
  pay.replaceChildren(
    ...options.flatMap((o, i) => {
      const a = Object.assign(document.createElement("a"), { className: i === 0 ? "btn btn--solid" : "btn btn--line", href: LINKS[o.key], textContent: o.label });
      const p = Object.assign(document.createElement("p"), { className: "sp__help", textContent: o.note });
      return [a, p];
    }),
  );
  pay.hidden = false;
  join.hidden = true;
}
