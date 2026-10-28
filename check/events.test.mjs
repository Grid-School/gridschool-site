import test from "node:test";
import assert from "node:assert/strict";
import { fbcFrom } from "./events.js?v=e1b1240-202610280516";

test("a visit from a Meta ad keeps its click id in Meta's format, first-seen time and all", () => {
  assert.equal(fbcFrom("?fbclid=IwAR0abcdefghij&from=meta:P-1", "", 1793000000000), "fb.1.1793000000000.IwAR0abcdefghij");
  // The same click again keeps the time it was first seen; a new click replaces it.
  assert.equal(fbcFrom("?fbclid=IwAR0abcdefghij", "fb.1.1793000000000.IwAR0abcdefghij", 1799999999999), "fb.1.1793000000000.IwAR0abcdefghij");
  assert.equal(fbcFrom("?fbclid=IwARnewclick99", "fb.1.1793000000000.IwAR0abcdefghij", 1799999999999), "fb.1.1799999999999.IwARnewclick99");
  // No click, or junk: whatever was kept stays.
  assert.equal(fbcFrom("?from=vsl", "fb.1.1793000000000.IwAR0abcdefghij", 1793000000000), "fb.1.1793000000000.IwAR0abcdefghij");
  assert.equal(fbcFrom("?fbclid=<script>", ""), "");
  assert.equal(fbcFrom("", ""), "");
});

test("a kept click is dropped once it is more than 90 days old", () => {
  const day = 86_400_000;
  const kept = "fb.1.1793000000000.IwAR0abcdefghij";
  assert.equal(fbcFrom("", kept, 1793000000000 + 90 * day), kept);
  assert.equal(fbcFrom("", kept, 1793000000000 + 90 * day + 1), "");
  // The same click seen again after 90 days starts fresh; a junk value kept by mistake goes too.
  assert.equal(fbcFrom("?fbclid=IwAR0abcdefghij", kept, 1793000000000 + 91 * day), `fb.1.${1793000000000 + 91 * day}.IwAR0abcdefghij`);
  assert.equal(fbcFrom("", "not-a-click", 1793000000000), "");
});
