/**
 * checkout/: what someone is buying, one question at a time: who it's for, then the plan, then how they pay.
 * Pure, so the words and the link behind every combination are tested (order.test.mjs), and the prices are
 * checked against data/intake/offer.json, which server/billing.py is checked against too.
 *
 *   order({ plan: "complete", billing: "monthly", gift: false })
 *     -> { linkKey: "completeCheckoutMonthly", due: "$0 today", terms: "...", next: [...], ... }
 *   summary(order(...), today) -> { line: "Today: $0. Then $97/month from November 3.", button: "Start my 7 days free" }
 *
 * One price on screen at a time, and it is the one the button charges. A gift never has a trial (someone
 * else's card, someone else's choice): a gift of Complete is $97 a month billed to the giver from today, or
 * $997 once. Complete is the main card and monthly its default; the Residency is a quieter row above it that
 * points to a conversation, and becomes the card only when a link asks for it (?plan=residency, from residency/).
 */

export const PLANS = {
  complete: {
    name: "GridSchool Complete",
    tag: "most choose this",
    line: "The same system, run by you with your AI coach.",
    items: [
      "Every module and every film: profile, proof, people, search, interviews and the offer",
      "Fresh roles that fit your map, who to reach on each team, and a note to each in your voice",
      "Your resume, headshot and banner, and posts drafted from your own work",
      "12 months on your map",
    ],
    // Monthly first: it is the default, and the toggle lists it first.
    billing: {
      monthly: {
        title: "$97 a month", price: "$97 a month",
        detail: "7 days free, then $97. Cancel any time. Up to 12 payments.",
        giftDetail: "Billed to you monthly. Cancel any time. Up to 12 payments.",
        key: "completeCheckoutMonthly", giftKey: "giftCompleteMonthly",
      },
      once: { title: "$997 once", price: "$997", detail: "Pay once for 12 months. Save $167.", key: "completeCheckout", giftKey: "giftComplete" },
    },
  },
  residency: {
    name: "GridSchool Residency",
    tag: "built with your coach",
    price: "$12,000",
    line: "Your coach builds it with you, every week.",
    items: [
      "Everything in Complete",
      "Calls twice a week for the first 8 weeks, building your projects together",
      "Then a weekly 1:1 until you sign an offer, for up to 12 months",
      "The week-2 exit: wrong room, and unused tuition comes back",
    ],
    billing: {
      once: { title: "$12,000 once", price: "$12,000", detail: "One payment. The week-2 exit: unused tuition comes back.", key: "residencyCheckout", giftKey: "giftResidency" },
      monthly: { title: "$4,000 a month", price: "$4,000 a month", detail: "3 payments, then it stops. $12,000 in all.", key: "residencyCheckoutMonthly", giftKey: "giftResidencyMonthly" },
    },
  },
};

/** Where the Residency row's "Talk to us" goes: the Residency page, with its call. */
export const RESIDENCY_TALK = "../residency/";
const DEFAULT_BILLING = { complete: "monthly", residency: "once" };

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
    "Your coach reviews your map within a day and starts on your first week's work.",
  ],
  residency: [
    "Stripe takes the payment on its own secure page.",
    "You book your kickoff call; that's where we pick the first project we build.",
    "Your coach sets up your board and sends your sign-in before the call.",
  ],
  gift: [
    "Stripe takes the payment, and asks for their first name and email.",
    "They get an email to accept it. Nothing starts until they do; if they decline, you're refunded in full.",
    "When they accept, they choose whether you get a short weekly progress note.",
  ],
};

const GIFT_TERMS = "A gift is paid up front; nothing renews on your card. If they don't accept it, you're refunded in full.";
// A gift paid monthly: the giver's card, from today, with no trial.
const GIFT_MONTHLY_TERMS = {
  "complete.monthly": "$97 today, then $97 a month for at most 12 payments ($1,164), then it stops. It's billed to you; they're never charged. Cancel any time online. If they don't accept it, we cancel it and refund every payment.",
  "residency.monthly": `${TERMS["residency.monthly"]} It's billed to you; they're never charged. If they don't accept it, the later payments are cancelled and you're refunded in full.`,
};
const GIFT_DUE = { "complete.monthly": "$97 today" };

/** A billing toggle's title and the line under it, as a gift or not (checkout.js draws the toggle with these). */
export function optionWords(choice, gift) {
  return { title: choice.title, detail: (gift && choice.giftDetail) || choice.detail };
}

