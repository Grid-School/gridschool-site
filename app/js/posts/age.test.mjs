import test from "node:test";
import assert from "node:assert/strict";
import { ageMinutes, formatAge, isFresh } from "./age.js";

test("relative labels inside a day stay fresh", () => {
  assert.equal(ageMinutes("just now"), 0);
  assert.equal(ageMinutes("34m"), 34);
  assert.equal(ageMinutes("2h • Edited"), 120);
  assert.equal(ageMinutes("23h"), 23 * 60);
  assert.equal(isFresh("23h"), true);
  assert.equal(formatAge(90), "1h");
});

test("a day or older is not fresh, and an unknown label is not fresh", () => {
  assert.equal(ageMinutes("1d"), 24 * 60);
  assert.equal(ageMinutes("yesterday"), 24 * 60);
  assert.equal(ageMinutes("2w"), 14 * 24 * 60);
  assert.equal(isFresh("1d"), false);
  assert.equal(isFresh("1w"), false);
  assert.equal(ageMinutes("recently"), null);
  assert.equal(isFresh(""), false);
});
