import test from "node:test";
import assert from "node:assert/strict";
import { PACK_NODES, packFirstOpen } from "./pack.js?v=fbad271-202610110101";

test("Prepare runs fit, apply, reach out, get ready, and reopens at the first step not done", () => {
  assert.deepEqual(PACK_NODES.map((n) => n.id), ["fit", "apply", "reach", "ready"]);
  assert.equal(packFirstOpen(undefined), "fit");
  assert.equal(packFirstOpen({ fit: "2026-10-10" }), "apply");
  assert.equal(packFirstOpen({ fit: 1, apply: 1, reach: 1, ready: 1 }), "ready");
});
