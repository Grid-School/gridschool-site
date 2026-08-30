import test from "node:test";
import assert from "node:assert/strict";
import { validReviewReturn } from "./review.js";

test("verdict alone is not a return", () => {
  assert.equal(validReviewReturn({ verdict: "ok" }), false);
});

test("scores must be integers 1-5", () => {
  assert.equal(
    validReviewReturn({
      verdict: "ok",
      ccvv: { communication: 3, comprehension: 3, vision: 3, verification: 0 },
    }),
    false
  );
});

test("all four scores required", () => {
  assert.equal(
    validReviewReturn({
      verdict: "ok",
      ccvv: { communication: 3, comprehension: 3, vision: 3 },
    }),
    false
  );
});

test("full return is valid", () => {
  assert.equal(
    validReviewReturn({
      verdict: "Scope is right.",
      ccvv: { communication: 4, comprehension: 3, vision: 4, verification: 2 },
    }),
    true
  );
});
