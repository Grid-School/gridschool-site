import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NODE_TYPES } from "./node-types.mjs?v=72f7e6e-202610142247";

test("the browser's node types match data/node-types.json exactly", () => {
  assert.deepEqual(NODE_TYPES, JSON.parse(readFileSync(new URL("./node-types.json", import.meta.url))));
});
