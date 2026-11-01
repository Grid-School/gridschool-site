import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NODE_TYPES } from "./node-types.mjs?v=7b0c6e7-202611010037";

test("the browser's node types match data/node-types.json exactly", () => {
  assert.deepEqual(NODE_TYPES, JSON.parse(readFileSync(new URL("./node-types.json", import.meta.url))));
});
