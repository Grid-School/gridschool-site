// node site/begin/when.test.mjs
import assert from "node:assert/strict";
import { nextReview, reviewLabel } from "./when.js?v=7a3a519-202610200504";

const iso = (s) => new Date(s);

// Monday 2026-10-19 09:00 Denver (MDT, UTC-6) = 15:00Z. Tomorrow 10am is 25h away.
assert.equal(nextReview(iso("2026-10-19T15:00:00Z")).toISOString(), "2026-10-20T16:00:00.000Z");
// Monday 17:00 Denver = 23:00Z. Tuesday 10am is 17h away, too soon: Wednesday.
assert.equal(nextReview(iso("2026-10-19T23:00:00Z")).toISOString(), "2026-10-21T16:00:00.000Z");
// Exactly 18h before counts.
assert.equal(nextReview(iso("2026-10-19T22:00:00Z")).toISOString(), "2026-10-20T16:00:00.000Z");
// Across the fall DST change (Sunday 2026-11-01): Saturday 9am MDT, so Sunday 10am MST, which is 17:00Z.
assert.equal(nextReview(iso("2026-10-31T15:00:00Z")).toISOString(), "2026-11-01T17:00:00.000Z");

assert.equal(reviewLabel(iso("2026-10-19T15:00:00Z"), "America/Denver"), "Tuesday 10am Mountain time");
assert.equal(reviewLabel(iso("2026-10-19T15:00:00Z"), "America/New_York"), "Tuesday 10am Mountain time (noon your time)");
assert.equal(reviewLabel(iso("2026-10-19T15:00:00Z"), "Asia/Kolkata"), "Tuesday 10am Mountain time (9:30pm your time)");
assert.equal(reviewLabel(iso("2026-10-19T15:00:00Z"), "Australia/Sydney"), "Tuesday 10am Mountain time (Wednesday 3am your time)");
console.log("when.test.mjs ok");