export function order({ plan = "complete", billing = "", gift = false } = {}) {
  const planKey = PLANS[plan] ? plan : "complete";
  const spec = PLANS[planKey];
  const wanted = spec.billing[billing] ? billing : DEFAULT_BILLING[planKey];
  // A choice with no gift link (none today) falls back to paying once when it's a gift.
  const billingKey = gift && !spec.billing[wanted].giftKey ? "once" : wanted;
  const choice = spec.billing[billingKey];
  const id = `${planKey}.${billingKey}`;
  const giftTerms = GIFT_MONTHLY_TERMS[id] || `${TERMS[id].replace(/ Ask within 14 days.*$/, "")} ${GIFT_TERMS}`.trim();
  return {
    plan: planKey,
    billing: billingKey,
    gift: Boolean(gift),
    name: spec.name,
    linkKey: gift ? choice.giftKey : choice.key,
    due: (gift && GIFT_DUE[id]) || DUE[id],
    terms: gift ? giftTerms : TERMS[id],
    next: gift ? NEXT.gift : NEXT[planKey],
    trialOffered: Boolean(spec.billing.monthly && planKey === "complete" && !gift),
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const GIFT_LINE = "They get an email to accept. Refunded in full if they don't.";

/**
 * The one line that says exactly what is charged, and the button's words, for an order().
 * today is the buyer's own clock: the trial's first charge is 7 days from it, in their time zone.
 */
export function summary(o, today = new Date(), sendOn = "") {
  const due = o.due.replace(/ today$/, "");
  const day = o.gift ? dayWords(sendOn) : "";
  if (day) return { line: `Today: ${due}. We email them on ${day} to accept. Refunded in full if they don't.`, button: "Send the gift" };
  if (o.gift) return { line: `Today: ${due}. ${GIFT_LINE}`, button: "Send the gift" };
  if (o.trialOffered && o.billing === "monthly") {
    const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
    return { line: `Today: $0. Then $97/month from ${MONTHS[first.getMonth()]} ${first.getDate()}.`, button: "Start my 7 days free" };
  }
  if (o.plan === "residency" && o.billing === "monthly") {
    return { line: `Today: ${due}. Then ${due} a month for 2 more months, then it stops.`, button: `Pay ${due}` };
  }
  return { line: `Today: ${due}.`, button: `Pay ${due}` };
}

/** "June 6" for a YYYY-MM-DD the date box gave, or "" (the server checks the range again: gifts.read_send_on). */
export function dayWords(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}` : "";
}

/** The date box's range: tomorrow (empty means send it right away) to a year out, in the buyer's own calendar. */
export function sendOnRange(today = new Date()) {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { min: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)), max: iso(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())) };
}

/** The choices a link can preselect: ?plan=residency&billing=monthly&gift=1&ck=ck_…&from=watch. No billing: the plan's default. */
export function readParams(search) {
  const params = new URLSearchParams(search);
  const plan = PLANS[params.get("plan")] ? params.get("plan") : "complete";
  const asked = params.get("billing");
  const billing = asked === "monthly" || asked === "once" ? asked : DEFAULT_BILLING[plan];
  const ck = /^ck_[A-Za-z0-9_-]{16,40}$/.test(params.get("ck") || "") ? params.get("ck") : "";
  const from = String(params.get("from") || "").replace(/[^\w:.-]/g, "").slice(0, 60);
  return { plan, billing, gift: params.get("gift") === "1", ck, from };
}

/**
 * The Stripe link with who's paying attached: the saved check (ck_…) so the payment builds that map, or the
 * visitor's id (v_…) so the payment joins this visit on the funnel. Null when the link isn't real yet.
 */
export function payUrl(link, { ck = "", visitor = "", email = "", intent = "" } = {}) {
  if (!link) return null;
  let url;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  // A gift with a chosen day: the saved intent (gi_…, server gifts_api.intent) carries the day and the visitor.
  const saved = /^gi_[A-Za-z0-9_-]{16,40}$/.test(intent) ? intent : "";
  const ref = ck || saved || (/^v_[A-Za-z0-9_-]{8,40}$/.test(visitor) ? visitor : "");
  if (ref) url.searchParams.set("client_reference_id", ref);
  if (email && /^\S+@\S+\.\S+$/.test(email)) url.searchParams.set("prefilled_email", email);
  return url.toString();
}

export const DAY_NOT_SAVED = "We couldn't save the day. Try again, or leave it empty to send it right away.";

/**
 * What POST /gift/intent answered, or an Error with words to show. The day must come back as it was chosen:
 * a day the server didn't keep would send the gift at once, which is not what the giver picked.
 */
export function savedDay(ok, data, asked) {
  const body = data && typeof data === "object" ? data : {};
  if (!ok || !body.id) throw new Error(body.error || DAY_NOT_SAVED);
  if (asked && body.send_on !== asked) throw new Error(DAY_NOT_SAVED);
  return body;
}

/**
 * POST /gift/intent with a timeout, answering like savedDay. A network failure or the timeout says DAY_NOT_SAVED,
 * never the browser's own "Failed to fetch". AbortController and a timer, not AbortSignal.timeout (older Safari).
 */
export async function saveIntent(fetchImpl, endpoint, { sendOn, visitor }, { timeout = 8000, timers = globalThis } = {}) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? timers.setTimeout(() => controller.abort(), timeout) : null;
  try {
    let res;
    try {
      res = await fetchImpl(`${endpoint}/gift/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send_on: sendOn, visitor }),
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch {
      throw new Error(DAY_NOT_SAVED);
    }
    const data = await res.json().catch(() => ({}));
    return savedDay(res.ok, data, sendOn);
  } finally {
    if (timer !== null) timers.clearTimeout(timer);
  }
}

/** The pay button's href: "#" while a gift waits on a chosen day, so nothing (a middle-click, a copied link) skips saving it. */
export function payHref(url, { gift = false, sendOn = "" } = {}) {
  return gift && sendOn ? "#" : url;
}
