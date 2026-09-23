import test from "node:test";
import assert from "node:assert/strict";
import { addKeyword, parseKeywords } from "./search.js";

test("interests are normalized before reaching the shared queue", () => {
  assert.deepEqual(
    parseKeywords("  observability, incident   response, observability "),
    ["observability", "incident response"]
  );
  assert.deepEqual(parseKeywords("   "), []);
});

test("phrases are capped and a chip does not duplicate", () => {
  const many = Array.from({ length: 8 }, (_, index) => `topic${index}`).join(", ");
  assert.equal(parseKeywords(many).length, 6);
  assert.equal(addKeyword("observability", "observability"), "observability");
  assert.equal(addKeyword("observability", "evaluation"), "observability, evaluation");
});
