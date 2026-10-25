import test from "node:test";
import assert from "node:assert/strict";
import { modeOf, MODES } from "./modes.js?v=2b0f46b-202610250651";

test("a node with no mode is Open", () => {
  assert.equal(modeOf({}).key, "open");
  assert.equal(modeOf(null).key, "open");
});

test("an unknown mode string falls back to Open instead of inventing a rule", () => {
  assert.equal(modeOf({ mode: "turbo" }).key, "open");
});

test("every named mode carries a label and a rule the step page can print", () => {
  for (const [key, mode] of Object.entries(MODES)) {
    assert.ok(mode.label, `${key} label`);
    assert.ok(mode.rule, `${key} rule`);
    assert.equal(modeOf({ mode: key }).key, key);
  }
});
