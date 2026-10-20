import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NODE_TYPES } from "./node-types.mjs?v=5a6643e-202610200458";

test("the browser's node types match data/node-types.json exactly", () => {
  assert.deepEqual(NODE_TYPES, JSON.parse(readFileSync(new URL("./node-types.json", import.meta.url))));
});
