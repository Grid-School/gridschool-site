import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DAY_NOT_SAVED, PLANS, dayWords, optionWords, order, payHref, readParams, payUrl, saveIntent, savedDay, sendOnRange, summary } from "./order.mjs?v=e1b1240-202610280516";

const quiet = { setTimeout: () => 1, clearTimeout: () => {} };

test("saving the day: the server's answer, or the friendly words when the network fails or times out", async () => {
  let seen;
  const ok = async (url, init) => ((seen = { url, init }), { ok: true, json: async () => ({ id: "gi_x", send_on: "2026-11-01" }) });
  assert.deepEqual(await saveIntent(ok, "https://lab", { sendOn: "2026-11-01", visitor: "v_12345678" }, { timers: quiet }), { id: "gi_x", send_on: "2026-11-01" });
  assert.equal(seen.url, "https://lab/gift/intent");
  assert.deepEqual(JSON.parse(seen.init.body), { send_on: "2026-11-01", visitor: "v_12345678" });
  assert.ok(seen.init.signal, "a timeout signal, from AbortController");
  const offline = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(saveIntent(offline, "https://lab", { sendOn: "2026-11-01" }, { timers: quiet }), { message: DAY_NOT_SAVED });
  // The timer fires: the request is aborted and the same words show.
  const timers = { setTimeout: (fn) => (fn(), 1), clearTimeout: () => {} };
  const hangs = (url, init) => new Promise((_, reject) => (init.signal.aborted ? reject(new Error("AbortError")) : init.signal.addEventListener("abort", () => reject(new Error("AbortError")))));
  await assert.rejects(saveIntent(hangs, "https://lab", { sendOn: "2026-11-01" }, { timers }), { message: DAY_NOT_SAVED });
  const refused = async () => ({ ok: false, json: async () => ({ error: "Choose a day from today to a year from now, or leave it empty to send it right away." }) });
  await assert.rejects(saveIntent(refused, "https://lab", { sendOn: "2020-01-01" }, { timers: quiet }), /Choose a day from today/);
});

test("while a gift waits on a chosen day the pay link goes nowhere by itself", () => {
  assert.equal(payHref("https://buy.stripe.com/x", { gift: true, sendOn: "2026-11-01" }), "#");
  assert.equal(payHref("https://buy.stripe.com/x", { gift: true, sendOn: "" }), "https://buy.stripe.com/x");
  assert.equal(payHref("https://buy.stripe.com/x", { gift: false, sendOn: "2026-11-01" }), "https://buy.stripe.com/x");
});

