import test from "node:test";
import assert from "node:assert/strict";
import { seenLabel, quietSignal } from "./last-seen.js?v=8b71053-202610102102";

const now = new Date(2026, 9, 8, 15, 0);
const at = (y, m, d, h = 9) => new Date(y, m, d, h).toISOString();

test("seenLabel: unknown, never, today, yesterday, days ago", () => {
  assert.equal(seenLabel(undefined, now), null);
  assert.equal(seenLabel(null, now), "Not seen on the board yet");
  assert.equal(seenLabel(at(2026, 9, 8, 1), now), "Last seen today");
  assert.equal(seenLabel(at(2026, 9, 7, 23), now), "Last seen yesterday");
  assert.equal(seenLabel(at(2026, 9, 3), now), "Last seen 5 days ago");
  assert.equal(seenLabel("not a date", now), null);
});

test("quietSignal: never is bad, 4+ days is a warning, recent or unknown is nothing", () => {
  assert.deepEqual(quietSignal(null, now), { tone: "bad", text: "Not seen on the board yet" });
  assert.deepEqual(quietSignal(at(2026, 9, 4), now), { tone: "warn", text: "Quiet 4 days" });
  assert.equal(quietSignal(at(2026, 9, 5), now), null);
  assert.equal(quietSignal(undefined, now), null);
});
