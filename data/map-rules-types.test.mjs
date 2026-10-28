import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMap } from "./map-rules.mjs?v=e1b1240-202610280516";

/** Python quotes a value with ' and JS with ": the same message either way. */
const norm = (errors) => errors.map((e) => e.replaceAll("'", '"'));
const CASES = JSON.parse(readFileSync(new URL("../server/testdata/node-type-cases.json", import.meta.url)));

for (const c of CASES) {
  test(`map rules, shared with maps.py: ${c.name}`, () => {
    assert.deepEqual(norm(validateMap(c.map)), norm(c.errors));
  });
}
