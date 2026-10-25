/**
 * checkout/: what someone is buying, from three choices: the plan, how they pay, and whether it's a gift.
 * Pure, so the words and the link behind every combination are tested (order.test.mjs), and the prices are
 * checked against data/intake/offer.json, which server/billing.py is checked against too.
 *
 *   order({ plan: "complete", billing: "monthly", gift: false })
 *     -> { linkKey: "completeCheckoutMonthly", due: "$0 today", terms: "...", next: [...], ... }
 *
 * A gift is always paid up front (no trial on someone else's card), so a gift of Complete is the
 * one-time price whatever billing says.
 */

export const PLANS = {
  complete: {
    name: "GridSchool Complete",
    tag: "you run it",
    line: "The whole course and the system, with the first week's work prepared for you.",
    items: [
      "Every module and every film: profile, proof, people, search, interviews and the offer",
      "Fresh roles that fit your map, who to reach on each team, and a note to each in your voice",
      "Your resume, headshot and banner, and posts drafted from your own work",
      "12 months on your map",
    ],
    billing: {
      once: { label: "Pay once", price: "$997", detail: "12 months. 14-day refund, no questions.", key: "completeCheckout", giftKey: "giftComplete" },
      monthly: { label: "Try it free for 7 days", price: "$97 a month", detail: "After 7 free days. Cancel any time; at most 12 payments.", key: "completeCheckoutMonthly", giftKey: null },
    },
  },
  residency: {
    name: "GridSchool Residency",
    tag: "I build it with you",
    line: "Aden works with you as an engineer, building the projects that make you stand out, until you sign an offer.",
    items: [
      "Everything in Complete",
      "Calls twice a week for the first 8 weeks, building your projects together",
      "Then a weekly 1:1 until you sign an offer, for up to 12 months",
      "The week-2 exit: wrong room, and unused tuition comes back",
    ],
    billing: {
      once: { label: "Pay in full", price: "$12,000", detail: "One payment. Nothing after you're hired.", key: "residencyCheckout", giftKey: "giftResidency" },
      monthly: { label: "Three payments", price: "$4,000 a month", detail: "Three monthly payments, then it stops. $12,000 in all.", key: "residencyCheckoutMonthly", giftKey: "giftResidencyMonthly" },
    },
  },
};

export const MONEY = "Prices are in US dollars and include any sales tax or VAT. Checkout shows them in your own currency.";

const TERMS = {
  "complete.once": "$997 today for 12 months of GridSchool Complete. Ask within 14 days and you get a full refund, no questions.",
  "complete.monthly": "Free for 7 days, then $97 a month until you cancel, for at most 12 payments ($1,164). We email you 3 days before the first charge. Cancel any time online.",
  "residency.once": "$12,000 today. One fixed price: nothing hourly, nothing after you're hired. The week-2 exit: if it's the wrong room by the end of week 2, unused tuition comes back.",
  "residency.monthly": "$4,000 today, then $4,000 on the same day for the next two months, then it stops ($12,000 in all). The week-2 exit: if it's the wrong room by the end of week 2, unused tuition comes back and the later payments are cancelled.",
};

const DUE = { "complete.once": "$997 today", "complete.monthly": "$0 today", "residency.once": "$12,000 today", "residency.monthly": "$4,000 today" };

const NEXT = {
  complete: [
    "Stripe takes the payment on its own secure page.",
    "You land back here, signed in, with your map and the whole course open.",
    "Aden reviews your map within a day and starts on your first week's work.",
  ],
  residency: [
    "Stripe takes the payment on its own secure page.",
    "You book your kickoff call; that's where we pick the first project we build.",
    "Aden sets up your board and sends your sign-in before the call.",
  ],
  gift: [
    "Stripe takes the payment, and asks for their first name and email.",
    "They get an email to accept it. Nothing starts until they do; if they decline, you're refunded in full.",
    "When they accept, they choose whether you get a short weekly progress note.",
  ],
};

const GIFT_TERMS = "A gift is paid up front; nothing renews on your card. If they don't accept it, you're refunded in full.";

export function order({ plan = "complete", billing = "once", gift = false } = {}) {
  const planKey = PLANS[plan] ? plan : "complete";
  const spec = PLANS[planKey];
  // No trial on a gift: someone else's card, someone else's choice.
  const billingKey = spec.billing[billing] && !(gift && !spec.billing[billing].giftKey) ? billing : "once";
  const choice = spec.billing[billingKey];
  const id = `${planKey}.${billingKey}`;
  return {
    plan: planKey,
    billing: billingKey,
    gift: Boolean(gift),
    name: spec.name,
    linkKey: gift ? choice.giftKey : choice.key,
    due: DUE[id],
    terms: gift ? `${TERMS[id].replace(/ Ask within 14 days.*$/, "")} ${GIFT_TERMS}`.trim() : TERMS[id],
    next: gift ? NEXT.gift : NEXT[planKey],
    trialOffered: Boolean(spec.billing.monthly && planKey === "complete" && !gift),
  };
}

/** The choices a link can preselect: ?plan=residency&billing=monthly&gift=1&ck=ck_…&from=watch */
export function readParams(search) {
  const params = new URLSearchParams(search);
  const plan = PLANS[params.get("plan")] ? params.get("plan") : "complete";
  const billing = params.get("billing") === "monthly" ? "monthly" : "once";
  const ck = /^ck_[A-Za-z0-9_-]{16,40}$/.test(params.get("ck") || "") ? params.get("ck") : "";
  const from = String(params.get("from") || "").replace(/[^\w:.-]/g, "").slice(0, 60);
  return { plan, billing, gift: params.get("gift") === "1", ck, from };
}

/**
 * The Stripe link with who's paying attached: the saved check (ck_…) so the payment builds that map, or the
 * visitor's id (v_…) so the payment joins this visit on the funnel. Null when the link isn't real yet.
 */
export function payUrl(link, { ck = "", visitor = "", email = "" } = {}) {
  if (!link) return null;
  let url;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const ref = ck || (/^v_[A-Za-z0-9_-]{8,40}$/.test(visitor) ? visitor : "");
  if (ref) url.searchParams.set("client_reference_id", ref);
  if (email && /^\S+@\S+\.\S+$/.test(email)) url.searchParams.set("prefilled_email", email);
  return url.toString();
}
