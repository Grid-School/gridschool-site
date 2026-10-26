import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMap } from "./map-rules.mjs?v=200c41d-202610261730";

/** Python quotes a value with ' and JS with ": the same message either way. */
const norm = (errors) => errors.map((e) => e.replaceAll("'", '"'));
const CASES = JSON.parse(readFileSync(new URL("../server/testdata/node-type-cases.json", import.meta.url)));

for (const c of CASES) {
  test(`map rules, shared with maps.py: ${c.name}`, () => {
    assert.deepEqual(norm(validateMap(c.map)), norm(c.errors));
  });
}
