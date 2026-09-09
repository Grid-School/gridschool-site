import test from "node:test";
import assert from "node:assert/strict";
import { artifactOf, ARTIFACTS } from "./artifacts.js";

test("a node with no artifact renders nothing", () => {
  assert.equal(artifactOf({}), null);
  assert.equal(artifactOf(null), null);
});

test("an unknown artifact string renders nothing instead of inventing a fourth thing to own", () => {
  assert.equal(artifactOf({ artifact: "dashboard" }), null);
});

test("each of the three artifacts carries a label and an edits line the step page can print", () => {
  assert.deepEqual(Object.keys(ARTIFACTS).sort(), ["graph", "script", "ticket"]);
  for (const [key, artifact] of Object.entries(ARTIFACTS)) {
    assert.ok(artifact.label, `${key} label`);
    assert.ok(artifact.edits, `${key} edits`);
    assert.equal(artifactOf({ artifact: key }).key, key);
  }
});
