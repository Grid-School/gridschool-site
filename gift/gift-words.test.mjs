import test from "node:test";
import assert from "node:assert/strict";
import { DONE, LEAD, claimTitle, shareLabel, giftSource, leadBody, leadProblem, scheduledWords } from "./gift-words.mjs?v=c7fe5aa-202610310430";

test("a gift bought after an ad keeps the ad in checkout's source", () => {
  assert.equal(giftSource("meta:P-TABLE-01"), "gift:meta:P-TABLE-01");
  assert.equal(giftSource(""), "gift");
  assert.equal(giftSource("gift"), "gift");
  assert.equal(giftSource("<x>"), "gift:x");
});

test("the claim page names the giver, the person and the plan", () => {
  assert.equal(claimTitle({ from: "Mei", name: "Jay", plan: "complete" }), "Jay, Mei gave you GridSchool Complete.");
  assert.equal(claimTitle({ from: "", name: "", plan: "residency" }), "Someone gave you the GridSchool Residency.");
  assert.equal(shareLabel({ from: "Mei" }), "Send Mei a short weekly progress note.");
});

test("'Email me this' sends a phone only with the box ticked, and says what's missing", () => {
  assert.deepEqual(leadBody({ email: " mei@example.com ", phone: "208 555 0100", sms: false, company: "", visitor: "v_12345678", from: "meta:P-1" }), {
    email: "mei@example.com", sms: false, visitor: "v_12345678", from: "gift:meta:P-1", company: "",
  });
  assert.equal(leadBody({ email: "a@b.co", phone: "2085550100", sms: true }).phone, "2085550100");
  assert.equal(leadProblem({ email: "nope" }), LEAD.email);
  assert.equal(leadProblem({ email: "a@b.co", sms: true, phone: "" }), LEAD.phone);
  assert.equal(leadProblem({ email: "a@b.co", sms: true, phone: "208 555 0100" }), "");
  assert.equal(leadProblem({ email: "a@b.co" }), "");
});

test("back from Stripe with a chosen day, the thank-you names it", () => {
  assert.equal(scheduledWords("2027-05-15").title, "Thank you. We'll send it on May 15.");
  assert.doesNotMatch(scheduledWords("2027-05-15").body, /—/);
  assert.equal(scheduledWords(""), null);
  assert.equal(scheduledWords(null), null);
});

test("every outcome has words, and none uses an em dash", () => {
  for (const [key, words] of Object.entries(DONE)) {
    assert.ok(words.eyebrow && words.title, key);
    assert.doesNotMatch(`${words.title} ${words.body}`, /—/, key);
  }
});