test("checkout.js keeps Enter in the date box from reloading the page, and uses no AbortSignal.timeout", () => {
  const source = readFileSync(new URL("./checkout.js", import.meta.url), "utf8");
  assert.match(source, /\$\("choices"\)\.addEventListener\("submit", \(event\) => event\.preventDefault\(\)\)/);
  assert.doesNotMatch(source, /AbortSignal\.timeout/);
  assert.match(source, /payHref\(url/);
});

test("a chosen day the server didn't keep stops the checkout instead of sending the gift at once", () => {
  assert.deepEqual(savedDay(true, { id: "gi_x", send_on: "2026-10-28" }, "2026-10-28"), { id: "gi_x", send_on: "2026-10-28" });
  assert.deepEqual(savedDay(true, { id: "gi_x", send_on: "" }, ""), { id: "gi_x", send_on: "" });
  // The old server answered 200 with an empty day for a day it thought had passed.
  assert.throws(() => savedDay(true, { id: "gi_x", send_on: "" }, "2026-10-28"), { message: DAY_NOT_SAVED });
  assert.throws(() => savedDay(false, { error: "Choose a day from today to a year from now, or leave it empty to send it right away." }, "2026-09-01"), /Choose a day from today/);
  assert.throws(() => savedDay(false, null, "2026-10-28"), { message: DAY_NOT_SAVED });
});

test("a gift for a chosen day says so, and the day travels as a saved intent", () => {
  const today = new Date(2026, 9, 27);
  assert.deepEqual(summary(order({ plan: "complete", billing: "monthly", gift: true }), today, "2027-05-15"), {
    line: "Today: $97. We email them on May 15 to accept. Refunded in full if they don't.", button: "Send the gift",
  });
  // Only a gift waits for a day.
  assert.equal(summary(order({ plan: "complete", billing: "once" }), today, "2027-05-15").line, "Today: $997.");
  assert.equal(dayWords("nope"), "");
  assert.deepEqual(sendOnRange(today), { min: "2026-10-28", max: "2027-10-27" });
  assert.equal(payUrl("https://buy.stripe.com/x", { intent: "gi_abcdefghijklmnopqrstuv", visitor: "v_12345678" }), "https://buy.stripe.com/x?client_reference_id=gi_abcdefghijklmnopqrstuv");
  assert.equal(payUrl("https://buy.stripe.com/x", { intent: "gi_bad", visitor: "v_12345678" }), "https://buy.stripe.com/x?client_reference_id=v_12345678");
});

const OFFER = JSON.parse(readFileSync(new URL("../data/intake/offer.json", import.meta.url), "utf8"));
const dollars = (n) => `$${n.toLocaleString("en-US")}`;

test("every choice leads to its own Stripe link", () => {
  assert.equal(order({ plan: "complete", billing: "once" }).linkKey, "completeCheckout");
  assert.equal(order({ plan: "complete", billing: "monthly" }).linkKey, "completeCheckoutMonthly");
  assert.equal(order({ plan: "residency", billing: "once" }).linkKey, "residencyCheckout");
  assert.equal(order({ plan: "residency", billing: "monthly" }).linkKey, "residencyCheckoutMonthly");
  assert.equal(order({ plan: "complete", billing: "once", gift: true }).linkKey, "giftComplete");
  assert.equal(order({ plan: "complete", billing: "monthly", gift: true }).linkKey, "giftCompleteMonthly");
  assert.equal(order({ plan: "residency", gift: true }).linkKey, "giftResidency");
  assert.equal(order({ plan: "residency", billing: "monthly", gift: true }).linkKey, "giftResidencyMonthly");
});

test("a gift never starts a trial on someone else's card", () => {
  const once = order({ plan: "complete", billing: "once", gift: true });
  assert.equal(once.linkKey, "giftComplete");
  assert.equal(once.due, "$997 today");
  assert.match(once.terms, /refunded in full/);
  assert.doesNotMatch(once.terms, /14 days/);
  const monthly = order({ plan: "complete", billing: "monthly", gift: true });
  assert.equal(monthly.billing, "monthly");
  assert.equal(monthly.linkKey, "giftCompleteMonthly");
  assert.equal(monthly.due, "$97 today");
  assert.equal(monthly.trialOffered, false);
  assert.doesNotMatch(monthly.terms, /free|trial|7 days/i);
  for (const words of [/billed to you; they're never charged/, /at most 12 payments \(\$1,164\)/, /Cancel any time online/, /refund every payment/]) {
    assert.match(monthly.terms, words);
  }
  assert.equal(order({ plan: "complete" }).trialOffered, true);
});

test("the toggle's words: a free week for me, billed to the giver for a gift, and what paying once saves", () => {
  const monthly = PLANS.complete.billing.monthly;
  assert.deepEqual(optionWords(monthly, false), { title: "$97 a month", detail: "7 days free, then $97. Cancel any time. Up to 12 payments." });
  assert.deepEqual(optionWords(monthly, true), { title: "$97 a month", detail: "Billed to you monthly. Cancel any time. Up to 12 payments." });
  assert.deepEqual(optionWords(PLANS.complete.billing.once, true), { title: "$997 once", detail: "Pay once for 12 months. Save $167." });
  // $167 is what the 12 monthly payments cost over paying once.
  assert.equal(OFFER.price.monthly * OFFER.price.monthlyMax - OFFER.price.full, 167);
  // Monthly is listed first: it's the default.
  assert.deepEqual(Object.keys(PLANS.complete.billing), ["monthly", "once"]);
});

test("Complete defaults to monthly, the Residency to paying once, and a link can still ask for either", () => {
  assert.equal(order({ plan: "complete" }).billing, "monthly");
  assert.equal(order({ plan: "complete", gift: true }).linkKey, "giftCompleteMonthly");
  assert.equal(order({ plan: "residency" }).billing, "once");
  assert.equal(order({ plan: "complete", billing: "once" }).billing, "once");
  assert.equal(readParams("?plan=complete&from=home").billing, "monthly");
  assert.equal(readParams("?plan=residency&from=home").billing, "once");
  assert.equal(readParams("?plan=complete&billing=once").billing, "once");
});

test("one line says exactly what is charged today, and the button says the same", () => {
  const today = new Date(2026, 9, 27);
  assert.deepEqual(summary(order({ plan: "complete", billing: "monthly" }), today), { line: "Today: $0. Then $97/month from November 3.", button: "Start my 7 days free" });
  assert.deepEqual(summary(order({ plan: "complete", billing: "once" }), today), { line: "Today: $997.", button: "Pay $997" });
  assert.deepEqual(summary(order({ plan: "complete", billing: "monthly", gift: true }), today), { line: "Today: $97. They get an email to accept. Refunded in full if they don't.", button: "Send the gift" });
  assert.deepEqual(summary(order({ plan: "complete", billing: "once", gift: true }), today), { line: "Today: $997. They get an email to accept. Refunded in full if they don't.", button: "Send the gift" });
  assert.deepEqual(summary(order({ plan: "residency", billing: "once" }), today), { line: "Today: $12,000.", button: "Pay $12,000" });
  assert.deepEqual(summary(order({ plan: "residency", billing: "monthly" }), today), { line: "Today: $4,000. Then $4,000 a month for 2 more months, then it stops.", button: "Pay $4,000" });
  // Across a month's end, in the buyer's own calendar.
  assert.match(summary(order({ plan: "complete" }), new Date(2026, 11, 28)).line, /from January 4\.$/);
});

test("the Residency row talks first; the words never promise a job", () => {
  assert.equal(PLANS.residency.line, "Your coach builds it with you, every week.");
  assert.equal(PLANS.complete.tag, "most choose this");
  assert.equal(PLANS.complete.line, "The same system, run by you with your AI coach.");
  for (const plan of Object.values(PLANS)) {
    const words = [plan.line, plan.tag, ...plan.items, ...Object.values(plan.billing).flatMap((b) => [b.detail, b.giftDetail || ""])].join(" ");
    assert.doesNotMatch(words, /—|guarantee|\bseat\b/i);
  }
});

test("the trial's terms say what California's renewal rules ask, before they agree", () => {
  const trial = order({ plan: "complete", billing: "monthly" });
  assert.equal(trial.due, "$0 today");
  for (const words of [/Free for 7 days/, /\$97 a month until you cancel/, /at most 12 payments \(\$1,164\)/, /3 days before the first charge/, /Cancel any time online/]) {
    assert.match(trial.terms, words);
  }
});

test("prices match the offer the webhook is checked against", () => {
  assert.equal(PLANS.complete.billing.once.price, dollars(OFFER.price.full));
  assert.equal(PLANS.complete.billing.monthly.price, `${dollars(OFFER.price.monthly)} a month`);
  assert.equal(PLANS.residency.billing.once.price, dollars(OFFER.residency.full));
  assert.equal(PLANS.residency.billing.monthly.price, `${dollars(OFFER.residency.instalment)} a month`);
});

test("a link can preselect the choices, and junk falls back to the defaults", () => {
  assert.deepEqual(readParams("?plan=residency&billing=monthly&gift=1&from=watch"), { plan: "residency", billing: "monthly", gift: true, ck: "", from: "watch" });
  assert.deepEqual(readParams("?plan=nope&billing=weekly&ck=bad"), { plan: "complete", billing: "monthly", gift: false, ck: "", from: "" });
  assert.equal(readParams("?ck=ck_abcdefghijklmnop").ck, "ck_abcdefghijklmnop");
});

test("the Stripe link carries the check, or the visitor, and never a broken link", () => {
  assert.equal(payUrl("https://buy.stripe.com/x", { ck: "ck_abcdefghijklmnop", visitor: "v_12345678" }), "https://buy.stripe.com/x?client_reference_id=ck_abcdefghijklmnop");
  assert.equal(payUrl("https://buy.stripe.com/x", { visitor: "v_12345678" }), "https://buy.stripe.com/x?client_reference_id=v_12345678");
  assert.equal(payUrl("https://buy.stripe.com/x", { visitor: "nope", email: "a@b.co" }), "https://buy.stripe.com/x?prefilled_email=a%40b.co");
  assert.equal(payUrl(null), null);
  assert.equal(payUrl("REPLACE_ME"), null);
  assert.equal(payUrl("http://buy.stripe.com/x"), null);
});

test("no em dashes anywhere a buyer reads", () => {
  for (const plan of ["complete", "residency"]) {
    for (const billing of ["once", "monthly"]) {
      for (const gift of [false, true]) {
        const o = order({ plan, billing, gift });
        assert.doesNotMatch([o.terms, ...o.next].join(" "), /—/);
      }
    }
  }
});
