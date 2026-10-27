import test from "node:test";
import assert from "node:assert/strict";
import { DONE, claimTitle, shareLabel, giftSource } from "./gift-words.mjs?v=f2598aa-202610271919";

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

test("every outcome has words, and none uses an em dash", () => {
  for (const [key, words] of Object.entries(DONE)) {
    assert.ok(words.eyebrow && words.title, key);
    assert.doesNotMatch(`${words.title} ${words.body}`, /—/, key);
  }
});
