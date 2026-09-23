import test from "node:test";
import assert from "node:assert/strict";
import { loadDesk, saveDesk, todayKey } from "./desk.js";

function memory() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

test("a new day keeps interests and drops yesterday's displayed post", () => {
  const store = memory();
  saveDesk(store, "demo", {
    keywords: "observability",
    day: "2026-09-21",
    current: { id: "urn:li:activity:1" },
  });
  const next = loadDesk(store, "demo", "2026-09-22");
  assert.equal(next.keywords, "observability");
  assert.equal(next.current, null);
  assert.equal(todayKey(new Date(2026, 8, 22)), "2026-09-22");
});
