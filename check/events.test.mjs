import test from "node:test";
import assert from "node:assert/strict";
import { fbcFrom } from "./events.js?v=759fedf-202610271938";

test("a visit from a Meta ad keeps its click id in Meta's format, first-seen time and all", () => {
  assert.equal(fbcFrom("?fbclid=IwAR0abcdefghij&from=meta:P-1", "", 1793000000000), "fb.1.1793000000000.IwAR0abcdefghij");
  // The same click again keeps the time it was first seen; a new click replaces it.
  assert.equal(fbcFrom("?fbclid=IwAR0abcdefghij", "fb.1.1793000000000.IwAR0abcdefghij", 1799999999999), "fb.1.1793000000000.IwAR0abcdefghij");
  assert.equal(fbcFrom("?fbclid=IwARnewclick99", "fb.1.1793000000000.IwAR0abcdefghij", 1799999999999), "fb.1.1799999999999.IwARnewclick99");
  // No click, or junk: whatever was kept stays.
  assert.equal(fbcFrom("?from=vsl", "fb.1.1793000000000.IwAR0abcdefghij"), "fb.1.1793000000000.IwAR0abcdefghij");
  assert.equal(fbcFrom("?fbclid=<script>", ""), "");
  assert.equal(fbcFrom("", ""), "");
});
