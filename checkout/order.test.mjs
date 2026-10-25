import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLANS, order, readParams, payUrl } from "./order.mjs?v=ccd0c2c-202610250604";

const OFFER = JSON.parse(readFileSync(new URL("../data/intake/offer.json", import.meta.url), "utf8"));
const dollars = (n) => `$${n.toLocaleString("en-US")}`;

test("every choice leads to its own Stripe link", () => {
  assert.equal(order({ plan: "complete", billing: "once" }).linkKey, "completeCheckout");
  assert.equal(order({ plan: "complete", billing: "monthly" }).linkKey, "completeCheckoutMonthly");
  assert.equal(order({ plan: "residency", billing: "once" }).linkKey, "residencyCheckout");
  assert.equal(order({ plan: "residency", billing: "monthly" }).linkKey, "residencyCheckoutMonthly");
  assert.equal(order({ plan: "complete", gift: true }).linkKey, "giftComplete");
  assert.equal(order({ plan: "residency", gift: true }).linkKey, "giftResidency");
  assert.equal(order({ plan: "residency", billing: "monthly", gift: true }).linkKey, "giftResidencyMonthly");
});

test("a gift never starts a trial on someone else's card", () => {
  const gift = order({ plan: "complete", billing: "monthly", gift: true });
  assert.equal(gift.billing, "once");
  assert.equal(gift.linkKey, "giftComplete");
  assert.equal(gift.due, "$997 today");
  assert.equal(gift.trialOffered, false);
  assert.match(gift.terms, /refunded in full/);
  assert.doesNotMatch(gift.terms, /14 days/);
  assert.equal(order({ plan: "complete" }).trialOffered, true);
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
  assert.deepEqual(readParams("?plan=nope&billing=weekly&ck=bad"), { plan: "complete", billing: "once", gift: false, ck: "", from: "" });
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
